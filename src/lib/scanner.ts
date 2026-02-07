import { Dirent } from 'fs';
import { readdir, stat, access } from 'fs/promises';
import path from 'path';

export type RepoInfo = { path: string; name: string; isGit: boolean };

const DEFAULT_MAX_DEPTH = 4;
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git']);

async function hasSubdir(dir: string, sub: string): Promise<boolean> {
    try {
        const p = path.join(dir, sub);
        await access(p);
        const s = await stat(p);
        return s.isDirectory();
    } catch {
        return false;
    }
}

async function readDirSafe(dir: string): Promise<Dirent[]> {
    try {
        return await readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
}

function isIgnored(name: string): boolean {
    return IGNORED_DIRS.has(name);
}

export async function scanGitRepos(rootDir: string, maxDepth: number = DEFAULT_MAX_DEPTH): Promise<RepoInfo[]> {
    const results: RepoInfo[] = [];

    async function walk(dir: string, depth: number) {
        if (depth < 0) return;

        const base = path.basename(dir);
        if (isIgnored(base)) return;

        if (await hasSubdir(dir, '.git')) {
            results.push({ path: path.resolve(dir), name: path.basename(dir), isGit: true });
            return;
        }

        const entries = await readDirSafe(dir);
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (isIgnored(e.name)) continue;
            try {
                await walk(path.join(dir, e.name), depth - 1);
            } catch {
                // ignore errors per-directory
            }
        }
    }

    await walk(path.resolve(rootDir), maxDepth);
    return results;
}

export async function findAncestorForgeConfig(startDir: string): Promise<string | null> {
    let current = path.resolve(startDir);
    while (true) {
        const candidate = path.join(current, '.feat-forge.json');
        try {
            await access(candidate);
            return candidate;
        } catch {
            // not found here
        }

        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return null;
}

export async function findFeatureCandidateDirs(rootDir: string): Promise<string[]> {
    const results: string[] = [];
    const maxDepth = 3;

    async function isCandidate(dir: string): Promise<boolean> {
        const name = path.basename(dir).toLowerCase();
        if (name.includes('feature')) return true;
        if (await hasSubdir(dir, 'src')) return true;
        try {
            await access(path.join(dir, 'package.json'));
            return true;
        } catch {
            return false;
        }
    }

    async function walk(dir: string, depth: number) {
        if (depth < 0) return;
        const base = path.basename(dir);
        if (isIgnored(base)) return;

        const entries = await readDirSafe(dir);

        try {
            if (await isCandidate(dir)) {
                results.push(path.resolve(dir));
                return;
            }
        } catch {
            // ignore
        }

        for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (isIgnored(e.name)) continue;
            await walk(path.join(dir, e.name), depth - 1);
        }
    }

    await walk(path.resolve(rootDir), maxDepth);
    return results;
}

export default {};
