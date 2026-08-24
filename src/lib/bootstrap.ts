import { execa } from 'execa';
import os from 'os';
import path from 'path';
import { pathExists } from './fs';
import { paramsToEnv } from './env';
import { getScriptExtension, isWindows } from './platform';

export interface CommandExecutionOptions {
    useNvmrc?: boolean;
}

async function findNearestFile(startDir: string, fileName: string): Promise<string | null> {
    let currentDir = path.resolve(startDir);

    while (true) {
        const candidate = path.join(currentDir, fileName);
        if (await pathExists(candidate)) {
            return candidate;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return null;
        }
        currentDir = parentDir;
    }
}

async function resolveNvmInitScript(): Promise<string | null> {
    const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
    const nvmInitPath = path.join(nvmDir, 'nvm.sh');
    return (await pathExists(nvmInitPath)) ? nvmInitPath : null;
}

export async function executeCommand(
    command: string,
    args: string[],
    repositoryPath: string,
    label: string,
    params?: Record<string, unknown>,
    options: CommandExecutionOptions = {},
): Promise<void> {
    const hookEnv = paramsToEnv(params);
    const sharedOptions = {
        cwd: repositoryPath,
        stdio: 'inherit' as const,
        env: {
            ...process.env,
            ...hookEnv,
        },
    };

    if (options.useNvmrc) {
        const nvmrcPath = await findNearestFile(repositoryPath, '.nvmrc');
        if (nvmrcPath) {
            if (isWindows()) {
                throw new Error(`process.useNvmrc is enabled but not supported on Windows for ${label}`);
            }

            const nvmInitPath = await resolveNvmInitScript();
            if (!nvmInitPath) {
                throw new Error(`process.useNvmrc is enabled but nvm.sh was not found for ${label}`);
            }

            await execa('bash', ['-lc', 'source "$1" && shift && nvm use && exec "$@"', 'bash', nvmInitPath, command, ...args], sharedOptions);
            return;
        }
    }

    await execa(command, args, sharedOptions);
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
    options: CommandExecutionOptions = {},
): Promise<boolean> {
    if (!(await pathExists(scriptPath))) {
        return false;
    }

    console.log(`🔄 Executing ${scriptName} script: ${scriptPath}`);

    try {
        await executeCommand(scriptPath, [], repositoryPath, scriptName, params, options);
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
    options: CommandExecutionOptions = {},
): Promise<boolean> {
    const scriptExtension = getScriptExtension();
    const scriptPath = path.join(repositoryPath, repoConfigFolderPath, `${scriptName}${scriptExtension}`);
    return executeScript(scriptPath, repositoryPath, scriptName, undefined, options);
}
