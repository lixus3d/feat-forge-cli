import { SubBranchCommands } from './SubBranchCommands';

export class FeatureCommands extends SubBranchCommands {
    protected prefix = this.context.options.git.featureBranchPrefix;
}
