import { AbstractCommands } from './AbstractCommands';
import { BranchCommands } from './BranchCommands';

export abstract class SubBranchCommands extends AbstractCommands {
    protected abstract prefix: string; // something like "feature/", "fix/", etc.

    private branchCommands = new BranchCommands(this.context);

    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    async create(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.create(rawSlug);
    }

    async start(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.start(rawSlug);
    }

    async list(): Promise<void> {
        const prefix = this.context.options.git.fixBranchPrefix;
        return this.branchCommands.list(prefix);
    }

    async resync(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.resync(rawSlug);
    }

    async stop(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.stop(rawSlug);
    }

    async archive(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.archive(rawSlug);
    }

    async open(rawSlug?: string): Promise<void> {
        rawSlug = rawSlug ? this.toSubBranchSlug(rawSlug) : undefined;
        return this.branchCommands.open(rawSlug);
    }

    async merge(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.merge(rawSlug);
    }

    async rebase(rawSlug: string): Promise<void> {
        rawSlug = this.toSubBranchSlug(rawSlug);
        return this.branchCommands.rebase(rawSlug);
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    protected toSubBranchSlug(rawSlug: string): string {
        return `${this.prefix}${rawSlug}`;
    }
}
