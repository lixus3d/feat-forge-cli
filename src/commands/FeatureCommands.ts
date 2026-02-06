import { readdir, rm, symlink } from 'fs/promises';
import path from 'path';
import { SPECS_FEATURES_FOLDER } from '../lib/constants';
import { ensureDir, ensureGitIgnore, pathExists, writeTextFile } from '../lib/fs';
import {
    checkoutBranch,
    getCurrentBranch,
    getGitStatusPorcelain,
    getWorktrees,
    gitBranchExists,
    gitPathExistsInBranch,
    removeOrphanedWorktree,
    runGit,
} from '../lib/git';
import { createIDEWorkspaces } from '../lib/ide';
import {
    activeFeatureFolder,
    getFeatureRoot,
    getRelativeFeaturesArchivePath,
    getRelativeFeatureSpecPath,
    getRepoPathInFeature,
    getTempArchiveWorktreePath,
    getTempFeatureWorktreePath,
    specsFeatureDir,
    specsFeaturesRoot,
} from '../foundation/PathHelper';
import { promptChoice, promptConfirm, promptText } from '../lib/prompt';
import { confirmSlugOrThrow } from '../lib/slug';
import { ensureAgentTemplates, FEATURE_FILES, resolveCustomTemplate, templateFor } from '../lib/templates';
import { AbstractCommands } from './AbstractCommands';
import { ModeCommands } from './ModeCommands';
import { FeatureContext } from '../foundation/FeatureContext';

