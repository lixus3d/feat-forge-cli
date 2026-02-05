import { Command } from 'commander';
import { ForgeContext } from '../lib/config';
import { pathExists } from '../lib/fs';
import { resolveActiveFeature } from '../lib/feature';
import { findGitRoot } from '../lib/git';
import { refreshAgentAdapters } from '../lib/agents';
import { ForgeMode, getModePath, writeModeFile } from '../lib/mode';
import { AbstractCommands } from './abstract';

export class ModeCommands extends AbstractCommands {
    /**
     * Set the current mode and refresh agent adapters for the active feature.
     */
    async setMode(mode: ForgeMode): Promise<void> {
        const gitRoot = await findGitRoot();
        const { featurePath } = await resolveActiveFeature(gitRoot);
        await this.setModeForPath(featurePath, mode);
    }

    /**
     * Set mode for a specific feature path (useful when creating features)
     */
    async setModeForPath(featurePath: string, mode: ForgeMode): Promise<void> {
        const { agents } = this.config;

        await writeModeFile(featurePath, mode);
        const adapterFiles = agents.map((a) => a.agentFile);
        await refreshAgentAdapters(featurePath, adapterFiles, mode);
    }

    /**
     * Check if a mode file exists for a feature
     */
    async modeExists(featurePath: string): Promise<boolean> {
        return pathExists(getModePath(featurePath));
    }

    /**
     * Set initial mode if not already defined (used during feature creation)
     */
    async setInitialModeIfNeeded(featurePath: string, defaultMode: ForgeMode = ForgeMode.SPEC): Promise<void> {
        if (await this.modeExists(featurePath)) {
            return;
        }
        await this.setModeForPath(featurePath, defaultMode);
    }
}
