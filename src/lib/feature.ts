import path from "path";
import { lstat, readlink } from "fs/promises";
import { pathExists } from "./fs";
import { activeFeatureFile } from "./paths";

export type ActiveFeature = {
  slug: string;
  featurePath: string;
};

/**
 * Resolve the active feature directory from the main repo root.
 */
export async function resolveActiveFeature(mainRepoRoot: string): Promise<ActiveFeature> {
  const activePath = activeFeatureFile(mainRepoRoot);
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
