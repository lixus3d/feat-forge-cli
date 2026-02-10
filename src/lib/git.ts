import path from 'path';
import { execa } from 'execa';
import { pathExists } from './fs';

/**
 * Result of a git operation (merge/rebase) for a single repository
 */
export type GitOperationResult = {
    repo: string;
    success: boolean;
    hasConflicts: boolean;
};

export enum GitOperation {
    Merge = 'merge',
    Rebase = 'rebase',
}

export type GitWorktreeInfo = {
    path: string;
    branch: string;
};

export async function findGitRoot(startDir: string = process.cwd()): Promise<string> {
    let current = path.resolve(startDir);
    while (true) {
        const gitPath = path.join(current, '.git');
        if (await pathExists(gitPath)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            throw new Error('Not inside a git repository (no .git directory found).');
        }
        current = parent;
    }
}

/**
 * Run a git command inside the given repo root.
 */
export async function runGit(repoRoot: string, args: string[]): Promise<void> {
    await execa('git', args, { cwd: repoRoot, stdio: 'inherit' });
}

/**
 * Return git status porcelain output for the given working directory.
 */
export async function getGitStatusPorcelain(cwd: string): Promise<string> {
    const result = await execa('git', ['status', '--porcelain'], { cwd });
    return result.stdout.trim();
}

/**
 * Return true if a branch exists.
 */
export async function gitBranchExists(repoRoot: string, branchName: string): Promise<boolean> {
    try {
        await execa('git', ['rev-parse', '--verify', branchName], { cwd: repoRoot });
        return true;
    } catch {
        return false;
    }
}

/**
 * Return true if a path exists in the given branch.
 */
export async function gitPathExistsInBranch(repoRoot: string, branchName: string, targetPath: string): Promise<boolean> {
    try {
        await execa('git', ['cat-file', '-e', `${branchName}:${targetPath}`], { cwd: repoRoot });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the current branch name for a repo.
 */
export async function getCurrentBranch(repoRoot: string): Promise<string | null> {
    try {
        const result = await execa('git', ['branch', '--show-current'], { cwd: repoRoot });
        return result.stdout.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Checkout a branch in a repo.
 */
export async function checkoutBranch(repoRoot: string, branchName: string): Promise<void> {
    await execa('git', ['checkout', branchName], { cwd: repoRoot, stdio: 'inherit' });
}

/**
 * Create a new branch in a repo.
 */
export async function createBranch(repoRoot: string, branchName: string): Promise<void> {
    await runGit(repoRoot, ['branch', branchName]);
}

/**
 * Get all branches in a repo.
 */

export async function getBranches(repoRoot: string): Promise<string[]> {
    const result = await execa('git', ['branch', '--format=%(refname:short)'], { cwd: repoRoot });
    return result.stdout.split('\n').filter((b: string) => b.trim().length > 0);
}

/**
 * Get all worktrees for a repo with their paths and branches.
 */
export async function getGitWorktrees(repoRoot: string): Promise<Array<GitWorktreeInfo>> {
    try {
        const result = await execa('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot });
        const lines = result.stdout.split('\n');
        const worktrees: Array<GitWorktreeInfo> = [];

        let currentPath = '';
        let currentBranch = '';

        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                currentPath = line.substring('worktree '.length);
            } else if (line.startsWith('branch ')) {
                currentBranch = line.substring('branch '.length).replace(/^refs\/heads\//, '');
            } else if (line === '' && currentPath) {
                if (currentBranch) {
                    worktrees.push({ path: currentPath, branch: currentBranch });
                }
                currentPath = '';
                currentBranch = '';
            }
        }

        // Handle last entry if file doesn't end with blank line
        if (currentPath && currentBranch) {
            worktrees.push({ path: currentPath, branch: currentBranch });
        }

        return worktrees;
    } catch {
        throw new Error(
            `Failed to get worktrees for repo at ${repoRoot}. Ensure it's a valid git repository and that git is installed.`,
        );
    }
}

/**
 * Display summary of git operation results.
 *
 * @param results - Array of operation results
 * @param operationType - Name of the operation (e.g., "merge", "rebase")
 */
export function displayOperationSummary(results: GitOperationResult[], operationType: GitOperation): void {
    console.log(`\n=== ${operationType.charAt(0).toUpperCase() + operationType.slice(1)} Summary ===`);

    const successful = results.filter((r) => r.success);
    const conflicts = results.filter((r) => r.hasConflicts);
    const failed = results.filter((r) => !r.success && !r.hasConflicts);

    if (successful.length > 0) {
        console.log(`\n✅ Successful ${operationType}s (${successful.length}):`);
        successful.forEach((r) => console.log(`   - ${r.repo}`));
    }

    if (conflicts.length > 0) {
        console.log(`\n⚠️  Conflicts to resolve (${conflicts.length}):`);
        conflicts.forEach((r) => console.log(`   - ${r.repo}`));
    }

    if (failed.length > 0) {
        console.log(`\n❌ Failed ${operationType}s (${failed.length}):`);
        failed.forEach((r) => console.log(`   - ${r.repo}`));
    }
}
