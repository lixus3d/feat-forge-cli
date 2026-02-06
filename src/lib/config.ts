import path from 'path';
import { readFile } from 'fs/promises';
import { pathExists } from './fs';
import { ForgeConfig, ForgeConfigFile } from '../foundation/ForgeConfig';
import { ForgeContext } from '../foundation/ForgeContext';
import { ForgeConfigError } from '../foundation/errors/ForgeConfigError';
import { FEAT_FORGE_CONFIG_FILE } from './constants';

/**
 * Find the nearest .feat-forge.json by walking up from startDir.
 */
export async function findConfigFilePath(startDir: string = process.cwd()): Promise<string> {
    let current = path.resolve(startDir);
    while (true) {
        const configPath = path.join(current, FEAT_FORGE_CONFIG_FILE);
        if (await pathExists(configPath)) {
            return configPath;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            throw new ForgeConfigError(
                `Missing ${FEAT_FORGE_CONFIG_FILE}. Run the CLI from a configured root folder or start with 'forge init'.`,
            );
        }
        current = parent;
    }
}

/**
 * Load and validate the Forge config from the nearest root.
 */
export async function loadForgeConfig(startDir: string = process.cwd()): Promise<{ configPath: string; forgeConfig: ForgeConfig }> {
    const configFilePath = await findConfigFilePath(startDir);
    const configPath = path.dirname(configFilePath);

    try {
        const raw = await readFile(configFilePath, 'utf8');
        const forgeConfigFile = JSON.parse(raw) as ForgeConfigFile;
        return { configPath, forgeConfig: new ForgeConfig(forgeConfigFile) };
    } catch (err) {
        throw new ForgeConfigError(`Failed to load Forge config: ${(err as Error).message}`);
    }
}

export async function loadForgeContext(startDir: string = process.cwd()): Promise<ForgeContext> {
    const config = await loadForgeConfig(startDir);
    return new ForgeContext(config.configPath, config.forgeConfig);
}
