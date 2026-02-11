import { readdir } from 'fs/promises';
import path from 'path';
import { pathExists } from './fs';
import { getScriptExtension } from './platform';
import { executeScript } from './bootstrap';

/**
 * Available hook event types that can be triggered throughout the forge lifecycle.
 * Each event can have multiple hooks (e.g., postBranchStart.sh, postBranchStart_01.sh).
 */
export enum HookEvent {
    /** Triggered after a branch is started */
    POST_BRANCH_START = 'postBranchStart',
    /** Triggered before a merge operation */
    PRE_MERGE = 'preMerge',
    /** Triggered after a merge operation */
    POST_MERGE = 'postMerge',
    /** Triggered before stopping a branch */
    PRE_STOP = 'preStop',
    /** Triggered before a rebase operation */
    PRE_REBASE = 'preRebase',
    /** Triggered after a rebase operation */
    POST_REBASE = 'postRebase',
    /** Triggered after refreshing agent context files */
    POST_REFRESH_AGENTS = 'postRefreshAgents',
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

