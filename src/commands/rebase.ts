import { AbstractCommands, GitOperationResult, FeatureWorktree } from './abstract';
import { confirmSlugOrThrow } from '../lib/slug';
import { getCurrentBranch, checkoutBranch, runGit, getGitStatusPorcelain } from '../lib/git';

/**
 * Commands for rebasing feature branches onto base branches
 */
export class RebaseCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Rebase a feature branch onto a base branch for all repos.
     *
     * This is the main entry point that orchestrates the entire rebase workflow:
     * 1. Discovers all feature branches across repos
     * 2. Verifies working trees are clean
     * 3. Prompts for base branch selection
     * 4. Performs the rebase for each repository
     * 5. Displays summary
     *
     * @param slug - The feature slug to rebase
     */
    async rebase(slug: string): Promise<void> {
        confirmSlugOrThrow(slug);

        console.log(`\n🔄 Rebasing feature: ${slug}\n`);

        // Step 1: Discover feature branches across all repos
        const featureWorktrees = await this.discoverFeatureWorktrees(slug);

        // Step 2: Verify all working trees are clean
        await this.verifyCleanWorkingTrees(featureWorktrees);

        // Step 3: Prompt user to select base branch
        const baseBranch = await this.promptForBranch(
            this.config.mainRepoRoot,
            'Select base branch to rebase onto:',
            true, // Include feature branches for rebasing one feature onto another
        );
        console.log(`\n📍 Base branch: ${baseBranch}\n`);

        // Step 4: Perform rebase for each repository
        const results = await this.performRebasesForAllRepos(featureWorktrees, baseBranch);

        // Step 5: Display summary
        await this.displaySummary(results, slug);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================



    /**
     * Perform rebase operations for all repositories.
     *
     * Iterates through each repository and attempts to rebase the feature branch
     * onto the base branch. Continues even if individual rebases fail or have conflicts.
     *
     * @param featureWorktrees - Array of feature worktrees to rebase
     * @param baseBranch - The branch to rebase onto
     * @returns Array of rebase results for each repository
     */
    private async performRebasesForAllRepos(
        featureWorktrees: FeatureWorktree[],
        baseBranch: string,
    ): Promise<GitOperationResult[]> {
        const results: GitOperationResult[] = [];

        for (const wt of featureWorktrees) {
            const repoName = this.getRepoNameOrThrow(wt.repoRoot);
            const result = await this.rebaseSingleRepo(wt, baseBranch, repoName);
            results.push(result);
        }

        return results;
    }

    /**
     * Rebase a feature branch onto the base branch for a single repository.
     *
     * @param worktree - The feature worktree information
     * @param baseBranch - The branch to rebase onto
     * @param repoName - The repository name for display
     * @returns Rebase result indicating success or failure
     */
    private async rebaseSingleRepo(worktree: FeatureWorktree, baseBranch: string, repoName: string): Promise<GitOperationResult> {
        console.log(`\n=== Rebasing ${repoName} ===`);

        try {
            // Make sure we're on the feature branch in the worktree
            const currentBranch = await getCurrentBranch(worktree.worktreePath);
            if (currentBranch !== worktree.featureBranch) {
                console.log(`Checking out ${worktree.featureBranch}...`);
                await checkoutBranch(worktree.worktreePath, worktree.featureBranch);
            }

            // Perform rebase
            console.log(`Rebasing ${worktree.featureBranch} onto ${baseBranch}...`);
            try {
                await runGit(worktree.worktreePath, ['rebase', baseBranch]);
                console.log(`✅ Rebase successful for ${repoName}`);
                return { repo: repoName, success: true, hasConflicts: false };
            } catch (error) {
                // Check if it's a rebase conflict
                const status = await getGitStatusPorcelain(worktree.worktreePath);
                if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
                    console.log(`⚠️  Rebase conflicts detected in ${repoName}`);
                    console.log(`Please resolve conflicts manually in: ${worktree.worktreePath}`);
                    console.log(`After resolving, run: git rebase --continue`);
                    console.log(`To abort, run: git rebase --abort`);
                    return { repo: repoName, success: false, hasConflicts: true };
                } else {
                    // Re-throw if it's not a rebase conflict
                    throw error;
                }
            }
        } catch (error) {
            console.error(`❌ Error rebasing ${repoName}:`, error instanceof Error ? error.message : error);
            return { repo: repoName, success: false, hasConflicts: false };
        }
    }

    /**
     * Display rebase summary to the user.
     *
     * Shows categorized results of all rebase operations.
     *
     * @param results - Array of rebase results
     * @param slug - The feature slug
     */
    private async displaySummary(results: GitOperationResult[], slug: string): Promise<void> {
        this.displayOperationSummary(results, 'rebase');

        const conflicts = results.filter((r) => r.hasConflicts);
        const failed = results.filter((r) => !r.success && !r.hasConflicts);

        // Summary message
        if (conflicts.length === 0 && failed.length === 0) {
            console.log('\n🎉 All rebases completed successfully!');
            console.log(`\nFeature "${slug}" has been rebased and is ready to continue development.`);
        } else {
            console.log('\n⚠️  Some rebases need attention. Please resolve conflicts or errors before continuing.');
            console.log('After resolving conflicts, you can continue with: git rebase --continue');
        }
    }

}
