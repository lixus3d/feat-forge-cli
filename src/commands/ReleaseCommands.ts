import { SubBranchCommands } from './SubBranchCommands';

export class ReleaseCommands extends SubBranchCommands {
    protected prefix = this.context.options.git.releaseBranchPrefix;
}
