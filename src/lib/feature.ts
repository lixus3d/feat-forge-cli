import { lstat, readlink } from 'fs/promises';
import path from 'path';
import { pathExists } from './fs';
import { FeatureContext } from '../foundation/FeatureContext';

export type ActiveFeature = {
    slug: string;
    specsPath: string;
    featureRoot: string;
};

/**
 * Resolve the active feature directory from a repo root
 */
export async function resolveActiveFeature(repoRoot: string): Promise<ActiveFeature> {
    const activePath = activeFeatureFolder(repoRoot);
    if (!(await pathExists(activePath))) {
        throw new Error("No active feature found in this worktree. Run 'forge feature start <slug>' first.");
    }

    const stat = await lstat(activePath);
    if (!stat.isSymbolicLink()) {
        throw new Error(`Active feature pointer is not a symlink: ${activePath}`);
    }

    const target = await readlink(activePath);
    const specsPath = path.resolve(path.dirname(activePath), target);
    if (!(await pathExists(specsPath))) {
        throw new Error(`Active feature directory does not exist: ${specsPath}`);
    }

    return { slug: path.basename(specsPath), specsPath, featureRoot: path.dirname(repoRoot) };
}
