import path from "path";
import { lstat, readlink } from "fs/promises";
import { pathExists } from "./fs";
import { activeFeatureFile } from "./paths";

export type ActiveFeature = {
  slug: string;
  featurePath: string;
};

/**
 * Resolve the active feature directory from a repo root
 */
export async function resolveActiveFeature(repoRoot: string): Promise<ActiveFeature> {
  const activePath = activeFeatureFile(repoRoot);
  if (!(await pathExists(activePath))) {
    throw new Error("No active feature found in this worktree. Run 'forge feature start <slug>' first.");
  }

  const stat = await lstat(activePath);
  if (!stat.isSymbolicLink()) {
    throw new Error(`Active feature pointer is not a symlink: ${activePath}`);
  }

  const target = await readlink(activePath);
  const featurePath = path.resolve(path.dirname(activePath), target);
  if (!(await pathExists(featurePath))) {
    throw new Error(`Active feature directory does not exist: ${featurePath}`);
  }

  return { slug: path.basename(featurePath), featurePath };
}

/**
 * Get the root directory path for a feature (contains all repo worktrees).
 * Pattern: <worktreesRoot>/<slug>/
 *
 * @param worktreesRoot - The root directory where all feature worktrees are stored
 * @param slug - The feature slug
 * @returns The feature root directory path
 */
export function getFeatureRoot(worktreesRoot: string, slug: string): string {
  return path.join(worktreesRoot, slug);
}

/**
 * Get the worktree path for a specific repository within a feature.
 * Pattern: <worktreesRoot>/<slug>/<repoName>/
 *
 * @param worktreesRoot - The root directory where all feature worktrees are stored
 * @param slug - The feature slug
 * @param repoName - The repository name
 * @returns The worktree path for the specific repo
 */
export function getFeatureWorktreePath(worktreesRoot: string, slug: string, repoName: string): string {
  return path.join(worktreesRoot, slug, repoName);
}

/**
 * Get the temporary worktree path used during feature initialization.
 * Pattern: <rootDir>/.feat-forge/tmp/feature-init/<slug>/<repoName>/
 *
 * @param rootDir - The root directory of the workspace
 * @param slug - The feature slug
 * @param repoName - The repository name
 * @returns The temporary worktree path
 */
export function getTempFeatureWorktreePath(rootDir: string, slug: string, repoName: string): string {
  return path.join(rootDir, ".feat-forge", "tmp", "feature-init", slug, repoName);
}

/**
 * Get the temporary root path for feature initialization.
 * Pattern: <rootDir>/.feat-forge/tmp/feature-init/
 *
 * @param rootDir - The root directory of the workspace
 * @returns The temporary root path
 */
export function getTempFeatureRoot(rootDir: string): string {
  return path.join(rootDir, ".feat-forge", "tmp", "feature-init");
}

/**
 * Get the temporary worktree path used during feature archiving.
 * Pattern: <rootDir>/.feat-forge/tmp/feature-archive/<slug>/<repoName>/
 *
 * @param rootDir - The root directory of the workspace
 * @param slug - The feature slug
 * @param repoName - The repository name
 * @returns The temporary archive worktree path
 */
export function getTempArchiveWorktreePath(rootDir: string, slug: string, repoName: string): string {
  return path.join(rootDir, ".feat-forge", "tmp", "feature-archive", slug, repoName);
}

/**
 * Get the temporary root path for feature archiving.
 * Pattern: <rootDir>/.feat-forge/tmp/feature-archive/
 *
 * @param rootDir - The root directory of the workspace
 * @returns The temporary archive root path
 */
export function getTempArchiveRoot(rootDir: string): string {
  return path.join(rootDir, ".feat-forge", "tmp", "feature-archive");
}
