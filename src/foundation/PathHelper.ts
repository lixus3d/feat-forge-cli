import path from 'path';
import { ForgeContext } from './ForgeContext';
import {
    FEAT_FORGE_CONFIG_FOLDER,
    TEMP_FEATURE_ARCHIVE_FOLDER,
    TEMP_FEATURE_INIT_FOLDER,
    TEMP_FOLDER,
    TemporaryFolderType,
} from '../lib/constants';
import { branchNameAsPath } from '@/lib/branch';
import { ForgeFoldersOptions } from './ForgeConfigFile';

export class PathHelper {
    constructor(private context: ForgeContext) {}

    get folders(): ForgeFoldersOptions {
        return this.context.options.folders;
    }

    get rootDir(): string {
        return this.context.rootDir;
    }

    get worktreesRoot(): string {
        return path.join(this.rootDir, this.folders.worktrees);
    }

    get featForgeConfigRoot(): string {
        return path.join(this.rootDir, FEAT_FORGE_CONFIG_FOLDER);
    }

    get tempFolderRoot(): string {
        return path.join(this.featForgeConfigRoot, TEMP_FOLDER);
    }

    getWorkspaceRootFilesSourcePath(): string | null {
        const configuredFolder = this.folders.workspaceRootFiles;
        if (configuredFolder === false) {
            return null;
        }

        if (path.isAbsolute(configuredFolder)) {
            throw new Error(`options.folders.workspaceRootFiles must stay inside ${FEAT_FORGE_CONFIG_FOLDER}`);
        }

        const sourcePath = path.resolve(this.featForgeConfigRoot, configuredFolder);
        const relativePath = path.relative(this.featForgeConfigRoot, sourcePath);

        if (!relativePath || relativePath === '.' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error(`options.folders.workspaceRootFiles must resolve to a subfolder of ${FEAT_FORGE_CONFIG_FOLDER}`);
        }

        return sourcePath;
    }

    getPathInRoot(...segments: string[]): string {
        return path.join(this.rootDir, ...segments);
    }

    getPathInWorktrees(...segments: string[]): string {
        return path.join(this.worktreesRoot, ...segments);
    }

    getBranchRootPath(branchName: string): string {
        return this.getPathInBranchRoot(branchNameAsPath(branchName));
    }

    getPathInBranchRoot(branchName: string, ...segments: string[]): string {
        return this.getPathInWorktrees(branchNameAsPath(branchName), ...segments);
    }

    /**
     * Get the temporary folder path for a specific operation (e.g. feature-init, feature-archive).
     * Default Pattern: <rootDir>/.feat-forge/tmp/<operation>/<slug>/<repoName>/
     */
    getPathInTemp(...segments: string[]): string {
        return path.join(this.tempFolderRoot, ...segments);
    }

    /**
     * Get the temporary worktree path for a specific repository and operation type.
     */
    getTempWorktreePathForRepo(type: TemporaryFolderType, branchName: string, repoName: string): string {
        switch (type) {
            case TemporaryFolderType.BRANCH_INIT:
                return this.getPathInTemp(TEMP_FEATURE_INIT_FOLDER, branchNameAsPath(branchName), repoName);
            case TemporaryFolderType.BRANCH_ARCHIVE:
                return this.getPathInTemp(TEMP_FEATURE_ARCHIVE_FOLDER, branchNameAsPath(branchName), repoName);
            default:
                throw new Error(`Unknown temporary type: ${type}`);
        }
    }
}
