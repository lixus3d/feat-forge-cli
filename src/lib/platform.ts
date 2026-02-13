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