export class FeatureCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a new feature folder and initialize missing spec files.
     * Does not create worktrees or set active feature - use `start` for that.
     * But it merge spec files to main branch to ensure they are available for users who don't use worktrees and for the feature context.
     */
    async create(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        await this.prepareFeature(slug, true);
    }

    /**
     * Switch to a feature branch/worktree and update active feature pointer.
     */
    async start(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        // Prepare feature: validate slug, ensure branch and spec exist
        (await this.prepareFeature(slug, false)).start();
    }

    /**
     * List all feature worktrees with their git branches.
     */
    async list(): Promise<void> {
        // Check if worktrees directory exists
        if (!(await pathExists(this.context.worktreesRoot))) {
            console.log('No features directory found.');
            return;
        }

        // Get list of feature directories
        const entries = await readdir(this.context.worktreesRoot, { withFileTypes: true });
        const featureDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

        if (featureDirs.length === 0) {
            console.log('No feature worktrees found.');
            return;
        }

        // Display each feature with branch information
        console.log('Feature worktrees:');
        for (const slug of featureDirs.sort()) {
            // Collect branch information for this feature
            const branches = await this.collectFeatureBranches(slug);

            // Format branch information
            const { info: branchInfo, isInconsistent } = this.formatBranchInfo(branches);

            // Use red color for inconsistent branches
            const RED = '\\x1b[31m';
            const RESET = '\\x1b[0m';
            const output = isInconsistent ? `  - ${slug}${RED}${branchInfo}${RESET}` : `  - ${slug}${branchInfo}`;

            console.log(output);
        }
    }

    /**
     * Resync all repos in a feature worktree to the correct branch.
     */
    async resync(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        const featureRoot = getFeatureRoot(this.context.worktreesRoot, slug);

        // Verify feature directory exists
        if (!(await pathExists(featureRoot))) {
            throw new Error(`Feature worktree not found: ${slug}`);
        }

        const expectedBranch = `feature/${slug}`;
        console.log(`Resyncing feature \"${slug}\" to branch \"${expectedBranch}\"...`);

        let hasErrors = false;

        // Resync each repository worktree
        for (const repoRoot of this.context.repoRoots) {
            const repoName = this.context.repoNames.get(repoRoot);
            if (!repoName) continue;

            const worktreePath = getRepoPathInFeature(this.context.worktreesRoot, slug, repoName);
            const hadError = await this.resyncSingleWorktree(repoName, worktreePath, expectedBranch);
            if (hadError) {
                hasErrors = true;
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
        const branchName = `feature/${slug}`;

        // Clean up any orphaned worktrees first
        await this.cleanupOrphanedWorktrees(branchName);

        // Check for uncommitted changes in worktrees
        const dirtyWorktrees = await this.checkDirtyWorktrees(slug);

        // Handle dirty worktrees if any exist
        if (dirtyWorktrees.length > 0) {
            const shouldProceed = await this.handleDirtyWorktrees(dirtyWorktrees);
            if (!shouldProceed) {
                return;
            }
        }

        // Clean up all worktrees and feature directory
        await this.cleanupFeatureWorktrees(slug);
    }

    /**
     * Archive a feature by moving it from .features/<slug>/ to .features/.archives/<slug>/
     * and committing the change in the feature branch.
     */
    async archive(rawSlug: string): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        const branchName = `feature/${slug}`;

        // Verify feature branch exists
        if (!(await gitBranchExists(this.context.mainRepoRoot, branchName))) {
            throw new Error(`Feature branch \"${branchName}\" does not exist in main repo.`);
        }

        // Determine which worktree to use (existing or create temporary)
        let workingWorktree: string;
        try {
            workingWorktree = await this.determineArchiveWorktree(slug, branchName);
        } catch (error) {
            // Early return if worktree has uncommitted changes
            if (error instanceof Error && error.message === 'Feature has uncommitted changes') {
                return;
            }
            throw error;
        }

        try {
            // Perform the archive operation
            await this.performArchiveOperation(workingWorktree, slug);

            // Display success message
            console.log(`✓ Feature \"${slug}\" archived successfully.`);
            console.log(`  Moved: ${SPECS_FEATURES_FOLDER}/${slug}/ → ${SPECS_FEATURES_FOLDER}/.archives/${slug}/`);
            console.log(`\nNext steps:`);
            console.log(`  - Merge branch \"${branchName}\" to main`);
            console.log(`  - Delete branch \"${branchName}\" if no longer needed`);
        } finally {
            // Clean up all worktrees for all repos
            await this.cleanupFeatureWorktrees(slug);
        }
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Build a list of worktree metadata for a given feature across all repos.
     *
     * Maps each repository root to its worktree path and metadata for the feature.
     *
     * @param slug - Feature slug identifier
     * @returns Array of worktree metadata objects
     * @throws Error if any repository name is not found in the map
     */
    private buildWorktreeList(slug: string): Array<{ repoRoot: string; repoName: string; worktreePath: string }> {
        return this.context.repoRoots.map((repoRoot) => {
            const repoName = this.getRepoNameOrThrow(repoRoot);
            return { repoRoot, repoName, worktreePath: getRepoPathInFeature(this.context.worktreesRoot, slug, repoName) };
        });
    }

    /**
     * Prepare feature branch + spec initialization shared by create/start.
     */
    private async prepareFeature(slug: string, mergeToRoot: boolean = false): Promise<FeatureContext> {
        // Ensure agent templates exist in .features/.template/agent/
        await this.context.ensureAgentTemplates();

        // Ensure .gitignore includes .active-feature in all repos to avoid accidentally committing active feature pointers
        await this.context.ensureGitIgnore();

        // Ensure feature branch exists in all repos (creates branch if missing, but does not check it out)
        await this.context.ensureFeatureBranch(slug);

        // Ensure feature spec files exist in the main repo branch, creating them in a temporary worktree if needed
        await this.context.initFeatureSpecFiles(slug, mergeToRoot);

        return this.context.makeFeatureContext(slug);
    }

    /**
     * Set initial mode to spec if no mode is defined yet in the feature
     */
    private async setInitialMode(featureRoot: string, featurePath: string): Promise<void> {
        // Use ModeCommands to set spec mode if not already defined
        const modeCommands = new ModeCommands(this.context);
        await modeCommands.setInitialModeIfNeeded(featureRoot, featurePath);
    }

    /**
     * Ensure the feature branch exists for a repo, without checking it out.
     */
    private async ensureBranchExists(repoRoot: string, branchName: string): Promise<void> {
        if (await gitBranchExists(repoRoot, branchName)) {
            return;
        }
        await runGit(repoRoot, ['branch', branchName]);
    }

    /**
     * Initialize feature spec files in the main repo branch using a temporary worktree.
     */
    private async initSpecInBranch(
        repoRoot: string,
        repoName: string,
        slug: string,
        branchName: string,
        rootDir: string,
    ): Promise<void> {
        const featurePaths = FEATURE_FILES.map((fileName) => path.posix.join(SPECS_FEATURES_FOLDER, slug, fileName));
        const existing = await Promise.all(
            featurePaths.map((featurePath) => gitPathExistsInBranch(repoRoot, branchName, featurePath)),
        );
        if (existing.every(Boolean)) {
            return;
        }

        const tempWorktree = getTempFeatureWorktreePath(rootDir, slug, repoName);
        await ensureDir(path.dirname(tempWorktree));
        if (await pathExists(tempWorktree)) {
            throw new Error(`Temp worktree already exists at ${tempWorktree}`);
        }

        await runGit(repoRoot, ['worktree', 'add', tempWorktree, branchName]);
        try {
            const featurePath = specsFeatureDir(tempWorktree, slug);
            await this.ensureFeatureFiles(tempWorktree, featurePath);
            await runGit(tempWorktree, ['add', getRelativeFeatureSpecPath(slug, '*')]);

            const status = await getGitStatusPorcelain(tempWorktree);
            if (status) {
                await runGit(tempWorktree, ['commit', '-m', `docs(${slug}): init feature spec`]);
            }
        } finally {
            await runGit(repoRoot, ['worktree', 'remove', '--force', tempWorktree]);
            // Cleanup temp directory
            await rm(tempWorktree, { recursive: true, force: true });
        }
    }

    /**
     * Handle the case where worktrees already exist for a feature.
     *
     * Sets the active feature, creates IDE workspaces, and notifies the user.
     *
     * @param safeSlug - Validated feature slug
     * @param featureRoot - Root directory for the feature
     */
    private async handleExistingWorktrees(safeSlug: string, featureRoot: string): Promise<void> {
        const mainRepoName = this.getMainRepoName();

        // Build main worktree path
        const mainWorktree = getRepoPathInFeature(this.context.worktreesRoot, safeSlug, mainRepoName);

        // Build secondary worktrees paths (all repos except main)
        const secondaryWorktrees = this.getSecondaryRepoRoots().map((r) =>
            getRepoPathInFeature(this.context.worktreesRoot, safeSlug, this.getRepoNameOrThrow(r)),
        );

        // Set active feature pointer
        await this.setActiveFeature(mainWorktree, secondaryWorktrees, mainRepoName, safeSlug);

        // Create IDE workspaces if configured
        if (this.context.ides.length > 0) {
            await createIDEWorkspaces(
                safeSlug,
                featureRoot,
                mainRepoName,
                this.context.repoNames,
                this.context.ides,
                this.context.agents,
            );
        }

        console.log(`Feature "${safeSlug}" already started.`);
    }

    /**
     * Create new worktrees for all repos in a feature.
     *
     * For each repository, creates a worktree at the appropriate path,
     * either checking out an existing branch or creating a new one.
     *
     * @param safeSlug - Validated feature slug
     * @param branchName - Name of the feature branch
     * @throws Error if a worktree path unexpectedly already exists
     */
    private async createNewWorktrees(safeSlug: string, branchName: string): Promise<void> {
        for (const repoRoot of this.context.repoRoots) {
            const repoName = this.getRepoNameOrThrow(repoRoot);
            const worktreePath = getRepoPathInFeature(this.context.worktreesRoot, safeSlug, repoName);

            // Check if worktree unexpectedly exists
            if (await pathExists(worktreePath)) {
                throw new Error(
                    `Worktree already exists at ${worktreePath}.\\n` +
                        `If you have manually deleted worktree folders, run 'forge feature stop ${safeSlug}' to clean up.`,
                );
            }

            // Create worktree (checkout existing branch or create new one)
            if (await gitBranchExists(repoRoot, branchName)) {
                await runGit(repoRoot, ['worktree', 'add', worktreePath, branchName]);
            } else {
                await runGit(repoRoot, ['worktree', 'add', '-b', branchName, worktreePath]);
            }
        }
    }

    /**
     * Collect branch information for a feature across all repos.
     *
     * @param slug - Feature slug
     * @returns Map of repository names to branch names
     */
    private async collectFeatureBranches(slug: string): Promise<Map<string, string>> {
        const branches: Map<string, string> = new Map();

        for (const repoRoot of this.context.repoRoots) {
            const repoName = this.context.repoNames.get(repoRoot);
            if (!repoName) continue;

            const worktreePath = getRepoPathInFeature(this.context.worktreesRoot, slug, repoName);
            if (await pathExists(worktreePath)) {
                const branch = await getCurrentBranch(worktreePath);
                if (branch) {
                    branches.set(repoName, branch);
                }
            }
        }

        return branches;
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
    private formatBranchInfo(branches: Map<string, string>): { info: string; isInconsistent: boolean } {
        const uniqueBranches = new Set(branches.values());

        if (uniqueBranches.size === 0) {
            return { info: ' (no branch info)', isInconsistent: false };
        }

        if (uniqueBranches.size === 1) {
            // All repos on same branch
            return { info: ` (branch: ${Array.from(uniqueBranches)[0]})`, isInconsistent: false };
        }

        // Different branches across repos - show all
        const branchList = Array.from(branches.entries())
            .map(([repo, branch]) => `${repo}: ${branch}`)
            .join(', ');
        return { info: ` (${branchList})`, isInconsistent: true };
    }

    /**
     * Resync a single repository worktree to the expected branch.
     *
     * @param repoName - Name of the repository
     * @param worktreePath - Path to the worktree
     * @param expectedBranch - Expected branch name
     * @returns true if an error occurred, false otherwise
     */
    private async resyncSingleWorktree(repoName: string, worktreePath: string, expectedBranch: string): Promise<boolean> {
        // Check if worktree exists
        if (!(await pathExists(worktreePath))) {
            console.log(`  ⚠ ${repoName}: worktree not found, skipping`);
            return false;
        }

        // Check current branch
        const currentBranch = await getCurrentBranch(worktreePath);
        if (currentBranch === expectedBranch) {
            console.log(`  ✓ ${repoName}: already on ${expectedBranch}`);
            return false;
        }

        // Check for uncommitted changes
        const status = await getGitStatusPorcelain(worktreePath);
        if (status) {
            console.log(`  ✗ ${repoName}: has uncommitted changes, cannot switch branch`);
            return true;
        }

        // Check if expected branch exists
        if (!(await gitBranchExists(worktreePath, expectedBranch))) {
            console.log(`  ✗ ${repoName}: branch ${expectedBranch} does not exist`);
            return true;
        }

        // Attempt to checkout expected branch
        try {
            await checkoutBranch(worktreePath, expectedBranch);
            console.log(`  ✓ ${repoName}: switched from ${currentBranch} to ${expectedBranch}`);
            return false;
        } catch (error) {
            console.log(`  ✗ ${repoName}: failed to checkout ${expectedBranch}`);
            return true;
        }
    }

    /**
     * Clean up orphaned worktrees for a feature across all repos.
     *
     * An orphaned worktree is registered in git but its directory no longer exists.
     *
     * @param branchName - Name of the feature branch
     */
    private async cleanupOrphanedWorktrees(branchName: string): Promise<void> {
        console.log('Checking for orphaned worktrees...');

        for (const repoRoot of this.context.repoRoots) {
            const repoName = this.context.repoNames.get(repoRoot);
            if (!repoName) continue;

            // Get all worktrees for this repo
            const worktrees = await getWorktrees(repoRoot);

            // Remove orphaned worktrees for our feature branch
            for (const worktree of worktrees) {
                if (worktree.branch === branchName && !(await pathExists(worktree.path))) {
                    console.log(`  Removing orphaned worktree for ${repoName}: ${worktree.path}`);
                    try {
                        await removeOrphanedWorktree(repoRoot, worktree.path);
                    } catch (error) {
                        console.log(`  Warning: Could not remove orphaned worktree: ${error}`);
                    }
                }
            }
        }
    }

    /**
     * Handle dirty worktrees by prompting user for action and executing it.
     *
     * @param dirtyWorktrees - Array of dirty worktree metadata
     * @returns true if cleanup should proceed, false if user cancelled
     */
    private async handleDirtyWorktrees(
        dirtyWorktrees: Array<{ repoRoot: string; repoName: string; worktreePath: string }>,
    ): Promise<boolean> {
        // Prompt user for action
        const action = await this.promptDirtyAction();

        // User chose to cancel
        if (action === 'B') {
            return false;
        }

        // User chose to commit changes
        if (action === 'A') {
            const message = await promptText('Commit message to use');
            if (!message) {
                throw new Error('Commit message is required.');
            }

            // Commit changes in each dirty worktree
            for (const worktree of dirtyWorktrees) {
                await runGit(worktree.worktreePath, ['add', '-A']);
                await runGit(worktree.worktreePath, ['commit', '-m', message]);

                // Verify worktree is now clean
                const status = await getGitStatusPorcelain(worktree.worktreePath);
                if (status) {
                    throw new Error(`Worktree still dirty after commit: ${worktree.worktreePath}`);
                }
            }
        }

        // User chose to discard changes
        if (action === 'C') {
            const confirmed = await promptConfirm('This will discard local changes. Proceed?');
            if (!confirmed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check all worktrees for a feature and return which ones are dirty.
     */
    private async checkDirtyWorktrees(slug: string): Promise<Array<{ repoRoot: string; repoName: string; worktreePath: string }>> {
        // Build list of all worktrees for this feature
        const worktrees = this.buildWorktreeList(slug);

        // Filter to existing worktrees only
        const existingWorktrees = [];
        for (const worktree of worktrees) {
            if (await pathExists(worktree.worktreePath)) {
                existingWorktrees.push(worktree);
            }
        }

        // Use common method to find dirty worktrees
        return this.findDirtyWorktrees(existingWorktrees);
    }

    /**
     * Clean up all worktrees and feature root directory.
     */
    private async cleanupFeatureWorktrees(slug: string): Promise<void> {
        // Build list of all worktrees for this feature
        const worktrees = this.buildWorktreeList(slug);

        // Remove each worktree
        for (const worktree of worktrees) {
            if (await pathExists(worktree.worktreePath)) {
                await runGit(worktree.repoRoot, ['worktree', 'remove', '--force', worktree.worktreePath]);
            }
        }

        const featureRoot = getFeatureRoot(this.context.worktreesRoot, slug);
        if (await pathExists(featureRoot)) {
            await rm(featureRoot, { recursive: true, force: true });
        }
    }

    /**
     * Prompt the user for a dirty-worktree action until a valid answer is provided.
     */
    private async promptDirtyAction(): Promise<'A' | 'B' | 'C'> {
        while (true) {
            const answer = await promptChoice('Worktrees contain uncommitted changes. Choose an action:', [
                { key: 'A', label: 'Commit work in all dirty worktrees' },
                { key: 'B', label: 'Stop here and do nothing' },
                { key: 'C', label: 'Discard work and remove worktrees' },
            ]);

            const normalized = answer.trim().toUpperCase();
            if (normalized === 'A' || normalized === 'B' || normalized === 'C') {
                return normalized;
            }
        }
    }

    /**
     * Determine which worktree to use for archiving (existing or temporary).
     *
     * @param safeSlug - Validated feature slug
     * @param branchName - Name of the feature branch
     * @returns Worktree path to use for archiving
     * @throws Error if worktree has uncommitted changes or temp worktree exists
     */
    private async determineArchiveWorktree(safeSlug: string, branchName: string): Promise<string> {
        const mainRepoName = this.getMainRepoName();
        const existingMainWorktree = getRepoPathInFeature(this.context.worktreesRoot, safeSlug, mainRepoName);

        // Check if existing worktree is available
        if (await pathExists(existingMainWorktree)) {
            // Verify worktrees are clean before archiving
            const dirtyWorktrees = await this.checkDirtyWorktrees(safeSlug);

            if (dirtyWorktrees.length > 0) {
                console.log('\\n⚠ Cannot archive feature with uncommitted changes:');
                for (const worktree of dirtyWorktrees) {
                    console.log(`  - ${worktree.repoName}`);
                }
                console.log("\nPlease commit or discard changes, or use 'forge feature stop' first.");
                throw new Error('Feature has uncommitted changes');
            }

            // Use existing clean worktree
            return existingMainWorktree;
        }

        // Create temporary worktree for archiving
        const workingWorktree = getTempArchiveWorktreePath(this.context.rootDir, safeSlug, mainRepoName);
        await ensureDir(path.dirname(workingWorktree));

        if (await pathExists(workingWorktree)) {
            throw new Error(`Temp worktree already exists at ${workingWorktree}`);
        }

        await runGit(this.context.mainRepoRoot, ['worktree', 'add', workingWorktree, branchName]);
        return workingWorktree;
    }

    /**
     * Perform the archive operation: move feature folder and commit.
     *
     * @param workingWorktree - Path to the worktree to use for archiving
     * @param safeSlug - Validated feature slug
     * @throws Error if feature folder doesn't exist or is already archived
     */
    private async performArchiveOperation(workingWorktree: string, safeSlug: string): Promise<void> {
        const featurePath = path.join(workingWorktree, getRelativeFeatureSpecPath(safeSlug));
        const archivePath = path.join(workingWorktree, getRelativeFeaturesArchivePath(safeSlug));

        // Verify feature folder exists
        if (!(await pathExists(featurePath))) {
            throw new Error(`Feature folder not found in branch: ${getRelativeFeatureSpecPath(safeSlug)}/`);
        }

        // Verify not already archived
        if (await pathExists(archivePath)) {
            throw new Error(`Feature already archived: ${getRelativeFeaturesArchivePath(safeSlug)}/`);
        }

        // Create archives directory
        await ensureDir(path.join(workingWorktree, getRelativeFeaturesArchivePath()));

        // Move feature to archive using git mv
        await runGit(workingWorktree, ['mv', featurePath, archivePath]);

        // Commit the archive
        await runGit(workingWorktree, ['commit', '-m', `docs(${safeSlug}): archive feature`]);
    }
}
