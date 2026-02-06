import path from 'path';
import { pathExists, writeTextFile } from '../lib/fs';
import { FEAT_FORGE_CONFIG_FILE } from '../lib/constants';
import { ForgeConfigFile } from '../foundation/ForgeConfig';

export class InitCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a .feat-forge.json in the current working directory.
     */
    async init(): Promise<void> {
        const targetPath = path.join(process.cwd(), FEAT_FORGE_CONFIG_FILE);
        if (await pathExists(targetPath)) {
            throw new Error(`Config already exists at ${targetPath}`);
        }

        // TODO: Prompt the user for initial config values (repos, agents, ides) instead of starting with a mostly empty template
        const defaultConfigFile: ForgeConfigFile = {
            repositories: ['repository-path'],
        };

        const contents = JSON.stringify(defaultConfigFile, null, 4);
        await writeTextFile(targetPath, `${contents}\n`);

        console.log(`Initialized ${FEAT_FORGE_CONFIG_FILE} at ${targetPath}`);
    }
}
