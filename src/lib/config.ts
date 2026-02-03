import path from "path";
import { readFile } from "fs/promises";
import { pathExists } from "./fs";

export type ForgeConfig = {
  repoPaths: string[];
  mainRepo?: string;
  worktreesPath?: string;
};

export type ForgeContext = {
  rootDir: string;
  repoRoots: string[];
  mainRepoRoot: string;
  repoNames: Map<string, string>;
  worktreesRoot: string;
};

/**
 * Find the nearest .feat-forge.json by walking up from startDir.
 */
export async function findConfigPath(startDir: string = process.cwd()): Promise<string> {
  let current = path.resolve(startDir);
  while (true) {
    const configPath = path.join(current, ".feat-forge.json");
    if (await pathExists(configPath)) {
      return configPath;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Missing .feat-forge.json. Run the CLI from a configured root folder.");
    }
    current = parent;
  }
}

/**
 * Load and validate the Forge config from the nearest root.
 */
export async function loadForgeConfig(startDir: string = process.cwd()): Promise<ForgeContext> {
  const configPath = await findConfigPath(startDir);
  const rootDir = path.dirname(configPath);
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ForgeConfig>;

  if (!parsed.repoPaths || parsed.repoPaths.length === 0) {
    throw new Error('Invalid .feat-forge.json: missing required "repoPaths" array.');
  }

  const repoRoots = parsed.repoPaths.map((repoPath) => path.resolve(rootDir, repoPath));
  const worktreesRoot = path.resolve(rootDir, parsed.worktreesPath ?? "features");
  const repoNames = new Map<string, string>();

  for (const repoRoot of repoRoots) {
    const gitDir = path.join(repoRoot, ".git");
    if (!(await pathExists(gitDir))) {
      throw new Error(`Configured repoPath is not a git repo: ${repoRoot}`);
    }
    repoNames.set(repoRoot, path.basename(repoRoot));
  }

  const mainRepoRoot = resolveMainRepoRoot(repoRoots, repoNames, parsed.mainRepo);

  return { rootDir, repoRoots, mainRepoRoot, repoNames, worktreesRoot };
}

/**
 * Resolve the main repo root from config, defaulting to the first repoPath.
 */
function resolveMainRepoRoot(
  repoRoots: string[],
  repoNames: Map<string, string>,
  mainRepo?: string,
): string {
  if (!mainRepo) {
    return repoRoots[0];
  }

  const byPath = repoRoots.find((repoRoot) => repoRoot.endsWith(path.normalize(mainRepo)));
  if (byPath) {
    return byPath;
  }

  for (const repoRoot of repoRoots) {
    if (repoNames.get(repoRoot) === mainRepo) {
      return repoRoot;
    }
  }

  throw new Error(`mainRepo does not match any repoPaths: ${mainRepo}`);
}
