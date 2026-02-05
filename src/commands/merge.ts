import path from 'path';
import { Command } from 'commander';
import { AbstractCommands, GitOperationResult, FeatureWorktree } from './abstract';
import { FeatureCommands } from './feature';
import { ForgeContext } from '../lib/config';
import { confirmSlugOrThrow } from '../lib/slug';
import { promptChoice } from '../lib/prompt';
import { checkoutBranch, runGit, getGitStatusPorcelain } from '../lib/git';

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
        const targetBranch = await this.promptForBranch(
            this.config.mainRepoRoot,
            'Select target branch for merge:',
            false,
        );
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
     * Perform merge operations for all repositories.
     *
     * Iterates through each repository and attempts to merge the feature branch
     * into the target branch. Continues even if individual merges fail or have conflicts.
     *
     * @param featureWorktrees - Array of feature worktrees to merge
     * @param targetBranch - The branch to merge into
     * @returns Array of merge results for each repository
     */
    private async performMergesForAllRepos(
        featureWorktrees: FeatureWorktree[],
        targetBranch: string,
    ): Promise<GitOperationResult[]> {
        const results: GitOperationResult[] = [];

        for (const wt of featureWorktrees) {
            const repoName = this.getRepoNameOrThrow(wt.repoRoot);
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
    private async mergeSingleRepo(worktree: FeatureWorktree, targetBranch: string, repoName: string): Promise<GitOperationResult> {
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
    private async displaySummaryAndProposeAction(results: GitOperationResult[], slug: string): Promise<void> {
        this.displayOperationSummary(results, 'merge');

        const conflicts = results.filter((r) => r.hasConflicts);
        const failed = results.filter((r) => !r.success && !r.hasConflicts);

        // If all successful, propose next action
        if (conflicts.length === 0 && failed.length === 0) {
            console.log('\n🎉 All merges completed successfully!\n');
            await this.proposeNextAction(slug);
        } else {
            console.log('\n⚠️  Some merges need attention. Please resolve conflicts or errors before proceeding.');
        }
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
