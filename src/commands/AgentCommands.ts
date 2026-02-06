import { rm, symlink } from 'fs/promises';
import path from 'path';
import { FeatureContext } from '../foundation/FeatureContext';
import { ensureDir, pathExists } from '../lib/fs';
import { TemplateFile } from '../lib/templates';
import { AbstractCommands } from './AbstractCommands';
import { ForgeMode } from '../foundation/types/ForgeMode';
import { AIAgentName } from '../foundation/types/AIAgentName';
import { refreshCopilotAgentContextFiles } from '../lib/agents';

export class AgentCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Refresh agent adapter files for the active feature using current mode.
     */
    async refresh(): Promise<void> {
        const featureContext = await FeatureContext.findNearestFeatureContext(this.context);
        await featureContext.refreshAgentContextFiles();
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================
}
