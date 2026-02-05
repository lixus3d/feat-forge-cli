import { Command } from 'commander';
import { ForgeContext } from '../lib/config';
import { resolveActiveFeature } from '../lib/feature';
import { findGitRoot } from '../lib/git';
import { refreshAgentContextFiles } from '../lib/agents';
import { readModeFile } from '../lib/mode';
import { AbstractCommands } from './abstract';

export class AgentCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Refresh agent adapter files for the active feature using current mode.
     */
    async refresh(): Promise<void> {
        const { agents } = this.config;

        // Read the current mode of the active feature to determine which context files to link
        const gitRoot = await findGitRoot();
        const { featurePath, featureRoot } = await resolveActiveFeature(gitRoot);
        const mode = await readModeFile(featurePath);

        await refreshAgentContextFiles(featureRoot, featurePath, agents, mode);
    }
}
