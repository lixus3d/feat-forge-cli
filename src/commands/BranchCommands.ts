import { getDefaultIDECommand, getWorkspaceFileName } from '@/lib/ide';
import { execa } from 'execa';
import { BranchContext } from '../foundation/BranchContext';
import { RepositoryStatus, RootRepository, WorktreeRepository } from '../foundation/Repository';
import { RepoName } from '../foundation/types/RepositoryInfos';
import { pathExists } from '../lib/fs';
import { checkoutBranch, displayOperationSummary, gitBranchExists, GitOperation, GitOperationResult } from '../lib/git';
import { promptChoice, promptConfirm, promptForBranch } from '../lib/prompt';
import { confirmSlugOrThrow } from '../lib/slug';
import { AbstractCommands } from './AbstractCommands';

export class BranchCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a new branch folder and initialize missing spec files.
     * - Does not create worktrees or set active branch - use `start` for that.
     * - But branch is ready for `start` after this command, since spec files are initialized
     */
    async create(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);

        if (await this.context.isBranchActive(branchName)) {
            console.log(`Branch "${branchName}" is already active. Use "forge start ${branchName}" to start working on it.`);
            return;
        }

        if (await this.context.hasBranch(branchName)) {
            console.log(`Branch "${branchName}" already exists in the repository. You can start it with "forge start ${branchName}".`);
            return;
        }

        const baseBranch = await promptForBranch(
            this.context.mainRepo.path,
            'Select base branch for the new branch (showing branches of main repo, the branch must exist in all repos):',
            this.context.options.git.featureBranchPrefix,
            true,
        );
        // Prepare branch: validate branchName, ensure branch and spec exist
        await this.prepareBranch(branchName, baseBranch);
        console.log(
            `Branch "${branchName}" created and spec files initialized. Use 'forge start ${branchName}' to start working on it using git worktrees.`,
        );
        const mergeBack = await promptConfirm(
            `Do you want to merge the new branch "${branchName}" to another branch now?\n
            (if you want to keep track of its spec, but not start to work on it yet)`,
        );
        if (mergeBack) {
            await this.merge(rawSlug);
        }
    }

    /**
     * Start the development of a branch by creating worktrees (if not already created) and setting the active branch pointer.
     * - Does create worktrees and set active branch
     * - But it doesn't merge spec files to main branch if they were not already created
     * This is useful when you want to start working instantly on a Branch and merge it when finished.
     */
    async start(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);

        let baseBranch: string | undefined = undefined;

        if (!(await this.context.hasBranch(branchName))) {
            baseBranch = await promptForBranch(
                this.context.mainRepo.path,
                'Select base branch for the new branch (showing branches of main repo, the branch must exist in all repos):',
                this.context.options.git.featureBranchPrefix,
                true,
            );
        }

        // Prepare branch: validate branchName, ensure branch and spec exist
        await (await this.prepareBranch(branchName, baseBranch)).start();

        // Propose to open the branch in the configured IDE
        if (this.context.ides.length > 0) {
            const shouldOpen = await promptConfirm(`Open branch "${branchName}" in ${this.context.ides[0].name}?`);
            if (shouldOpen) {
                await this.open(branchName);
            }
        }
    }

    /**
     * List all branch worktrees with their git branches.
     */
    async list(prefix: string = ''): Promise<void> {
        let branchContexts = await this.context.loadActiveBranchesContexts();

        if (prefix) {
            branchContexts = branchContexts.filter((context) => context.branchName.startsWith(prefix));
        }

        // Display each branch with branch information
        console.log(
            `Active branch${branchContexts.length > 1 ? 'es' : ''}${prefix ? ` with prefix "${prefix}"` : ''}: (${branchContexts.length} found)`,
        );
        for (const branchContext of branchContexts) {
            // Collect branch information for this branch
            const repositoriesStatus = await branchContext.collectRepositoriesStatus();

            // Format branch information
            const {
                info: branchInfo,
                onExpectedBranch,
                isInconsistent,
            } = this.formatBranchContextRepositoriesStatus(branchContext, repositoriesStatus);

            // Use red color for inconsistent branches
            // Use orange color for branches that are not on the expected branch, but consistent across repos (e.g. all on "main" instead of the branch branch)
            // Use green color for branches that are on the expected branch
            const RED = '\x1b[31m';
            const ORANGE = '\x1b[33m';
            const GREEN = '\x1b[32m';
            const RESET = '\x1b[0m';
            const COLOR = isInconsistent ? RED : !onExpectedBranch ? ORANGE : GREEN;
            const output = `  - ${branchContext.branchName}${COLOR}${branchInfo}${RESET}`;

            console.log(output);
        }
    }

    /**
     * Resync all repos in a branch worktree to the correct branch.
     */
    async resync(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);
        const branchContext = await this.context.loadBranchContext(branchName);

        console.log(`Resyncing worktrees to branch \"${branchName}\"...`);

        let hasErrors = false;

        // Resync each repository worktree
        for (const repository of branchContext.repositories) {
            const hadError = await this.resyncRepository(branchContext, repository);
            if (hadError) {
                hasErrors = true;
            }
        }
        for (const rootRepository of this.context.repositories) {
            if (!branchContext.repositories.some((r) => r.rootRepository.name === rootRepository.name)) {
                console.log(`  ⚠ ${rootRepository.name}: not part of branch context, trying to init it`);
                const worktreeRepository = await branchContext.ensureWorktreeForRepo(rootRepository);
                worktreeRepository.setActiveSpec(branchContext);
                branchContext.repositories.push(worktreeRepository);
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
     * Stop a branch by removing its worktrees and clearing active pointer.
     */
    async stop(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);

        // Clean up any orphaned worktrees first
        await this.context.cleanOrphanedWorktrees(branchName);

        if (!(await this.context.isBranchActive(branchName))) {
            console.log(`Branch "${branchName}" is not active. Nothing to stop.`);
            return;
        }

        const branchContext = await this.context.loadBranchContext(branchName);

        // Verify clean state before stopping
        await branchContext.stop();

        // Clean up all worktrees and branch directory
        await branchContext.delete();
    }

    /**
     * Archive a branch by moving it from .branchs/<branchName>/ to .branchs/.archives/<branchName>/
     * and committing the change in the branch branch.
     */
    async archive(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);

        let branchContext: BranchContext = await this.context.getBranchContext(branchName);

        // First stop the branch to clean up worktrees and ensure there are no uncommitted changes, but don't delete the branch context yet
        await branchContext.stop();

        // Move the specs files to the archive folder and commit + merge
        await branchContext.archive();

        // Clean up all worktrees and branch directory
        await branchContext.delete();

        const confirmDeleteBranch = await promptConfirm(
            `Do you also want to delete the branch "${branchContext.branchName}" in all repos?\nThis cannot be undone, but you can always recreate the branch later if needed.`,
        );
        if (confirmDeleteBranch) {
            await branchContext.deleteBranch();
            console.log(`Branch "${branchContext.branchName}" deleted.`);
        } else {
            console.log(`Branch "${branchContext.branchName}" not deleted. You can delete it manually later if you change your mind.`);
        }
    }

    /**
     * Open a branch in the configured IDE.
     * If a workspace file exists, it will be opened; otherwise, the branch directory is opened.
     *
     * @param rawSlug - Optional branch slug. If not provided, finds the nearest branch context.
     * @throws {Error} If no IDE is configured
     */
    async open(rawSlug?: string): Promise<void> {
        // 1. Resolve feature context
        const branchContext = rawSlug
            ? await this.context.loadBranchContext(await confirmSlugOrThrow(rawSlug))
            : await BranchContext.findNearestBranchContext(this.context);

        // 2. Check that at least one IDE is configured
        if (!this.context.ides || this.context.ides.length === 0) {
            throw new Error('No IDE configured. Add an IDE to your .feat-forge.json configuration.');
        }

        // 3. Use the first IDE from the configuration
        const ide = this.context.ides[0];

        // 4. Resolve the CLI command
        const command = ide.openCommand || getDefaultIDECommand(ide.name);

        // 5. Determine the target to open
        const workspaceFile = branchContext.getInPath(await getWorkspaceFileName(branchContext.branchName, ide.name));
        const workspaceExists = await pathExists(workspaceFile);
        const target = workspaceExists ? workspaceFile : branchContext.path;

        // 6. Log informative messages
        if (!workspaceExists) {
            console.log('Workspace file not found, opening branch directory');
        }
        console.log(`Opening "${branchContext.branchName}" in ${ide.name}...`);

        // 7. Spawn the IDE process in detached mode
        const subprocess = execa(command, [target], { detached: true, stdio: 'ignore', cleanup: false });
        subprocess.unref();
        // Prevent unhandled rejection if command is not found
        subprocess.catch((error: Error) => {
            console.error(`Failed to open IDE: ${error.message}`);
            process.exitCode = 1;
        });
    }

    async merge(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);

        let targetRepos: RootRepository[];

        // If the feature is active, we only merge the repos that are part of the feature context (in case some configured repos were not part of the feature when it was started)
        // If the feature is not active, we merge all repos to ensure the feature branch is up to date everywhere.
        const isFeatureActive = await this.context.isBranchActive(branchName);
        if (isFeatureActive) {
            const branchContext = await this.context.loadBranchContext(branchName);
            // If the feature is active, we verify that all repos in the feature context are clean before merging
            await this.verifyCleanBranch(branchContext);
            targetRepos = branchContext.repositories.map((wtRepo) => wtRepo.rootRepository);
        } else {
            targetRepos = this.context.repositories;
        }

        const targetBranch = await promptForBranch(
            this.context.mainRepo.path,
            'Select target branch (showing branches of main repo, the branch must exist in all repos):',
            this.context.options.git.featureBranchPrefix,
            false,
        );
        console.log(`\nMerging : ${branchName}`);
        console.log(`\n📍 Target branch: ${targetBranch}\n`);

        let results: GitOperationResult[] = [];
        // Sequential merge for more readable logging.
        // Also merge commit editor will be opened sequentially, which is better UX than multiple merge commit editors opening at the same time if there are multiple repos to merge.
        for (const repo of targetRepos) {
            results.push(await repo.merge(branchName, targetBranch));
        }

        await this.displayMergeSummaryAndProposeAction(results, branchName);
    }

    async rebase(rawSlug: string): Promise<void> {
        const branchName = await confirmSlugOrThrow(rawSlug);

        let branchContext: BranchContext;
        let targetRepos: WorktreeRepository[];

        // If the feature is active, we only rebase the repos that are part of the feature context (in case some configured repos were not part of the feature when it was started)
        // If the feature is not active, we rebase all repos to ensure the feature branch is up to date everywhere.
        const isFeatureActive = await this.context.isBranchActive(branchName);
        if (!isFeatureActive) {
            throw new Error(
                `Branch "${branchName}" is not active. Rebase only possible on active branches. Do a "forge start ${branchName}" to start the branch first.`,
            );
        }
        branchContext = await this.context.loadBranchContext(branchName);
        // If the feature is active, we verify that all repos in the feature context are clean before rebasing
        await this.verifyCleanBranch(branchContext);
        targetRepos = branchContext.repositories;

        const baseBranch = await promptForBranch(
            this.context.mainRepo.path,
            'Select base branch (showing branches of main repo, the branch must exist in all repos):',
            this.context.options.git.featureBranchPrefix,
            true,
        );
        console.log(`\nRebasing branch: ${branchName}`);
        console.log(`\n📍 Base branch: ${baseBranch}\n`);

        let results: GitOperationResult[] = [];
        // Sequential rebase for more readable logging.
        // Also rebase commit editor will be opened sequentially, which is better UX than multiple rebase commit editors opening at the same time if there are multiple repos to rebase.
        for (const repo of targetRepos) {
            results.push(await repo.rebase(branchName, baseBranch));
        }

        await this.displayRebaseSummary(results, branchName);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Prepare branch + spec initialization shared by create/start.
     */
    private async prepareBranch(branchName: string, baseBranch?: string): Promise<BranchContext> {
        let invisibleRepoChanges = 0;

        // Ensure branch exists in all repos (creates branch if missing, but does not check it out)
        await this.context.ensureBranch(branchName, baseBranch); // doesn't realy count as changes

        let branchContext: BranchContext;
        if (await this.context.isBranchActive(branchName)) {
            // The branch is already active, load the real context
            branchContext = await this.context.loadBranchContext(branchName);
        } else {
            // The branch is not active yet, create an empty context to prepare the branch (this will create the spec files in a temporary location and merge them to the main branch, but won't create the worktrees yet)
            branchContext = this.context.makeBranchContext(branchName);
        }

        // Ensure branch spec files exist in the main repo branch, creating them in a temporary worktree if needed
        invisibleRepoChanges += await branchContext.initBranch();

        return branchContext;
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
    private formatBranchContextRepositoriesStatus(
        branchContext: BranchContext,
        repositoriesStatus: Record<RepoName, RepositoryStatus>,
    ): {
        info: string;
        onExpectedBranch: boolean;
        isInconsistent: boolean;
    } {
        const uniqueBranches = new Set(Object.values(repositoriesStatus).map((status) => status.branch));

        if (uniqueBranches.size === 0) {
            return { info: ' (no branch info)', isInconsistent: false, onExpectedBranch: false };
        }

        if (uniqueBranches.size === 1) {
            // All repos on same branch
            const currentBranch = Array.from(uniqueBranches)[0];
            return {
                info: ` (branch: ${currentBranch})`,
                isInconsistent: false,
                onExpectedBranch: currentBranch === branchContext.branchName,
            };
        }

        // Different branches across repos - show all
        const branchList = Object.entries(repositoriesStatus)
            .map(([repo, status]) => `${repo}: ${status.branch}`)
            .join(', ');
        return { info: ` (${branchList})`, isInconsistent: true, onExpectedBranch: false };
    }

    /**
     * Resync a single repository worktree to the expected branch.
     *
     * @param repoName - Name of the repository
     * @param worktreePath - Path to the worktree
     * @param expectedBranch - Expected branch name
     * @returns true if an error occurred, false otherwise
     */
    private async resyncRepository(branchContext: BranchContext, repository: WorktreeRepository): Promise<boolean> {
        // Check if worktree exists
        if (!(await pathExists(repository.path))) {
            console.log(`  ⚠ ${repository.name}: worktree not found, skipping`);
            return false;
        }
        const { branch, dirty, onExpectedBranch } = await repository.getStatus(branchContext.branchName);
        const expectedBranch = branchContext.branchName;

        // Check current branch
        if (onExpectedBranch) {
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

    /**
     * Display merge summary and propose next action to the user.
     *
     * Shows categorized results of all merge operations and, if all were successful,
     * prompts the user to choose what to do next with the feature.
     *
     * @param results - Array of merge results
     * @param branchName - The feature slug
     */
    private async displayMergeSummaryAndProposeAction(results: GitOperationResult[], branchName: string): Promise<void> {
        const { successful } = displayOperationSummary(results, GitOperation.Merge);

        // If all successful, propose next action
        if (successful.length === results.length) {
            await this.proposeNextAction(branchName);
        }
    }

    /**
     * Propose next action after successful merge and execute user's choice.
     *
     * Offers three options:
     * 1. Archive the branch (recommended) - moves to .archives
     * 2. Stop the branch - removes worktrees but keeps branches
     * 3. Do nothing - keeps branch active
     *
     * @param branchName - The branch name
     */
    private async proposeNextAction(branchName: string): Promise<void> {
        const selection = await promptChoice('What would you like to do next?', [
            { value: '1', name: 'Archive branch (recommended)' },
            { value: '2', name: 'Stop branch (keep branches)' },
            { value: '3', name: 'Do nothing (keep branch active)' },
        ]);

        switch (selection) {
            case '1':
                console.log(`\n📦 Archiving branch "${branchName}"...`);
                await this.archive(branchName);
                break;
            case '2':
                console.log(`\n⏸️  Stopping branch "${branchName}"...`);
                await this.stop(branchName);
                break;
            case '3':
                console.log('\n✅ Branch remains active. You can continue working on it.');
                break;
            default:
                console.log('\n✅ No action taken.');
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
    private async displayRebaseSummary(results: GitOperationResult[], slug: string): Promise<void> {
        displayOperationSummary(results, GitOperation.Rebase);
    }
}
