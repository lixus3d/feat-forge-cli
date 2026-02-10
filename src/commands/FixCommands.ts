import { SubBranchCommands } from './SubBranchCommands';

export class FixCommands extends SubBranchCommands {
    protected prefix = this.context.options.git.fixBranchPrefix;
}
