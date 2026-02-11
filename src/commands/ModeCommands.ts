import { BranchContext } from '@/foundation/BranchContext';
import { AbstractCommands } from './AbstractCommands';

export class ModeCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Set the current mode and refresh agent adapters for the active feature.
     */
    async setMode(mode: string): Promise<void> {
        const branchContext = await BranchContext.findNearestBranchContext(this.context);
        await branchContext.setMode(mode);
        await branchContext.refreshAgentContextFiles(mode);
    }
}
