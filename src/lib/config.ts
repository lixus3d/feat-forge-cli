import { ForgeConfigError } from '@/foundation/errors';
import { ForgeConfigFile } from '@/foundation/ForgeConfigFile';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFile } from 'fs/promises';
import path from 'path';
import { ForgeConfig } from '../foundation/ForgeConfig';
import { ForgeContext } from '../foundation/ForgeContext';
import { FEAT_FORGE_CONFIG_FILE, FEAT_FORGE_CONFIG_FOLDER, FEAT_FORGE_HOME_CONFIG_FILE } from './constants';
import { pathExists } from './fs';
import os from 'os';
import { merge, mergeDropUndefined } from './merger';

const HOME_CONFIG_PATH = path.join(os.homedir(), FEAT_FORGE_CONFIG_FOLDER);

export async function getHomeDirConfigFile(): Promise<Partial<ForgeConfigFile> | null> {
    const configPath = path.join(HOME_CONFIG_PATH, FEAT_FORGE_HOME_CONFIG_FILE);
    if (!(await pathExists(configPath))) {
        return null;
    }
    const raw = await readFile(configPath, 'utf8');
    return JSON.parse(raw) as Partial<ForgeConfigFile>;
}

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
        const projectConfigFile = JSON.parse(raw);
        const homeConfigFile = await getHomeDirConfigFile();
        const forgeConfigFile = plainToInstance(
            ForgeConfigFile,
            homeConfigFile ? mergeDropUndefined(homeConfigFile, projectConfigFile) : projectConfigFile,
        );
        const errors = await validate(forgeConfigFile, { whitelist: true, validationError: { target: false, value: false } });
        if (errors.length > 0) {
            throw new ForgeConfigError(`Invalid config file at ${configFilePath}:\n${JSON.stringify(errors, null, 2)}`);
        }
        return { configPath, forgeConfig: new ForgeConfig(configPath, forgeConfigFile) };
    } catch (err) {
        const forgeConfigError = new ForgeConfigError(`Failed to load Forge config: ${(err as Error).message}`);
        forgeConfigError.stack = (err as Error).stack;
        throw forgeConfigError;
    }
}

export async function loadForgeContext(startDir: string = process.cwd()): Promise<ForgeContext> {
    const { configPath, forgeConfig } = await loadForgeConfig(startDir);
    return new ForgeContext(configPath, forgeConfig);
}
