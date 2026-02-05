import { Command } from 'commander';
import { readdir, rm, symlink } from 'fs/promises';
import path from 'path';
import { Agent, ForgeContext, IDE } from '../lib/config';
import {
    getFeatureRoot,
    getFeatureWorktreePath,
    getTempArchiveRoot,
    getTempArchiveWorktreePath,
    getTempFeatureWorktreePath,
} from '../lib/feature';
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
import { activeFeatureFile, featureDir, featuresRoot } from '../lib/paths';
import { promptChoice, promptConfirm, promptText } from '../lib/prompt';
import { confirmSlugOrThrow } from '../lib/slug';
import { ensureAgentTemplates, FEATURE_FILES, resolveCustomTemplate, templateFor } from '../lib/templates';
import { AbstractCommands } from './abstract';
import { ModeCommands } from './mode';

export class FeatureCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a new feature folder and initialize missing spec files.
     */
    async create(slug: string): Promise<void> {
        await this.prepareFeature(slug);
    }

    /**
     * Switch to a feature branch/worktree and update active feature pointer.
     */
    async start(slug: string): Promise<void> {
        // Prepare feature: validate slug, ensure branch and spec exist
        const { safeSlug, branchName } = await this.prepareFeature(slug);

        const featureRoot = getFeatureRoot(this.config.worktreesRoot, safeSlug);
        await ensureDir(featureRoot);

        // Check if all worktrees already exist
        const worktreeTargets = this.config.repoRoots.map((repoRoot) => {
            const repoName = this.getRepoNameOrThrow(repoRoot);
            return getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, repoName);
        });

        const existingWorktrees = await Promise.all(worktreeTargets.map((worktreePath) => pathExists(worktreePath)));
        if (existingWorktrees.every(Boolean)) {
            // All worktrees exist - just set active feature and IDE workspaces
            await this.handleExistingWorktrees(safeSlug, featureRoot);
            return;
        }

        // Create new worktrees for all repos
        await this.createNewWorktrees(safeSlug, branchName);

        // Finalize: set active feature, mode, and IDE workspaces
        await this.finalizeFeatureStart(safeSlug, featureRoot);
    }

    /**
     * List all feature worktrees with their git branches.
     */
    async list(): Promise<void> {
        // Check if worktrees directory exists
        if (!(await pathExists(this.config.worktreesRoot))) {
            console.log('No features directory found.');
            return;
        }

        // Get list of feature directories
        const entries = await readdir(this.config.worktreesRoot, { withFileTypes: true });
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
    async resync(slug: string): Promise<void> {
        const safeSlug = await confirmSlugOrThrow(slug);
        const featureRoot = getFeatureRoot(this.config.worktreesRoot, safeSlug);

        // Verify feature directory exists
        if (!(await pathExists(featureRoot))) {
            throw new Error(`Feature worktree not found: ${safeSlug}`);
        }

        const expectedBranch = `feature/${safeSlug}`;
        console.log(`Resyncing feature \"${safeSlug}\" to branch \"${expectedBranch}\"...`);

        let hasErrors = false;

        // Resync each repository worktree
        for (const repoRoot of this.config.repoRoots) {
            const repoName = this.config.repoNames.get(repoRoot);
            if (!repoName) continue;

            const worktreePath = getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, repoName);
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
    async stop(slug: string): Promise<void> {
        const safeSlug = await confirmSlugOrThrow(slug);
        const branchName = `feature/${safeSlug}`;

        // Clean up any orphaned worktrees first
        await this.cleanupOrphanedWorktrees(branchName);

        // Check for uncommitted changes in worktrees
        const dirtyWorktrees = await this.checkDirtyWorktrees(safeSlug);

        // Handle dirty worktrees if any exist
        if (dirtyWorktrees.length > 0) {
            const shouldProceed = await this.handleDirtyWorktrees(dirtyWorktrees);
            if (!shouldProceed) {
                return;
            }
        }

        // Clean up all worktrees and feature directory
        await this.cleanupFeatureWorktrees(safeSlug);
    }

    /**
     * Archive a feature by moving it from .features/<slug>/ to .features/.archives/<slug>/
     * and committing the change in the feature branch.
     */
    async archive(slug: string): Promise<void> {
        const safeSlug = await confirmSlugOrThrow(slug);
        const branchName = `feature/${safeSlug}`;

        // Verify feature branch exists
        if (!(await gitBranchExists(this.config.mainRepoRoot, branchName))) {
            throw new Error(`Feature branch \"${branchName}\" does not exist in main repo.`);
        }

        // Determine which worktree to use (existing or create temporary)
        let workingWorktree: string;
        try {
            workingWorktree = await this.determineArchiveWorktree(safeSlug, branchName);
        } catch (error) {
            // Early return if worktree has uncommitted changes
            if (error instanceof Error && error.message === 'Feature has uncommitted changes') {
                return;
            }
            throw error;
        }

        try {
            // Perform the archive operation
            await this.performArchiveOperation(workingWorktree, safeSlug);

            // Display success message
            console.log(`✓ Feature \"${safeSlug}\" archived successfully.`);
            console.log(`  Moved: .features/${safeSlug}/ → .features/.archives/${safeSlug}/`);
            console.log(`\nNext steps:`);
            console.log(`  - Merge branch \"${branchName}\" to main`);
            console.log(`  - Delete branch \"${branchName}\" if no longer needed`);
        } finally {
            // Clean up all worktrees for all repos
            await this.cleanupFeatureWorktrees(safeSlug);
        }
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Retrieve the repository name for a given root path.
     *
     * Looks up the repository name from the repoNames map and throws
     * a descriptive error if not found.
     *
     * @param repoRoot - Root path of the repository
     * @returns The repository name
     * @throws Error if repository name is not found in the map
     */
    private getRepoNameOrThrow(repoRoot: string): string {
        const repoName = this.config.repoNames.get(repoRoot);
        if (!repoName) {
            throw new Error(`Missing repo name for ${repoRoot}`);
        }
        return repoName;
    }

    /**
     * Resolve the configured main repo name or throw if missing.
     *
     * @returns The main repository name
     * @throws Error if main repository name is not found
     */
    private getMainRepoName(): string {
        return this.getRepoNameOrThrow(this.config.mainRepoRoot);
    }

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
        return this.config.repoRoots.map((repoRoot) => {
            const repoName = this.getRepoNameOrThrow(repoRoot);
            return { repoRoot, repoName, worktreePath: getFeatureWorktreePath(this.config.worktreesRoot, slug, repoName) };
        });
    }

    /**
     * Prepare feature branch + spec initialization shared by create/start.
     */
    private async prepareFeature(slug: string): Promise<{
        safeSlug: string;
        branchName: string;
    }> {
        const safeSlug = await confirmSlugOrThrow(slug);
        const branchName = `feature/${safeSlug}`;

        // Ensure agent templates exist in .features/.template/agent/
        await ensureAgentTemplates(this.config.mainRepoRoot);

        // Ensure .gitignore includes .active-feature in all repos to avoid accidentally committing active feature pointers
        await ensureGitIgnore(this.config.repoRoots);

        // Ensure feature branch exists in all repos (creates branch if missing, but does not check it out)
        for (const repoRoot of this.config.repoRoots) {
            await this.ensureBranchExists(repoRoot, branchName);
        }

        const mainRepoName = this.getMainRepoName();
        // Init spec files in main repo branch if they don't exist (using a temporary worktree to avoid affecting user's current worktree)
        await this.initSpecInBranch(this.config.mainRepoRoot, mainRepoName, safeSlug, branchName, this.config.rootDir);

        return { safeSlug, branchName };
    }

    /**
     * Set initial mode to spec if no mode is defined yet in the feature
     */
    private async setInitialMode(featureRoot: string, featurePath: string): Promise<void> {
        // Use ModeCommands to set spec mode if not already defined
        const modeCommands = new ModeCommands(this.config);
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
        const featurePaths = FEATURE_FILES.map((fileName) => path.posix.join('.features', slug, fileName));
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
            const featurePath = featureDir(tempWorktree, slug);
            await this.ensureFeatureFiles(tempWorktree, featurePath);
            await runGit(tempWorktree, ['add', path.join('.features', slug)]);

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
        const mainWorktree = getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, mainRepoName);

        // Build secondary worktrees paths (all repos except main)
        const secondaryWorktrees = this.config.repoRoots
            .filter((r) => this.config.repoNames.get(r) !== mainRepoName)
            .map((r) => getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, this.config.repoNames.get(r)!));

        // Set active feature pointer
        await this.setActiveFeature(mainWorktree, secondaryWorktrees, mainRepoName, safeSlug);

        // Create IDE workspaces if configured
        if (this.config.ides.length > 0) {
            await createIDEWorkspaces(
                safeSlug,
                featureRoot,
                mainRepoName,
                this.config.repoNames,
                this.config.ides,
                this.config.agents,
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
        for (const repoRoot of this.config.repoRoots) {
            const repoName = this.getRepoNameOrThrow(repoRoot);
            const worktreePath = getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, repoName);

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
     * Finalize feature start by setting active feature, mode, and IDE workspaces.
     *
     * @param safeSlug - Validated feature slug
     * @param featureRoot - Root directory for the feature
     */
    private async finalizeFeatureStart(safeSlug: string, featureRoot: string): Promise<void> {
        const mainRepoName = this.getMainRepoName();

        // Build worktree paths
        const mainWorktree = getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, mainRepoName);
        const secondaryWorktrees = this.config.repoRoots
            .filter((r) => this.config.repoNames.get(r) !== mainRepoName)
            .map((r) => getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, this.config.repoNames.get(r)!));

        // Set active feature pointer
        await this.setActiveFeature(mainWorktree, secondaryWorktrees, mainRepoName, safeSlug);

        // Set initial mode to spec if not defined
        const featurePath = featureDir(mainWorktree, safeSlug);
        await this.setInitialMode(featureRoot, featurePath);

        // Create IDE workspaces if configured
        if (this.config.ides.length > 0) {
            await createIDEWorkspaces(
                safeSlug,
                featureRoot,
                mainRepoName,
                this.config.repoNames,
                this.config.ides,
                this.config.agents,
            );
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

        for (const repoRoot of this.config.repoRoots) {
            const repoName = this.config.repoNames.get(repoRoot);
            if (!repoName) continue;

            const worktreePath = getFeatureWorktreePath(this.config.worktreesRoot, slug, repoName);
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

        for (const repoRoot of this.config.repoRoots) {
            const repoName = this.config.repoNames.get(repoRoot);
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

        // Filter to find worktrees with uncommitted changes
        const dirtyWorktrees = [];
        for (const worktree of worktrees) {
            if (!(await pathExists(worktree.worktreePath))) {
                continue;
            }
            const status = await getGitStatusPorcelain(worktree.worktreePath);
            if (status) {
                dirtyWorktrees.push(worktree);
            }
        }

        return dirtyWorktrees;
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

        const featureRoot = getFeatureRoot(this.config.worktreesRoot, slug);
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
        const existingMainWorktree = getFeatureWorktreePath(this.config.worktreesRoot, safeSlug, mainRepoName);

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
        const workingWorktree = getTempArchiveWorktreePath(this.config.rootDir, safeSlug, mainRepoName);
        await ensureDir(path.dirname(workingWorktree));

        if (await pathExists(workingWorktree)) {
            throw new Error(`Temp worktree already exists at ${workingWorktree}`);
        }

        await runGit(this.config.mainRepoRoot, ['worktree', 'add', workingWorktree, branchName]);
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
        const featurePath = path.join(workingWorktree, '.features', safeSlug);
        const archivePath = path.join(workingWorktree, '.features', '.archives', safeSlug);

        // Verify feature folder exists
        if (!(await pathExists(featurePath))) {
            throw new Error(`Feature folder not found in branch: .features/${safeSlug}/`);
        }

        // Verify not already archived
        if (await pathExists(archivePath)) {
            throw new Error(`Feature already archived: .features/.archives/${safeSlug}/`);
        }

        // Create archives directory
        await ensureDir(path.join(workingWorktree, '.features', '.archives'));

        // Move feature to archive using git mv
        await runGit(workingWorktree, ['mv', featurePath, archivePath]);

        // Commit the archive
        await runGit(workingWorktree, ['commit', '-m', `docs(${safeSlug}): archive feature`]);
    }

    /**
     * Update the active feature pointers:
     * - Main repo: .active-feature → .features/<slug>/
     * - Secondary repos: .active-feature → ../main-repo/.active-feature
     */
    private async setActiveFeature(
        mainRepoWorktree: string,
        secondaryRepoWorktrees: string[],
        mainRepoName: string,
        slug: string,
    ): Promise<void> {
        // Set .active-feature in main repo pointing to .features/<slug>/
        await ensureDir(featuresRoot(mainRepoWorktree));
        const mainActivePath = activeFeatureFile(mainRepoWorktree);
        await rm(mainActivePath, { force: true });
        await symlink(path.join('.features', slug), mainActivePath);

        // Set .active-feature in secondary repos pointing to main repo's .active-feature
        for (const secondaryWorktree of secondaryRepoWorktrees) {
            const secondaryActivePath = activeFeatureFile(secondaryWorktree);
            await rm(secondaryActivePath, { force: true });
            // Create relative path from secondary to main's .active-feature
            const relativePathToMain = path.join('..', mainRepoName, '.active-feature');
            await symlink(relativePathToMain, secondaryActivePath);
        }
    }

    /**
     * Ensure the spec files exist for a feature directory without overwriting existing files.
     * Also creates the agent subdirectory (empty, ready for symlinks).
     */
    private async ensureFeatureFiles(repoRoot: string, targetDir: string): Promise<void> {
        await ensureDir(targetDir);

        // Create main feature files
        for (const fileName of FEATURE_FILES) {
            const filePath = path.join(targetDir, fileName);
            if (await pathExists(filePath)) {
                continue;
            }
            const resolved = await resolveCustomTemplate(this.config.rootDir, repoRoot, fileName);
            await writeTextFile(filePath, resolved ?? templateFor(fileName));
        }

        // Create agent subdirectory (but don't populate with templates)
        // Templates will be accessed via symlinks to .features/.template/agent/
        const agentDir = path.join(targetDir, 'agent');
        await ensureDir(agentDir);
    }
}
