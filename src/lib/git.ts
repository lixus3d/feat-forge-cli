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
    /** Optional short detail displayed next to the repo name in the summary (e.g. "up to date") */
    note?: string;
};

export enum GitOperation {
    Merge = 'merge',
    Rebase = 'rebase',
    Pull = 'pull',
    Push = 'push',
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
 * Return the upstream ref (e.g. "origin/feature/x") of a branch, or null if none is configured.
 * Without `branchName`, the current branch (HEAD) is used.
 */
export async function getUpstreamBranch(repoRoot: string, branchName?: string): Promise<string | null> {
    try {
        const result = await execa('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branchName ?? ''}@{u}`], {
            cwd: repoRoot,
        });
        return result.stdout.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Return the upstream configuration of a local branch (remote name and remote ref), or null if none is configured.
 * Example: { remote: 'origin', mergeRef: 'refs/heads/main' }
 */
export async function getBranchUpstreamConfig(
    repoRoot: string,
    branchName: string,
): Promise<{ remote: string; mergeRef: string } | null> {
    try {
        const remote = (await execa('git', ['config', '--get', `branch.${branchName}.remote`], { cwd: repoRoot })).stdout.trim();
        const mergeRef = (await execa('git', ['config', '--get', `branch.${branchName}.merge`], { cwd: repoRoot })).stdout.trim();
        return remote && mergeRef ? { remote, mergeRef } : null;
    } catch {
        return null;
    }
}

/**
 * Count commits ahead/behind of a branch compared to its upstream (based on local remote refs).
 * Without `branchName`, the current branch (HEAD) is used.
 */
export async function getAheadBehind(repoRoot: string, branchName?: string): Promise<{ ahead: number; behind: number }> {
    const range = branchName ? `${branchName}...${branchName}@{u}` : 'HEAD...@{u}';
    const result = await execa('git', ['rev-list', '--left-right', '--count', range], { cwd: repoRoot });
    const [ahead, behind] = result.stdout
        .trim()
        .split(/\s+/)
        .map((value) => Number.parseInt(value, 10));
    return { ahead: ahead || 0, behind: behind || 0 };
}

/**
 * Return true if the given remote is configured in the repository.
 */
export async function hasRemote(repoRoot: string, remoteName: string): Promise<boolean> {
    try {
        const result = await execa('git', ['remote'], { cwd: repoRoot });
        return result.stdout
            .split('\n')
            .map((line) => line.trim())
            .includes(remoteName);
    } catch {
        return false;
    }
}

/**
 * Fetch all remotes for a repository so remote refs are up to date before
 * checking whether a branch exists remotely.
 */
export async function fetchAllRemotes(repoRoot: string): Promise<void> {
    await execa('git', ['fetch', '--all', '--prune', '--quiet'], { cwd: repoRoot, stdio: 'inherit' });
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
        await execa('git', ['rev-parse', '--verify', `refs/heads/${branchName}`], { cwd: repoRoot });
        return true;
    } catch {
        return false;
    }
}

/**
 * Return the remote tracking ref for a branch if it exists, after fetching remotes.
 */
export async function gitRemoteBranchRef(repoRoot: string, branchName: string): Promise<string | null> {
    try {
        await fetchAllRemotes(repoRoot);
        const result = await execa('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], { cwd: repoRoot });
        const refs = result.stdout
            .split('\n')
            .map((ref) => ref.trim())
            .filter((ref) => ref.length > 0 && !ref.endsWith('/HEAD'));

        const exactMatch = refs.find((ref) => ref === branchName || ref.endsWith(`/${branchName}`));
        return exactMatch ?? null;
    } catch {
        return null;
    }
}

/**
 * Return true if a branch exists locally or as a remote tracking ref.
 */
export async function gitBranchExistsAnywhere(repoRoot: string, branchName: string): Promise<boolean> {
    if (await gitBranchExists(repoRoot, branchName)) {
        return true;
    }
    return (await gitRemoteBranchRef(repoRoot, branchName)) !== null;
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
export async function createBranch(repoRoot: string, branchName: string, baseBranch?: string): Promise<void> {
    if (await gitBranchExists(repoRoot, branchName)) {
        return;
    }

    const remoteBranchRef = await gitRemoteBranchRef(repoRoot, branchName);
    const args = ['branch'];
    if (remoteBranchRef) {
        args.push('--track', branchName, remoteBranchRef);
    } else if (baseBranch) {
        args.push(branchName, baseBranch);
    } else {
        args.push(branchName);
    }
    await runGit(repoRoot, args);
}

/**
 * Get all branches in a repo.
 */

export async function getBranches(repoRoot: string, prefix?: string): Promise<string[]> {
    const args = ['branch', '--format=%(refname:short)'];
    if (prefix) {
        args.push('--list', `${prefix}*`);
    }
    const result = await execa('git', args, { cwd: repoRoot });
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
 * Return the absolute path of the git directory shared by all worktrees of a repository (e.g. "<repo>/.git").
 */
export async function getGitCommonDir(repoRoot: string): Promise<string> {
    const result = await execa('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repoRoot });
    return result.stdout.trim();
}

/**
 * Return the path of the worktree (main working tree included) where a branch is checked out, or null.
 */
export async function getBranchCheckoutPath(repoRoot: string, branchName: string): Promise<string | null> {
    const worktrees = (await getGitWorktrees(repoRoot)) ?? [];
    return worktrees.find((wt) => wt.branch === branchName)?.path ?? null;
}

export type FastForwardStatus = 'updated' | 'up-to-date' | 'ahead' | 'diverged' | 'no-upstream';

/**
 * Fast-forward a local branch that is NOT checked out to its upstream, using the already fetched remote refs.
 * Only moves the ref when the branch is strictly behind (never rewrites local commits).
 * Note: must not be used on a checked out branch (the working tree would not follow the ref).
 */
export async function fastForwardBranchRef(repoRoot: string, branchName: string): Promise<FastForwardStatus> {
    const upstream = await getUpstreamBranch(repoRoot, branchName);
    if (!upstream) {
        return 'no-upstream';
    }
    const { ahead, behind } = await getAheadBehind(repoRoot, branchName);
    if (behind === 0) {
        return ahead === 0 ? 'up-to-date' : 'ahead';
    }
    if (ahead > 0) {
        return 'diverged';
    }
    const oldSha = (await execa('git', ['rev-parse', `refs/heads/${branchName}`], { cwd: repoRoot })).stdout.trim();
    const newSha = (await execa('git', ['rev-parse', `${branchName}@{u}`], { cwd: repoRoot })).stdout.trim();
    // Passing the old value makes update-ref atomic: it fails if the branch moved in the meantime
    await execa(
        'git',
        ['update-ref', '-m', `forge: fast-forward ${branchName} to ${upstream}`, `refs/heads/${branchName}`, newSha, oldSha],
        {
            cwd: repoRoot,
        },
    );
    return 'updated';
}

/**
 * Display summary of git operation results.
 *
 * @param results - Array of operation results
 * @param operationType - Name of the operation (e.g., "merge", "rebase")
 */
export function displayOperationSummary(
    results: GitOperationResult[],
    operationType: GitOperation,
): {
    successful: GitOperationResult[];
    conflicts: GitOperationResult[];
    failed: GitOperationResult[];
} {
    console.log(`\n=== ${operationType.charAt(0).toUpperCase() + operationType.slice(1)} Summary ===`);

    const successful = results.filter((r) => r.success);
    const conflicts = results.filter((r) => r.hasConflicts);
    const failed = results.filter((r) => !r.success && !r.hasConflicts);

    if (successful.length > 0) {
        console.log(`\n✅ Successful ${operationType}s (${successful.length}):`);
        successful.forEach((r) => console.log(`   - ${r.repo}${r.note ? ` (${r.note})` : ''}`));
    }

    if (conflicts.length > 0) {
        console.log(`\n⚠️  Conflicts to resolve (${conflicts.length}):`);
        conflicts.forEach((r) => console.log(`   - ${r.repo}`));
    }

    if (failed.length > 0) {
        console.log(`\n❌ Failed ${operationType}s (${failed.length}):`);
        failed.forEach((r) => console.log(`   - ${r.repo}${r.note ? ` (${r.note})` : ''}`));
    }

    // Summary message
    if (conflicts.length === 0 && failed.length === 0) {
        console.log(`\n🎉 All ${operationType}s completed successfully!`);
    } else {
        console.log(`\n⚠️  Some ${operationType}s need attention. Please resolve conflicts or errors before continuing.`);
        if (operationType === GitOperation.Push) {
            console.log(`After fixing the errors, run the push again.`);
        } else {
            console.log(`After resolving conflicts, you can continue with: git ${operationType} --continue`);
        }
    }

    return {
        successful,
        conflicts,
        failed,
    };
}
