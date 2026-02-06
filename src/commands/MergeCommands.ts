import { FeatureContext } from '../foundation/FeatureContext';
import { RootRepository } from '../foundation/Repository';
import { displayOperationSummary, GitOperation, GitOperationResult } from '../lib/git';
import { promptChoice, promptForBranch } from '../lib/prompt';
import { confirmSlugOrThrow } from '../lib/slug';
import { AbstractCommands } from './AbstractCommands';
import { FeatureCommands } from './FeatureCommands';

/**
 * Commands for merging feature branches into target branches
 */
export class MergeCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    async merge(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);

        const featureBranchName = this.context.getFeatureBranchName(slug);
        let targetRepos: RootRepository[];

        // If the feature is active, we only merge the repos that are part of the feature context (in case some configured repos were not part of the feature when it was started)
        // If the feature is not active, we merge all repos to ensure the feature branch is up to date everywhere.
        const isFeatureActive = await this.context.isFeatureActive(slug);
        if (isFeatureActive) {
            const featureContext = await this.context.loadFeatureContext(slug);
            // If the feature is active, we verify that all repos in the feature context are clean before merging
            await this.verifyCleanFeature(featureContext);
            targetRepos = featureContext.repositories.map((wtRepo) => wtRepo.rootRepository);
        } else {
            targetRepos = this.context.repositories;
        }

        const targetBranch = await promptForBranch(
            this.context.mainRepo.path,
            'Select target branch (showing branches of main repo, the branch must exist in all repos):',
            this.context.options.git.featureBranchPrefix,
            false,
        );
        console.log(`\nMerging feature: ${slug}`);
        console.log(`\n🔀 Feature branch: ${featureBranchName}`);
        console.log(`\n📍 Target branch: ${targetBranch}\n`);

        const results = await Promise.all(targetRepos.map((repo) => repo.merge(featureBranchName, targetBranch)));

        await this.displaySummaryAndProposeAction(results, slug);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

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
        displayOperationSummary(results, GitOperation.Merge);

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
        const featureCmd = new FeatureCommands(this.context);

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
