import { Command } from 'commander';
import { ForgeContext } from '../lib/config';
import { resolveActiveFeature } from '../lib/feature';
import { findGitRoot } from '../lib/git';
import { refreshAgentAdapters } from '../lib/agents';
import { readModeFile } from '../lib/mode';
import { AbstractCommands } from './abstract';

class AgentCommands extends AbstractCommands {
    /**
     * Refresh agent adapter files for the active feature using current mode.
     */
    async refresh(): Promise<void> {
        const config = await this.ensureConfig();
        const { agents } = config;

        const gitRoot = await findGitRoot();
        const { featurePath } = await resolveActiveFeature(gitRoot);
        const mode = await readModeFile(featurePath);

        const adapterFiles = agents.map((a) => a.agentFile);
        await refreshAgentAdapters(featurePath, adapterFiles, mode);
    }
}

export function registerAgentCommands(program: Command, config?: ForgeContext): void {
    const handlers = new AgentCommands(config);

    function refreshAgents(): Promise<void> {
        return handlers.refresh();
    }

    const agent = program.command('agent').description('Manage agent adapters');
    agent.command('refresh').description('Refresh agent adapter files for the active feature').action(refreshAgents);
}
