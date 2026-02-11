import { execa } from 'execa';
import { readFile } from 'fs/promises';
import path from 'path';
import { pathExists } from './fs';

interface PackageJson {
    scripts?: Record<string, string>;
    [key: string]: unknown;
}

/**
 * Check if a repository is a Node.js project (has package.json)
 */
export async function isNodeProject(repositoryPath: string): Promise<boolean> {
    const packageJsonPath = path.join(repositoryPath, 'package.json');
    return pathExists(packageJsonPath);
}

/**
 * Read and parse package.json from a repository
 */
export async function readPackageJson(repositoryPath: string): Promise<PackageJson | null> {
    const packageJsonPath = path.join(repositoryPath, 'package.json');

    if (!(await pathExists(packageJsonPath))) {
        return null;
    }

    try {
        const content = await readFile(packageJsonPath, 'utf-8');
        return JSON.parse(content) as PackageJson;
    } catch (error) {
        console.error(`Failed to read package.json at ${packageJsonPath}:`, error);
        return null;
    }
}

/**
 * Discover feat-forge npm scripts in a package.json
 * Returns script names like 'feat-forge:bootstrap', 'feat-forge:hooks:postBranchStart', etc.
 */
export async function discoverNpmScripts(repositoryPath: string): Promise<string[]> {
    const packageJson = await readPackageJson(repositoryPath);

    if (!packageJson || !packageJson.scripts) {
        return [];
    }

    return Object.keys(packageJson.scripts)
        .filter((scriptName) => scriptName.startsWith('feat-forge:'))
        .sort();
}

/**
 * Discover npm scripts for a specific event (e.g., 'postBranchStart')
 * Returns full script names like 'feat-forge:hooks:postBranchStart'
 */
export async function discoverNpmScriptsForEvent(repositoryPath: string, eventType: string): Promise<string[]> {
    const allScripts = await discoverNpmScripts(repositoryPath);

    // Match patterns like 'feat-forge:hooks:postBranchStart' or 'feat-forge:hooks:postBranchStart_01'
    const eventPrefix = `feat-forge:hooks:${eventType}`;
    return allScripts.filter((scriptName) => scriptName === eventPrefix || scriptName.startsWith(`${eventPrefix}_`));
}

/**
 * Discover npm bootstrap script
 * Returns 'feat-forge:bootstrap' if it exists
 */
export async function discoverNpmBootstrapScript(repositoryPath: string): Promise<string | null> {
    const allScripts = await discoverNpmScripts(repositoryPath);
    return allScripts.find((name) => name === 'feat-forge:bootstrap') || null;
}

/**
 * Execute an npm script in a repository
 * Automatically detects npm or yarn
 */
export async function executeNpmScript(
    repositoryPath: string,
    scriptName: string,
    params?: Record<string, unknown>,
): Promise<boolean> {
    const packageJson = await readPackageJson(repositoryPath);

    if (!packageJson || !packageJson.scripts || !packageJson.scripts[scriptName]) {
        return false;
    }

    console.log(`🔄 Executing npm script: ${scriptName}`);

    try {
        // Determine which package manager to use
        const packageManager = (await pathExists(path.join(repositoryPath, 'yarn.lock'))) ? 'yarn' : 'npm';

        // Build environment with hook params
        const env: Record<string, string> = {};
        // Copy process.env, filtering out undefined values
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) {
                env[key] = value;
            }
        }
        // Add hook params
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== null && value !== undefined) {
                    const slugKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
                    const envKey = `FORGE_HOOK_${slugKey.toUpperCase()}`;
                    env[envKey] = String(value);
                }
            }
        }

        await execa(packageManager, ['run', scriptName], {
            cwd: repositoryPath,
            stdio: 'inherit',
            env,
        });

        console.log(`✅ npm script ${scriptName} completed successfully`);
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ npm script ${scriptName} failed: ${message}`);
        throw error;
    }
}

/**
 * Execute npm scripts for a specific event
 * Returns list of executed script names
 */
export async function executeNpmScriptsForEvent(
    repositoryPath: string,
    eventType: string,
    params?: Record<string, unknown>,
): Promise<string[]> {
    const scriptNames = await discoverNpmScriptsForEvent(repositoryPath, eventType);

    if (scriptNames.length === 0) {
        return [];
    }

    const executedScripts: string[] = [];

    for (const scriptName of scriptNames) {
        try {
            await executeNpmScript(repositoryPath, scriptName, params);
            executedScripts.push(scriptName);
        } catch (error) {
            throw new Error(`npm script ${scriptName} failed in ${repositoryPath}`);
        }
    }

    return executedScripts;
}

/**
 * Execute the npm bootstrap script if it exists
 */
export async function executeNpmBootstrapScript(
    repositoryPath: string,
    params?: Record<string, unknown>,
): Promise<boolean> {
    const scriptName = await discoverNpmBootstrapScript(repositoryPath);

    if (!scriptName) {
        return false;
    }

    try {
        await executeNpmScript(repositoryPath, scriptName, params);
        return true;
    } catch (error) {
        throw new Error(`npm bootstrap script failed in ${repositoryPath}`);
    }
}
