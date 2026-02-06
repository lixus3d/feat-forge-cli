import { FeatureContext } from '../foundation/FeatureContext';
import { ForgeMode } from '../foundation/types/ForgeMode';
import { AbstractCommands } from './AbstractCommands';

export class ModeCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Set the current mode and refresh agent adapters for the active feature.
     */
    async setMode(mode: ForgeMode): Promise<void> {
        const featureContext = await FeatureContext.findNearestFeatureContext(this.context);
        await featureContext.setMode(mode);
    }
}
