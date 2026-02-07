import { writeFile } from 'fs/promises';
import path from 'path';
import { WorktreeRepository } from '../foundation/Repository';
import { pathExists } from './fs';
import { IDE } from '../foundation/types/IDE';
import { IDEName } from '../foundation/types/IDEName';
import { AIAgent } from '../foundation/types/AIAgent';

/**
 * Get the default CLI command for an IDE
 * @param ideName - The IDE name
 * @returns The default CLI command for the IDE
 */
export function getDefaultIDECommand(ideName: IDEName): string {
    const defaultCommands: Record<IDEName, string> = {
        [IDEName.VSCODE]: 'code',
    };

    return defaultCommands[ideName];
}

/**
 * VSCode workspace configuration
 */
type VSCodeWorkspace = {
    folders: Array<{ path: string }>;
    settings?: Record<string, unknown>;
};

/**
 * Create IDE workspace files for a feature
 */
export async function createIDEWorkspaces(
    featureSlug: string,
    worktreePath: string,
    mainRepoName: string,
    repositories: WorktreeRepository[],
    ides: IDE[],
    agents: AIAgent[],
): Promise<void> {
    for (const ide of ides) {
        if (!ide.createWorkspace) {
            continue;
        }

        switch (ide.name) {
            case IDEName.VSCODE:
                await createVSCodeWorkspaceFile(featureSlug, worktreePath, ide, mainRepoName, repositories, agents);
                break;
            default:
                console.warn(`Unknown IDE: ${ide.name}, skipping workspace creation`);
        }
    }
}

/**
 * Create a VSCode-style workspace file (.code-workspace)
 * Also works for Cursor and Windsurf which use the same format
 */
async function createVSCodeWorkspaceFile(
    featureSlug: string,
    workspacePath: string,
    ide: IDE,
    mainRepoName: string,
    repositories: WorktreeRepository[],
    agents: AIAgent[],
): Promise<void> {
    const workspaceFileName = `${featureSlug}.code-workspace`;
    const workspaceFilePath = path.join(workspacePath, workspaceFileName);

    // Check if workspace already exists
    if (await pathExists(workspaceFilePath)) {
        console.log(`Workspace file already exists: ${workspaceFileName}`);
        return;
    }

    // Build workspace settings
    const settings = { ...ide.settings };

    const workspace: VSCodeWorkspace = {
        folders: repositories.map((repo) => ({ path: `./${repo.name}` })),
        settings,
    };

    await writeFile(workspaceFilePath, JSON.stringify(workspace, null, 2), 'utf8');
    console.log(`Created ${ide.name} workspace: ${workspaceFileName}`);
}

/**
 * Update IDE settings in an existing workspace
 */
export async function updateIDEWorkspace(
    workspacePath: string,
    ideName: IDEName,
    newSettings: Record<string, unknown>,
): Promise<void> {
    if (!(await pathExists(workspacePath))) {
        throw new Error(`Workspace file not found: ${workspacePath}`);
    }

    const content = await import('fs/promises').then((m) => m.readFile(workspacePath, 'utf8'));
    const workspace = JSON.parse(content) as VSCodeWorkspace;

    workspace.settings = {
        ...workspace.settings,
        ...newSettings,
    };

    await writeFile(workspacePath, JSON.stringify(workspace, null, 2), 'utf8');
    console.log(`Updated ${ideName} workspace: ${path.basename(workspacePath)}`);
}
