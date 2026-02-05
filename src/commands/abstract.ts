import { ForgeContext } from '../lib/config';
import { getFeatureWorktreePath } from '../lib/feature';
import { promptChoice, promptText } from '../lib/prompt';
import { getGitStatusPorcelain, gitBranchExists } from '../lib/git';
import { execa } from 'execa';

/**
 * Result of a git operation (merge/rebase) for a single repository
 */
export type GitOperationResult = {
    repo: string;
    success: boolean;
    hasConflicts: boolean;
};

/**
 * Minimal worktree information for git operations
 */
export type WorktreeInfo = {
    repoRoot: string;
    worktreePath: string;
};

/**
 * Information about a feature worktree
 */
export type FeatureWorktree = WorktreeInfo & {
    featureBranch: string;
};

/**
 * Base class for command handlers with required configuration.
 */
export abstract class AbstractCommands {
    protected readonly config: ForgeContext;

    constructor(config: ForgeContext) {
        this.config = config;
    }

    /**
     * Discover all repositories that have a branch for this feature.
     *
     * Iterates through all configured repos and checks if a feature branch exists.
     * Returns information about each worktree.
     *
     * @param slug - The feature slug
     * @returns Array of feature worktrees
     * @throws Error if no feature branches are found
     */
    protected async discoverFeatureWorktrees(slug: string): Promise<FeatureWorktree[]> {
        const featureWorktrees: FeatureWorktree[] = [];

        for (const repoRoot of this.config.repoRoots) {
            const repoName = this.getRepoNameOrThrow(repoRoot);
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
            console.log(`  - ${this.getRepoNameOrThrow(wt.repoRoot)} (${wt.featureBranch})`);
        }
        console.log();

        return featureWorktrees;
    }

    /**
     * Find all worktrees with uncommitted changes.
     *
     * @param worktrees - Array of worktrees to check
     * @returns Array of dirty worktrees
     */
    protected async findDirtyWorktrees<T extends WorktreeInfo>(
        worktrees: T[],
    ): Promise<T[]> {
        const dirtyWorktrees: T[] = [];

        for (const wt of worktrees) {
            const status = await getGitStatusPorcelain(wt.worktreePath);
            if (status.length > 0) {
                dirtyWorktrees.push(wt);
            }
        }

        return dirtyWorktrees;
    }

    /**
     * Verify that all working trees are clean before proceeding with git operation.
     *
     * @param featureWorktrees - Array of feature worktrees to check
     * @throws Error if any working tree has uncommitted changes
     */
    protected async verifyCleanWorkingTrees(featureWorktrees: FeatureWorktree[]): Promise<void> {
        const dirtyWorktrees = await this.findDirtyWorktrees(featureWorktrees);

        if (dirtyWorktrees.length > 0) {
            const repoNames = dirtyWorktrees.map((wt) => this.getRepoNameOrThrow(wt.repoRoot)).join(', ');
            throw new Error(
                `Working tree is not clean in: ${repoNames}.\n` +
                    `Please commit or stash your changes before proceeding.`,
            );
        }
    }

    /**
     * Prompt user to select a branch from available local branches.
     *
     * Displays common branches (main, master, dev, develop, trunk) first,
     * followed by feature branches (optional) and other branches,
     * and allows manual entry via "Other" option.
     *
     * @param repoRoot - The repository root to query for branches
     * @param promptMessage - Custom message for the prompt
     * @param includeFeatureBranches - Whether to include feature/ branches in the list
     * @returns The selected branch name
     * @throws Error if branch name is empty or selection is invalid
     */
    protected async promptForBranch(
        repoRoot: string,
        promptMessage: string,
        includeFeatureBranches: boolean = false,
    ): Promise<string> {
        // Get all local branches
        const result = await execa('git', ['branch', '--format=%(refname:short)'], { cwd: repoRoot });
        const allBranches = result.stdout.split('\n').filter((b: string) => b.trim().length > 0);

        // Common branches to prioritize in the selection menu
        const commonBranches = ['main', 'master', 'dev', 'develop', 'trunk'];

        // Separate branches by type
        const priorityBranches = commonBranches.filter((b: string) => allBranches.includes(b));
        const featureBranches = allBranches.filter((b: string) => b.startsWith('feature/'));
        const otherBranches = allBranches.filter((b: string) => !commonBranches.includes(b) && !b.startsWith('feature/'));

        // Build choices menu
        const choices: Array<{ key: string; label: string }> = [];
        let keyIndex = 1;

        // Add priority branches first
        for (const branch of priorityBranches) {
            choices.push({ key: String(keyIndex++), label: branch });
        }

        // Add feature branches if requested
        if (includeFeatureBranches && featureBranches.length > 0) {
            for (const branch of featureBranches) {
                choices.push({ key: String(keyIndex++), label: branch });
            }
        }

        // Add other branches
        for (const branch of otherBranches) {
            choices.push({ key: String(keyIndex++), label: branch });
        }

        // Add manual entry option
        choices.push({ key: 'x', label: 'Other (enter branch name)' });

        const selection = await promptChoice(promptMessage, choices);

        // Handle manual entry
        if (selection === 'x') {
            const branchName = await promptText('Enter branch name:');
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
     * Display summary of git operation results.
     *
     * @param results - Array of operation results
     * @param operationName - Name of the operation (e.g., "merge", "rebase")
     */
    protected displayOperationSummary(results: GitOperationResult[], operationName: string): void {
        console.log(`\n=== ${operationName.charAt(0).toUpperCase() + operationName.slice(1)} Summary ===`);

        const successful = results.filter((r) => r.success);
        const conflicts = results.filter((r) => r.hasConflicts);
        const failed = results.filter((r) => !r.success && !r.hasConflicts);

        if (successful.length > 0) {
            console.log(`\n✅ Successful ${operationName}s (${successful.length}):`);
            successful.forEach((r) => console.log(`   - ${r.repo}`));
        }

        if (conflicts.length > 0) {
            console.log(`\n⚠️  Conflicts to resolve (${conflicts.length}):`);
            conflicts.forEach((r) => console.log(`   - ${r.repo}`));
        }

        if (failed.length > 0) {
            console.log(`\n❌ Failed ${operationName}s (${failed.length}):`);
            failed.forEach((r) => console.log(`   - ${r.repo}`));
        }
    }

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
    protected getRepoNameOrThrow(repoRoot: string): string {
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
    protected getMainRepoName(): string {
        return this.getRepoNameOrThrow(this.config.mainRepoRoot);
    }

    /**
     * Build a list of secondary repository roots (all except main repo).
     *
     * @returns Array of repository roots excluding the main repo
     */
    protected getSecondaryRepoRoots(): string[] {
        return this.config.repoRoots.filter((r) => r !== this.config.mainRepoRoot);
    }
}
