import { FeatureContext } from '../foundation/FeatureContext';
import { RepositoryStatus, WorktreeRepository } from '../foundation/Repository';
import { RepoName } from '../foundation/types/RepositoryInfos';
import { pathExists } from '../lib/fs';
import { checkoutBranch, gitBranchExists } from '../lib/git';
import { promptChoice, promptConfirm, promptForBranch } from '../lib/prompt';
import { confirmSlugOrThrow } from '../lib/slug';
import { AbstractCommands } from './AbstractCommands';
import { OpenCommands } from './OpenCommands';

export class FeatureCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a new feature folder and initialize missing spec files.
     * - Does not create worktrees or set active feature - use `start` for that.
     * - But it merges spec files to main branch to ensure they are available for users who don't use worktrees and for the feature context.
     * This is useful if you want to prepare features in the current branch of the main repo.
     * If you have an idea of a feature but don't want to start working on it yet, you can create it to have the spec files ready and then start it when you want to work on it.
     */
    async create(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        await this.prepareFeature(slug, true);
        console.log(
            `Feature "${slug}" created and spec files initialized. You can find them in the current branch of the main repository. Use 'forge start ${slug}' to start working on it using git worktrees.`,
        );
    }

    /**
     * Start the development of a feature by creating worktrees (if not already created) and setting the active feature pointer.
     * - Does create worktrees and set active feature
     * - But it doesn't merge spec files to main branch if they were not already created
     * This is useful when you want to start working instantly on a feature
     */
    async start(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        // Prepare feature: validate slug, ensure branch and spec exist
        await (await this.prepareFeature(slug, false)).start();

        // Propose to open the feature in the configured IDE
        if (this.context.ides.length > 0) {
            const shouldOpen = await promptConfirm(`Open feature "${slug}" in ${this.context.ides[0].name}?`);
            if (shouldOpen) {
                const openCommands = new OpenCommands(this.context);
                await openCommands.open(slug);
            }
        }
    }

    /**
     * List all feature worktrees with their git branches.
     */
    async list(): Promise<void> {
        const featureContexts = await this.context.loadFeatureContexts();

        // Display each feature with branch information
        console.log(`Feature${featureContexts.length !== 1 ? 's' : ''}: (${featureContexts.length} found)`);
        for (const featureContext of featureContexts) {
            // Collect branch information for this feature
            const repositoriesStatus = await featureContext.collectRepositoriesStatus();

            // Format branch information
            const {
                info: branchInfo,
                onFeatureBranch,
                isInconsistent,
            } = this.formatFeatureContextRepositoriesStatus(featureContext, repositoriesStatus);

            // Use red color for inconsistent branches
            const RED = '\\x1b[31m';
            const ORANGE = '\\x1b[33m';
            const RESET = '\\x1b[0m';
            const COLOR = isInconsistent ? RED : onFeatureBranch ? ORANGE : '';
            const output = isInconsistent
                ? `  - ${featureContext.slug}${COLOR}${branchInfo}${RESET}`
                : `  - ${featureContext.slug}${branchInfo}`;

            console.log(output);
        }
    }

    /**
     * Resync all repos in a feature worktree to the correct branch.
     */
    async resync(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        const featureContext = await this.context.loadFeatureContext(slug);

        const expectedBranch = featureContext.featureBranchName;
        console.log(`Resyncing feature \"${slug}\" to branch \"${expectedBranch}\"...`);

        let hasErrors = false;

        // Resync each repository worktree
        for (const repository of featureContext.repositories) {
            const hadError = await this.resyncRepository(featureContext, repository);
            if (hadError) {
                hasErrors = true;
            }
        }
        for (const rootRepository of this.context.repositories) {
            if (!featureContext.repositories.some((r) => r.rootRepository.name === rootRepository.name)) {
                console.log(`  ⚠ ${rootRepository.name}: not part of feature context, trying to init it`);
                const worktreeRepository = await featureContext.ensureWorktreeForRepo(rootRepository);
                worktreeRepository.setActiveFeature(featureContext);
                featureContext.repositories.push(worktreeRepository);
            }
        }

        // Display summary
        if (hasErrors) {
            console.log('\\n⚠ Resync completed with errors.');
        } else {
            console.log('\\n✓ All repos resynced successfully.');
        }
    }

    /**
     * Stop a feature by removing its worktrees and clearing active pointer.
     */
    async stop(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);

        // Clean up any orphaned worktrees first
        await this.context.cleanOrphanedWorktrees(slug);

        if (!(await this.context.isFeatureActive(slug))) {
            console.log(`Feature "${slug}" is not active. Nothing to stop.`);
            return;
        }

        const featureContext = await this.context.loadFeatureContext(slug);

        // Verify clean state before stopping
        await featureContext.stop();

        // Clean up all worktrees and feature directory
        await featureContext.delete();
    }

    /**
     * Archive a feature by moving it from .features/<slug>/ to .features/.archives/<slug>/
     * and committing the change in the feature branch.
     */
    async archive(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);

        let featureContext: FeatureContext = await this.context.getFeatureContext(slug);

        // First stop the feature to clean up worktrees and ensure there are no uncommitted changes, but don't delete the feature context yet
        await featureContext.stop();

        // Move the specs files to the archive folder and commit + merge
        await featureContext.archive();

        // Clean up all worktrees and feature directory
        await featureContext.delete();

        const confirmDeleteBranch = await promptConfirm(
            `Do you also want to delete the feature branch "${featureContext.featureBranchName}" in all repos?\nThis cannot be undone, but you can always recreate the branch later if needed.`,
        );
        if (confirmDeleteBranch) {
            await featureContext.deleteBranch();
            console.log(`Feature branch "${featureContext.featureBranchName}" deleted.`);
        } else {
            console.log(
                `Feature branch "${featureContext.featureBranchName}" not deleted. You can delete it manually later if you change your mind.`,
            );
        }
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Prepare feature branch + spec initialization shared by create/start.
     */
    private async prepareFeature(slug: string, mergeToRoot: boolean = false): Promise<FeatureContext> {
        let rootRepoChanges = 0;
        let worktreeRepoChanges = 0;
        // Ensure agent templates exist in .features/.template/agent/
        rootRepoChanges += (await this.context.ensureAgentTemplates(this.context.mainRepo)).length;

        // Ensure .gitignore includes .active-feature in all repos to avoid accidentally committing active feature pointers
        rootRepoChanges += await this.context.ensureGitIgnore();

        // Ensure feature branch exists in all repos (creates branch if missing, but does not check it out)
        await this.context.ensureFeatureBranch(slug); // doesn't realy count as changes

        let featureContext: FeatureContext;
        if (await this.context.isFeatureActive(slug)) {
            // The feature is already active
            featureContext = await this.context.loadFeatureContext(slug);
            // We have made changes to the main repository
            // We need to rebase the feature branch in the worktree repositories to include these changes, to avoid issues with missing templates or missing .gitignore rules in the feature branches
            if (rootRepoChanges > 0) {
                // we need to rebase the feature branch to include the new commits that we have added to the main branch (agent templates, .gitignore)
                console.log('Rebasing worktree repository to include new commits on root repository...');
                const mainRepo = featureContext.mainRepo;
                const currentRootBranch = (await mainRepo.getCurrentBranch())!;
                const result = await mainRepo.rebase(featureContext.featureBranchName, currentRootBranch);
                if (!result.success) {
                    console.log(`⚠️  Rebase failed while preparing feature '${slug}'. You will need to do it manually.`);
                }
            }
        } else {
            // The feature is not active yet
            featureContext = this.context.makeFeatureContext(slug);
        }

        // Ensure feature spec files exist in the main repo branch, creating them in a temporary worktree if needed
        worktreeRepoChanges += await this.context.initFeatureSpecFiles(featureContext);

        if (worktreeRepoChanges > 0 && mergeToRoot) {
            // We have made changes to the worktree repo, but they are not visible
            // We need to merge the feature branch back to the main branch to include these changes in the main repo, to ensure they are available for users who don't use worktrees and for the feature context
            const mainRepo = this.context.mainRepo;
            // If the feature files were initialized in a worktree, we need to merge them back to the main branch to ensure they are available in the main repo for the feature context and for users who don't use worktrees
            await mainRepo.merge((await mainRepo.getCurrentBranch())!, featureContext.featureBranchName);
        }

        return featureContext;
    }

    /**
     * Format branch information for display.
     *
     * Shows a single branch name if consistent across repos,
     * or all repo-branch pairs if inconsistent (highlighted in red).
     *
     * @param branches - Map of repository names to branch names
     * @returns Formatted branch info string and inconsistency flag
     */
    private formatFeatureContextRepositoriesStatus(
        featureContext: FeatureContext,
        repositoriesStatus: Record<RepoName, RepositoryStatus>,
    ): {
        info: string;
        onFeatureBranch: boolean;
        isInconsistent: boolean;
    } {
        const uniqueBranches = new Set(Object.values(repositoriesStatus).map((status) => status.branch));

        if (uniqueBranches.size === 0) {
            return { info: ' (no branch info)', isInconsistent: false, onFeatureBranch: false };
        }

        if (uniqueBranches.size === 1) {
            // All repos on same branch
            const currentBranch = Array.from(uniqueBranches)[0];
            return {
                info: ` (branch: ${currentBranch})`,
                isInconsistent: false,
                onFeatureBranch: currentBranch === featureContext.featureBranchName,
            };
        }

        // Different branches across repos - show all
        const branchList = Object.entries(repositoriesStatus)
            .map(([repo, status]) => `${repo}: ${status.branch}`)
            .join(', ');
        return { info: ` (${branchList})`, isInconsistent: true, onFeatureBranch: false };
    }

    /**
     * Resync a single repository worktree to the expected branch.
     *
     * @param repoName - Name of the repository
     * @param worktreePath - Path to the worktree
     * @param expectedBranch - Expected branch name
     * @returns true if an error occurred, false otherwise
     */
    private async resyncRepository(featureContext: FeatureContext, repository: WorktreeRepository): Promise<boolean> {
        // Check if worktree exists
        if (!(await pathExists(repository.path))) {
            console.log(`  ⚠ ${repository.name}: worktree not found, skipping`);
            return false;
        }
        const { branch, dirty, onFeatureBranch } = await repository.getStatus(featureContext.slug);
        const expectedBranch = featureContext.featureBranchName;

        // Check current branch
        if (onFeatureBranch) {
            console.log(`  ✓ ${repository.name}: already on ${expectedBranch}`);
            return false;
        }

        // Check for uncommitted changes
        if (dirty) {
            console.log(`  ✗ ${repository.name}: has uncommitted changes, cannot switch branch`);
            return true;
        }

        // Check if expected branch exists
        if (!(await gitBranchExists(repository.path, expectedBranch))) {
            // This should never happen ...
            console.log(`  ✗ ${repository.name}: branch ${expectedBranch} does not exist`);
            return true;
        }

        // Attempt to checkout expected branch
        try {
            await checkoutBranch(repository.path, expectedBranch);
            console.log(`  ✓ ${repository.name}: switched from ${branch} to ${expectedBranch}`);
            return false;
        } catch (error) {
            console.log(`  ✗ ${repository.name}: failed to checkout ${expectedBranch}`);
            return true;
        }
    }
}
