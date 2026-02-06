import { FeatureContext } from '../foundation/FeatureContext';
import { WorktreeRepository } from '../foundation/Repository';
import { displayOperationSummary, GitOperation, GitOperationResult } from '../lib/git';
import { promptForBranch } from '../lib/prompt';
import { confirmSlugOrThrow } from '../lib/slug';
import { AbstractCommands } from './AbstractCommands';

/**
 * Commands for rebasing feature branches onto base branches
 */
export class RebaseCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    async rebase(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        const featureBranchName = this.context.getFeatureBranchName(slug);
        let featureContext: FeatureContext;
        let targetRepos: WorktreeRepository[];

        // If the feature is active, we only rebase the repos that are part of the feature context (in case some configured repos were not part of the feature when it was started)
        // If the feature is not active, we rebase all repos to ensure the feature branch is up to date everywhere.
        const isFeatureActive = await this.context.isFeatureActive(slug);
        if (!isFeatureActive) {
            throw new Error(
                `Feature "${slug}" is not active. Rebase only possible on active features. Do a "forge feature start ${slug}" to start the feature first.`,
            );
        }
        featureContext = await this.context.loadFeatureContext(slug);
        // If the feature is active, we verify that all repos in the feature context are clean before rebasing
        await this.verifyCleanFeature(featureContext);
        targetRepos = featureContext.repositories;

        const baseBranch = await promptForBranch(
            this.context.mainRepo.path,
            'Select base branch (showing branches of main repo, the branch must exist in all repos):',
            this.context.options.git.featureBranchPrefix,
            true,
        );
        console.log(`\nRebasing feature: ${slug}`);
        console.log(`\n🔀 Feature branch: ${featureBranchName}`);
        console.log(`\n📍 Base branch: ${baseBranch}\n`);

        const results = await Promise.all(targetRepos.map((repo) => repo.rebase(featureBranchName, baseBranch)));

        await this.displaySummaryAndProposeAction(results, slug);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Display rebase summary to the user.
     *
     * Shows categorized results of all rebase operations.
     *
     * @param results - Array of rebase results
     * @param slug - The feature slug
     */
    private async displaySummaryAndProposeAction(results: GitOperationResult[], slug: string): Promise<void> {
        displayOperationSummary(results, GitOperation.Rebase);

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
