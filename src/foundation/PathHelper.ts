import path from 'path';
import { ForgeContext } from './ForgeContext';
import { FEAT_FORGE_CONFIG_FOLDER, TEMP_FEATURE_ARCHIVE_FOLDER, TEMP_FEATURE_INIT_FOLDER, TEMP_FOLDER } from '../lib/constants';
import { ForgeOptions } from './ForgeConfig';

export class PathHelper {
    constructor(private context: ForgeContext) {}

    get folders(): ForgeOptions['folders'] {
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

    getPathInWorktrees(...segments: string[]): string {
        return path.join(this.worktreesRoot, ...segments);
    }

    getFeatureRootPath(featureSlug: string): string {
        return this.getPathInFeatureRoot(featureSlug);
    }

    getPathInFeatureRoot(featureSlug: string, ...segments: string[]): string {
        return this.getPathInWorktrees(featureSlug, ...segments);
    }

    /**
     * Get the temporary folder path for a specific operation (e.g. feature-init, feature-archive).
     * Default Pattern: <rootDir>/.feat-forge/tmp/<operation>/<slug>/<repoName>/
     */
    getPathInTemp(...segments: string[]): string {
        return path.join(this.tempFolderRoot, ...segments);
    }

    /**
     * Get the temporary worktree path used during feature initialization.
     * Default Pattern: <rootDir>/.feat-forge/tmp/feature-init/<slug>/<repoName>/
     *
     * @param slug - The feature slug
     * @param repoName - The repository name
     * @returns The temporary worktree path
     */
    getTempFeatureWorktreePathForRepo(slug: string, repoName: string): string {
        return this.getTempFeatureRoot(slug, repoName);
    }

    /**
     * Get the temporary root path for feature initialization.
     * Pattern: <rootDir>/.feat-forge/tmp/feature-init/
     *
     * @returns The temporary root path
     */
    getTempFeatureRoot(...segments: string[]): string {
        return this.getPathInTemp(TEMP_FEATURE_INIT_FOLDER, ...segments);
    }

    /**
     * Get the temporary worktree path used during feature archiving.
     * Pattern: <rootDir>/.feat-forge/tmp/feature-archive/<slug>/<repoName>/
     *
     * @param slug - The feature slug
     * @param repoName - The repository name
     * @returns The temporary archive worktree path
     */
    getTempArchiveWorktreePathForRepo(slug: string, repoName: string): string {
        return this.getTempArchiveRoot(slug, repoName);
    }

    /**
     * Get the temporary root path for feature archiving.
     * Pattern: <rootDir>/.feat-forge/tmp/feature-archive/
     *
     * @returns The temporary archive root path
     */
    getTempArchiveRoot(...segments: string[]): string {
        return this.getPathInTemp(TEMP_FEATURE_ARCHIVE_FOLDER, ...segments);
    }
}

// export function specsFeaturesRoot(repoRoot: string): string {
//     return path.join(repoRoot, SPECS_FEATURES_FOLDER);
// }

// /**
//  * Path to a specific feature directory.
//  */
// export function specsFeatureDir(repoRoot: string, slug: string): string {
//     return path.join(specsFeaturesRoot(repoRoot), slug);
// }

// /**
//  * Path to the active feature pointer folder (a symlink pointing to the active feature directory).
//  */
// export function activeFeatureFolder(repoRoot: string): string {
//     return path.join(repoRoot, ACTIVE_FEATURE_FOLDER);
// }

// /**
//  * Get the root directory path for a feature (contains all repo worktrees).
//  * Pattern: <worktreesRoot>/<slug>/
//  *
//  * @param worktreesRoot - The root directory where all feature worktrees are stored
//  * @param slug - The feature slug
//  * @returns The feature root directory path
//  */
// export function getFeatureRoot(worktreesRoot: string, slug: string, ...segments: string[]): string {
//     return path.join(worktreesRoot, slug, ...segments);
// }

// /**
//  * Get the relative path to a file within the feature archive directory.
//  * Default Pattern: .features/.archives/<slug>/<file>
//  *
//  * @param segments - Additional path segments within the archive directory
//  * @returns The relative path to the archive file
//  */
// export function getRelativeFeaturesArchivePath(...segments: string[]): string {
//     return path.join(SPECS_FEATURES_FOLDER, ARCHIVES_FOLDER, ...segments);
// }

// /**
//  * Get the relative path to a file within a specific feature specs directory, for use in agent contexts.
//  * Default Pattern: .features/<slug>/<segments>
//  *
//  * @param slug - The feature slug
//  * @param segments - Additional path segments within the feature directory
//  * @returns The relative path to the feature file
//  */
// export function getRelativeFeatureSpecPath(slug: string, ...segments: string[]): string {
//     return path.join(SPECS_FEATURES_FOLDER, slug, ...segments);
// }

// /**
//  * Get the worktree path for a specific repository within a feature.
//  * Pattern: <worktreesRoot>/<slug>/<repoName>/
//  *
//  * @param worktreesRoot - The root directory where all feature worktrees are stored
//  * @param slug - The feature slug
//  * @param repoName - The repository name
//  * @returns The worktree path for the specific repo
//  */
// export function getRepoPathInFeature(worktreesRoot: string, slug: string, repoName: string): string {
//     return path.join(worktreesRoot, slug, repoName);
// }

// /**
//  * Get the relative path to a file within a specific feature specs directory, for use in agent contexts.
//  * Default Pattern: .features/<slug>/agent/<segments>
//  *
//  * @param slug - The feature slug
//  * @param segments - Additional path segments within the agent directory
//  * @returns The relative path to the agent file
//  */
// export function getRelativeSpecsFeatureAgentPath(slug: string, ...segments: string[]): string {
//     return path.join(SPECS_FEATURES_FOLDER, slug, AGENT_FOLDER, ...segments);
// }
