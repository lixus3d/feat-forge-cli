import { BranchContext } from '@/foundation/BranchContext';
import { ForgeContext } from '@/foundation/ForgeContext';

/**
 * Base class for command handlers with required configuration.
 */
export abstract class AbstractCommands {
    constructor(protected readonly context: ForgeContext) {}

    protected async verifyCleanBranch(branchContext: BranchContext): Promise<void> {
        const dirtyRepos = await branchContext.getDirtyRepositories();

        if (dirtyRepos.length > 0) {
            const repoNames = dirtyRepos.map((repo) => repo.name).join(', ');
            throw new Error(`Worktree is not clean in: ${repoNames}.\n` + `Please commit or stash your changes before proceeding.`);
        }
    }
}
