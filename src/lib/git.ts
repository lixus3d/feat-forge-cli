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
export async function getGitStatusPorcelain(repoRoot: string): Promise<string> {
  const result = await execa("git", ["status", "--porcelain"], { cwd: repoRoot });
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
