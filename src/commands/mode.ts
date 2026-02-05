import { Command } from 'commander';
import { ForgeContext } from '../lib/config';
import { pathExists } from '../lib/fs';
import { resolveActiveFeature } from '../lib/feature';
import { findGitRoot } from '../lib/git';
import { refreshAgentContextFiles } from '../lib/agents';
import { ForgeMode, getModePath, writeModeFile } from '../lib/mode';
import { AbstractCommands } from './abstract';

export class ModeCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Set the current mode and refresh agent adapters for the active feature.
     */
    async setMode(mode: ForgeMode): Promise<void> {
        // FIXME: it should not be necessary to read the git root, if we are in the featureRoot folder it must be enough to resolve the active feature, we should refactor the code to avoid this extra step
        // FIXME: A findFeatureRoot function would be better here
        const gitRoot = await findGitRoot();
        const { featurePath, featureRoot } = await resolveActiveFeature(gitRoot);
        await this.setModeForPath(featureRoot, featurePath, mode);
    }

    /**
     * Set mode for a specific feature path (useful when creating features)
     */
    async setModeForPath(featureRoot:string, featurePath: string, mode: ForgeMode): Promise<void> {
        const { agents } = this.config;

        await writeModeFile(featurePath, mode);
        await refreshAgentContextFiles(featureRoot, featurePath, agents, mode);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Check if a mode file exists for a feature
     */
    async modeExists(featurePath: string): Promise<boolean> {
        return pathExists(getModePath(featurePath));
    }

    /**
     * Set initial mode if not already defined (used during feature creation)
     */
    async setInitialModeIfNeeded(featureRoot:string, featurePath: string, defaultMode: ForgeMode = ForgeMode.SPEC): Promise<void> {
        if (await this.modeExists(featurePath)) {
            return;
        }
        await this.setModeForPath(featureRoot, featurePath, defaultMode);
    }
}
