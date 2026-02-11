import { execa } from 'execa';
import path from 'path';
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
 * Execute a script file if it exists.
 * Gracefully skips execution if the script doesn't exist.
 *
 * @param scriptPath - Full path to the script file
 * @param repositoryPath - Working directory for the script execution
 * @param scriptName - Name of the script for logging (e.g., 'bootstrap')
 * @returns true if script was executed, false if it didn't exist
 */
export async function executeScript(
    scriptPath: string,
    repositoryPath: string,
    scriptName: string,
): Promise<boolean> {
    if (!(await pathExists(scriptPath))) {
        return false;
    }

    console.log(`🔄 Executing ${scriptName} script: ${scriptPath}`);

    try {
        await execa(scriptPath, {
            cwd: repositoryPath,
            stdio: 'inherit',
        });
        console.log(`✓ ${scriptName} script completed successfully`);
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ ${scriptName} script failed: ${message}`);
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
