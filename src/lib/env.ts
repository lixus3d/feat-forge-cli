/**
 * Convert hook parameters to environment variables with a FORGE_HOOK prefix
 * @param params - Parameters object to convert
 * @returns Object suitable for use as env in execa
 */
export function paramsToEnv(params?: Record<string, unknown>): Record<string, string> {
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
