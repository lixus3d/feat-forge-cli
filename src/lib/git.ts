import path from "path";
import { execa } from "execa";
import { pathExists } from "./fs";

export async function findGitRoot(startDir: string = process.cwd()): Promise<string> {
  let current = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(current, ".git");
    if (await pathExists(gitPath)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Not inside a git repository (no .git directory found).");
    }
    current = parent;
  }
}

/**
 * Run a git command inside the given repo root.
 */
export async function runGit(repoRoot: string, args: string[]): Promise<void> {
  await execa("git", args, { cwd: repoRoot, stdio: "inherit" });
}

/**
 * Return git status porcelain output for the given working directory.
 */
export async function getGitStatusPorcelain(cwd: string): Promise<string> {
  const result = await execa("git", ["status", "--porcelain"], { cwd });
  return result.stdout.trim();
}

/**
 * Return true if a branch exists.
 */
export async function gitBranchExists(repoRoot: string, branchName: string): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--verify", branchName], { cwd: repoRoot });
    return true;
  } catch {
    return false;
  }
}

/**
 * Return true if a path exists in the given branch.
 */
export async function gitPathExistsInBranch(
  repoRoot: string,
  branchName: string,
  targetPath: string,
): Promise<boolean> {
  try {
    await execa("git", ["cat-file", "-e", `${branchName}:${targetPath}`], { cwd: repoRoot });
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
    const result = await execa("git", ["branch", "--show-current"], { cwd: repoRoot });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Checkout a branch in a repo.
 */
export async function checkoutBranch(repoRoot: string, branchName: string): Promise<void> {
  await execa("git", ["checkout", branchName], { cwd: repoRoot, stdio: "inherit" });
}

/**
 * Get all worktrees for a repo with their paths and branches.
 */
export async function getWorktrees(repoRoot: string): Promise<Array<{ path: string; branch: string }>> {
  try {
    const result = await execa("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot });
    const lines = result.stdout.split("\n");
    const worktrees: Array<{ path: string; branch: string }> = [];
    
    let currentPath = "";
    let currentBranch = "";
    
    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        currentPath = line.substring("worktree ".length);
      } else if (line.startsWith("branch ")) {
        currentBranch = line.substring("branch ".length).replace(/^refs\/heads\//, "");
      } else if (line === "" && currentPath) {
        if (currentBranch) {
          worktrees.push({ path: currentPath, branch: currentBranch });
        }
        currentPath = "";
        currentBranch = "";
      }
    }
    
    // Handle last entry if file doesn't end with blank line
    if (currentPath && currentBranch) {
      worktrees.push({ path: currentPath, branch: currentBranch });
    }
    
    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Remove an orphaned worktree (worktree path that no longer exists).
 */
export async function removeOrphanedWorktree(repoRoot: string, worktreePath: string): Promise<void> {
  await execa("git", ["worktree", "remove", "--force", worktreePath], { cwd: repoRoot });
}
