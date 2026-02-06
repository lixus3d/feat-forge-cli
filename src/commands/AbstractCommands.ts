import { execa } from 'execa';
import { getGitStatusPorcelain, gitBranchExists } from '../lib/git';
import { promptChoice, promptText } from '../lib/prompt';
import { ForgeContext } from '../foundation/ForgeContext';
import { FeatureContext } from '../foundation/FeatureContext';

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
    constructor(protected readonly context: ForgeContext) {}

    protected async verifyCleanFeature(featureContext: FeatureContext): Promise<void> {
        const dirtyRepos = await featureContext.getDirtyRepositories();

        if (dirtyRepos.length > 0) {
            const repoNames = dirtyRepos.map((repo) => repo.name).join(', ');
            throw new Error(`Worktree is not clean in: ${repoNames}.\n` + `Please commit or stash your changes before proceeding.`);
        }
    }
}
