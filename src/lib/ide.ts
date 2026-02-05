import path from 'path';
import { writeFile } from 'fs/promises';
import { IDEName, IDE, Agent } from './config';
import { ensureDir, pathExists } from './fs';

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
    repoNames: Map<string, string>,
    ides: IDE[],
    agents: Agent[],
): Promise<void> {
    for (const ide of ides) {
        if (!ide.createWorkspace) {
            continue;
        }

        switch (ide.name) {
            case IDEName.VSCODE:
                await createVSCodeWorkspace(featureSlug, worktreePath, ide, mainRepoName, repoNames, agents);
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
async function createVSCodeWorkspace(
    featureSlug: string,
    workspacePath: string,
    ide: IDE,
    mainRepoName: string,
    repoNames: Map<string, string>,
    agents: Agent[],
): Promise<void> {
    const workspaceFileName = `${featureSlug}.code-workspace`;
    const workspaceFilePath = path.join(workspacePath, workspaceFileName);

    // Check if workspace already exists
    if (await pathExists(workspaceFilePath)) {
        console.log(`Workspace file already exists: ${workspaceFileName}`);
        return;
    }

    // Build workspace settings
    const settings = { ...getDefaultIDESettings(mainRepoName, ide.name), ...ide.settings };

    const workspace: VSCodeWorkspace = {
        folders: [...Array.from(repoNames.values()).map((repoName) => ({ path: `./${repoName}` })), { path: '.vscode' }],
        settings,
    };

    await writeFile(workspaceFilePath, JSON.stringify(workspace, null, 2), 'utf8');
    console.log(`Created ${ide.name} workspace: ${workspaceFileName}`);

    // we also needs to create .vscode/settings.json in workspacePath to configure agent instruction files location
    const vscodeDir = path.join(workspacePath, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');
    await ensureDir(vscodeDir);

    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
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

/**
 * Get default IDE settings for known IDEs
 */
function getDefaultIDESettings(mainRepoName: string, ideName: IDEName): Record<string, unknown> {
    switch (ideName) {
        case IDEName.VSCODE:
            return {
                'chat.instructionsFilesLocations': {
                    [`./${mainRepoName}/.active-feature/agent/`]: true,
                },
            };
        default:
            return {};
    }
}
