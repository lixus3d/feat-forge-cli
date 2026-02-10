import { BranchContext } from '@/foundation/BranchContext';
import { AbstractCommands } from './AbstractCommands';

export class AgentCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Refresh agent adapter files for the active branch using current mode.
     */
    async refresh(): Promise<void> {
        const branchContext = await BranchContext.findNearestBranchContext(this.context);
        await branchContext.refreshAgentContextFiles();
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================
}
