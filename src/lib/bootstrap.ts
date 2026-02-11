import { execa } from 'execa';
import { readdir } from 'fs/promises';
import path from 'path';
import { HookEvent } from './hooks';
import { pathExists } from './fs';

/**
 * Check if the current platform is Windows
 */
export function isWindows(): boolean {
    return process.platform === 'win32';
}

/**
 * Get the script extension based on the current platform
 * @returns '.bat' on Windows, '.sh' on other platforms
 */
export function getScriptExtension(): string {
    return isWindows() ? '.bat' : '.sh';
}

/**
 * Convert hook parameters to environment variables with a FORGE_HOOK prefix
 * @param params - Parameters object to convert
 * @returns Object suitable for use as env in execa
 */
function paramsToEnv(params?: Record<string, unknown>): Record<string, string> {
    if (!params || Object.keys(params).length === 0) {
        return {};
    }

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
            // Convert to FORGE_HOOK_PARAM_NAME format and stringify
            const slugKey = key.replace(/[^a-zA-Z0-9_]/g, '_'); // Replace non-alphanumeric characters with underscores
            const envKey = `FORGE_HOOK_${slugKey.toUpperCase()}`;
            env[envKey] = String(value);
        }
    }
    return env;
}

/**
 * Execute a script file if it exists.
 * Gracefully skips execution if the script doesn't exist.
 *
 * @param scriptPath - Full path to the script file
 * @param repositoryPath - Working directory for the script execution
 * @param scriptName - Name of the script for logging (e.g., 'bootstrap')
 * @param params - Optional parameters to pass to the script as environment variables
 * @returns true if script was executed, false if it didn't exist
 */
export async function executeScript(
    scriptPath: string,
    repositoryPath: string,
    scriptName: string,
    params?: Record<string, unknown>,
): Promise<boolean> {
    if (!(await pathExists(scriptPath))) {
        return false;
    }

    console.log(`🔄 Executing ${scriptName} script: ${scriptPath}`);

    try {
        const hookEnv = paramsToEnv(params);
        await execa(scriptPath, {
            cwd: repositoryPath,
            stdio: 'inherit',
            env: {
                ...process.env,
                ...hookEnv,
            },
        });
        console.log(`✅ ${scriptName} script completed successfully`);
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${scriptName} script failed: ${message}`);
        throw error;
    }
}

/**
 * Execute a bootstrap script from a repository if it exists.
 * Automatically selects the correct script based on the operating system (.sh or .bat).
 * Gracefully skips execution if the script doesn't exist.
 *
 * @param repositoryPath - Path to the repository/worktree
 * @param repoConfigFolderPath - Relative path to the repo config folder (e.g., '.forge')
 * @param scriptName - Name of the script without extension (e.g., 'bootstrap')
 * @returns true if script was executed, false if it didn't exist
 */
export async function executeBootstrapScript(
    repositoryPath: string,
    repoConfigFolderPath: string,
    scriptName: string = 'bootstrap',
): Promise<boolean> {
    const scriptExtension = getScriptExtension();
    const scriptPath = path.join(repositoryPath, repoConfigFolderPath, `${scriptName}${scriptExtension}`);
    return executeScript(scriptPath, repositoryPath, scriptName);
}

/**
 * Discover available hooks for a specific event type.
 * Returns hook names matching the event type without extension (e.g., 'postBranchStart' from 'postBranchStart.sh').
 * Supports multiple hooks for the same event (e.g., postBranchStart, postBranchStart_01, postBranchStart_02).
 * Hooks are returned in alphabetical order for predictable execution.
 *
 * @param repositoryPath - Path to the repository/worktree
 * @param repoConfigFolderPath - Relative path to the repo config folder (e.g., '.forge')
 * @param eventType - Type of event (HookEvent enum value)
 * @returns Array of hook names in alphabetical order
 */
export async function discoverHooksForEvent(
    repositoryPath: string,
    repoConfigFolderPath: string,
    eventType: HookEvent,
): Promise<string[]> {
    const hooksDir = path.join(repositoryPath, repoConfigFolderPath, 'hooks');

    if (!(await pathExists(hooksDir))) {
        return [];
    }

    try {
        const files = await readdir(hooksDir);
        const scriptExtension = getScriptExtension();

        const hookNames = files
            .filter((file) => {
                if (!file.endsWith(scriptExtension)) {
                    return false;
                }
                const hookName = file.slice(0, -scriptExtension.length);
                // Match exact event type or event type with suffix (e.g., postBranchStart, postBranchStart_01)
                return hookName === eventType || hookName.startsWith(`${eventType}_`);
            })
            .map((file) => file.slice(0, -scriptExtension.length))
            .sort(); // Sort alphabetically for predictable order

        return hookNames;
    } catch (error) {
        return [];
    }
}

/**
 * Execute all hooks for a specific event type.
 * Hooks are executed in alphabetical order for predictable, consistent execution.
 *
 * @param repositoryPath - Path to the repository/worktree
 * @param repoConfigFolderPath - Relative path to the repo config folder (e.g., '.forge')
 * @param eventType - Type of event (HookEvent enum value)
 * @param params - Optional parameters to pass to hooks as environment variables (FORGE_HOOK_PARAM_NAME)
 * @returns Array of hook names that were executed
 * @throws Error if any hook fails
 */
export async function executeHooksForEvent(
    repositoryPath: string,
    repoConfigFolderPath: string,
    eventType: HookEvent,
    params?: Record<string, unknown>,
): Promise<string[]> {
    const hookNames = await discoverHooksForEvent(repositoryPath, repoConfigFolderPath, eventType);

    if (hookNames.length === 0) {
        return [];
    }

    const scriptExtension = getScriptExtension();
    const executedHooks: string[] = [];

    for (const hookName of hookNames) {
        const scriptPath = path.join(repositoryPath, repoConfigFolderPath, 'hooks', `${hookName}${scriptExtension}`);
        try {
            await executeScript(scriptPath, repositoryPath, `hook: ${hookName}`, params);
            executedHooks.push(hookName);
        } catch (error) {
            throw new Error(`Hook ${hookName} failed in ${repositoryPath}`);
        }
    }

    return executedHooks;
}
