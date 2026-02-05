import path from 'path';
import { Command } from 'commander';
import { AbstractCommands } from './abstract';
import { FeatureCommands } from './feature';
import { ForgeContext } from '../lib/config';
import { getFeatureWorktreePath } from '../lib/feature';
import { confirmSlugOrThrow } from '../lib/slug';
import { promptChoice, promptText, promptConfirm } from '../lib/prompt';
import { getCurrentBranch, checkoutBranch, runGit, getGitStatusPorcelain, gitBranchExists } from '../lib/git';
import { execa } from 'execa';

/**
 * Result of a merge operation for a single repository
 */
type MergeResult = {
    repo: string;
    success: boolean;
    hasConflicts: boolean;
};

/**
 * Information about a feature worktree
 */
type FeatureWorktree = {
    repoRoot: string;
    worktreePath: string;
    featureBranch: string;
};

/**
 * Commands for merging feature branches into target branches
 */
export class MergeCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Merge a feature branch into a target branch for all repos.
     *
     * This is the main entry point that orchestrates the entire merge workflow:
     * 1. Discovers all feature branches across repos
     * 2. Verifies working trees are clean
     * 3. Prompts for target branch selection
     * 4. Performs the merge for each repository
     * 5. Displays summary and proposes next action
     *
     * @param slug - The feature slug to merge
     */
    async merge(slug: string): Promise<void> {
        confirmSlugOrThrow(slug);

        console.log(`\n🔀 Merging feature: ${slug}\n`);

        // Step 1: Discover feature branches across all repos
        const featureWorktrees = await this.discoverFeatureWorktrees(slug);

        // Step 2: Verify all working trees are clean
        await this.verifyCleanWorkingTrees(featureWorktrees);

        // Step 3: Prompt user to select target branch
        const targetBranch = await this.promptForTargetBranch(this.config.mainRepoRoot);
        console.log(`\n📍 Target branch: ${targetBranch}\n`);

        // Step 4: Perform merge for each repository
        const results = await this.performMergesForAllRepos(featureWorktrees, targetBranch);

        // Step 5: Display summary and propose next action
        await this.displaySummaryAndProposeAction(results, slug);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Discover all repositories that have a branch for this feature.
     *
     * Iterates through all configured repos and checks if a feature branch exists.
     * Returns information about each worktree that needs to be merged.
     *
     * @param slug - The feature slug
     * @returns Array of feature worktrees to merge
     * @throws Error if no feature branches are found
     */
    private async discoverFeatureWorktrees(slug: string): Promise<FeatureWorktree[]> {
        const featureWorktrees: FeatureWorktree[] = [];

        for (const repoRoot of this.config.repoRoots) {
            const repoName = this.config.repoNames.get(repoRoot)!;
            const worktreePath = getFeatureWorktreePath(this.config.worktreesRoot, slug, repoName);
            const featureBranch = `feature/${slug}`;

            // Check if feature branch exists for this repo
            if (await gitBranchExists(repoRoot, featureBranch)) {
                featureWorktrees.push({ repoRoot, worktreePath, featureBranch });
            }
        }

        if (featureWorktrees.length === 0) {
            throw new Error(`No feature branches found for "${slug}"`);
        }

        // Display found branches
        console.log(`Found ${featureWorktrees.length} repo(s) with feature branches:\n`);
        for (const wt of featureWorktrees) {
            console.log(`  - ${this.config.repoNames.get(wt.repoRoot)} (${wt.featureBranch})`);
        }
        console.log();

        return featureWorktrees;
    }

    /**
     * Verify that all working trees are clean before proceeding with merge.
     *
     * @param featureWorktrees - Array of feature worktrees to check
     * @throws Error if any working tree has uncommitted changes
     */
    private async verifyCleanWorkingTrees(featureWorktrees: FeatureWorktree[]): Promise<void> {
        for (const wt of featureWorktrees) {
            const status = await getGitStatusPorcelain(wt.worktreePath);
            if (status.length > 0) {
                throw new Error(
                    `Working tree is not clean in ${this.config.repoNames.get(wt.repoRoot)}.\n` +
                        `Please commit or stash your changes before merging.`,
                );
            }
        }
    }

    /**
     * Perform merge operations for all repositories.
     *
     * Iterates through each repository and attempts to merge the feature branch
     * into the target branch. Continues even if individual merges fail or have conflicts.
     *
     * @param featureWorktrees - Array of feature worktrees to merge
     * @param targetBranch - The branch to merge into
     * @returns Array of merge results for each repository
     */
    private async performMergesForAllRepos(featureWorktrees: FeatureWorktree[], targetBranch: string): Promise<MergeResult[]> {
        const results: MergeResult[] = [];

        for (const wt of featureWorktrees) {
            const repoName = this.config.repoNames.get(wt.repoRoot)!;
            const result = await this.mergeSingleRepo(wt, targetBranch, repoName);
            results.push(result);
        }

        return results;
    }

    /**
     * Merge a feature branch into the target branch for a single repository.
     *
     * @param worktree - The feature worktree information
     * @param targetBranch - The branch to merge into
     * @param repoName - The repository name for display
     * @returns Merge result indicating success or failure
     */
    private async mergeSingleRepo(worktree: FeatureWorktree, targetBranch: string, repoName: string): Promise<MergeResult> {
        console.log(`\n=== Merging ${repoName} ===`);

        try {
            // Checkout target branch
            console.log(`Checking out ${targetBranch}...`);
            await checkoutBranch(worktree.repoRoot, targetBranch);

            // Perform merge with --no-ff to preserve feature branch history
            console.log(`Merging ${worktree.featureBranch} into ${targetBranch}...`);
            try {
                await runGit(worktree.repoRoot, ['merge', '--no-ff', worktree.featureBranch]);
                console.log(`✅ Merge successful for ${repoName}`);
                return { repo: repoName, success: true, hasConflicts: false };
            } catch (error) {
                // Check if it's a merge conflict (detected by special status indicators)
                const status = await getGitStatusPorcelain(worktree.repoRoot);
                if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
                    console.log(`⚠️  Merge conflicts detected in ${repoName}`);
                    console.log(`Please resolve conflicts manually in: ${worktree.repoRoot}`);
                    return { repo: repoName, success: false, hasConflicts: true };
                } else {
                    // Re-throw if it's not a merge conflict
                    throw error;
                }
            }
        } catch (error) {
            console.error(`❌ Error merging ${repoName}:`, error instanceof Error ? error.message : error);
            return { repo: repoName, success: false, hasConflicts: false };
        }
    }

    /**
     * Display merge summary and propose next action to the user.
     *
     * Shows categorized results of all merge operations and, if all were successful,
     * prompts the user to choose what to do next with the feature.
     *
     * @param results - Array of merge results
     * @param slug - The feature slug
     */
    private async displaySummaryAndProposeAction(results: MergeResult[], slug: string): Promise<void> {
        console.log('\n=== Merge Summary ===');

        const successful = results.filter((r) => r.success);
        const conflicts = results.filter((r) => r.hasConflicts);
        const failed = results.filter((r) => !r.success && !r.hasConflicts);

        if (successful.length > 0) {
            console.log(`\n✅ Successful merges (${successful.length}):`);
            successful.forEach((r) => console.log(`   - ${r.repo}`));
        }

        if (conflicts.length > 0) {
            console.log(`\n⚠️  Conflicts to resolve (${conflicts.length}):`);
            conflicts.forEach((r) => console.log(`   - ${r.repo}`));
        }

        if (failed.length > 0) {
            console.log(`\n❌ Failed merges (${failed.length}):`);
            failed.forEach((r) => console.log(`   - ${r.repo}`));
        }

        // If all successful, propose next action
        if (conflicts.length === 0 && failed.length === 0) {
            console.log('\n🎉 All merges completed successfully!\n');
            await this.proposeNextAction(slug);
        } else {
            console.log('\n⚠️  Some merges need attention. Please resolve conflicts or errors before proceeding.');
        }
    }

    /**
     * Prompt user to select a target branch from available local branches.
     *
     * Displays common branches (main, master, dev, develop, trunk) first,
     * followed by other branches, and allows manual entry via "Other" option.
     *
     * @param repoRoot - The repository root to query for branches
     * @returns The selected branch name
     * @throws Error if branch name is empty or selection is invalid
     */
    private async promptForTargetBranch(repoRoot: string): Promise<string> {
        // Get all local branches
        const result = await execa('git', ['branch', '--format=%(refname:short)'], { cwd: repoRoot });
        const allBranches = result.stdout.split('\n').filter((b: string) => b.trim().length > 0);

        // Common branches to prioritize in the selection menu
        const commonBranches = ['main', 'master', 'dev', 'develop', 'trunk'];

        // Separate common branches that exist from other branches
        const priorityBranches = commonBranches.filter((b: string) => allBranches.includes(b));
        const otherBranches = allBranches.filter((b: string) => !commonBranches.includes(b) && !b.startsWith('feature/'));

        // Build choices menu
        const choices: Array<{ key: string; label: string }> = [];
        let keyIndex = 1;

        // Add priority branches first
        for (const branch of priorityBranches) {
            choices.push({ key: String(keyIndex++), label: branch });
        }

        // Add other branches
        for (const branch of otherBranches) {
            choices.push({ key: String(keyIndex++), label: branch });
        }

        // Add manual entry option
        choices.push({ key: 'x', label: 'Other (enter branch name)' });

        const selection = await promptChoice('Select target branch for merge:', choices);

        // Handle manual entry
        if (selection === 'x') {
            const branchName = await promptText('Enter target branch name:');
            if (!branchName) {
                throw new Error('Branch name cannot be empty');
            }
            return branchName;
        }

        // Find and return selected branch
        const selectedChoice = choices.find((c) => c.key === selection);
        if (!selectedChoice) {
            throw new Error('Invalid selection');
        }

        return selectedChoice.label;
    }

    /**
     * Propose next action after successful merge and execute user's choice.
     *
     * Offers three options:
     * 1. Archive the feature (recommended) - moves to .archives
     * 2. Stop the feature - removes worktrees but keeps branches
     * 3. Do nothing - keeps feature active
     *
     * @param slug - The feature slug
     */
    private async proposeNextAction(slug: string): Promise<void> {
        const choices = [
            { key: '1', label: 'Archive feature (recommended)' },
            { key: '2', label: 'Stop feature (keep branches)' },
            { key: '3', label: 'Do nothing (keep feature active)' },
        ];

        const selection = await promptChoice('What would you like to do next?', choices);

        // Execute the selected action
        const featureCmd = new FeatureCommands(this.config);

        switch (selection) {
            case '1':
                console.log(`\n📦 Archiving feature "${slug}"...`);
                await featureCmd.archive(slug);
                break;
            case '2':
                console.log(`\n⏸️  Stopping feature "${slug}"...`);
                await featureCmd.stop(slug);
                break;
            case '3':
                console.log('\n✅ Feature remains active. You can continue working on it.');
                break;
            default:
                console.log('\n✅ No action taken.');
        }
    }
}
