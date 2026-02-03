import path from "path";
import { Command } from "commander";
import { ensureDir, pathExists, writeTextFile } from "../lib/fs";
import { FEATURE_FILES, resolveTemplate, templateFor } from "../lib/templates";
import { activeFeatureFile, featureDir, featuresRoot } from "../lib/paths";
import { getGitStatusPorcelain, gitBranchExists, runGit } from "../lib/git";
import { loadForgeConfig } from "../lib/config";

/**
 * Ensure the spec files exist for a feature directory without overwriting existing files.
 */
/**
 * Ensure the spec files exist for a feature directory without overwriting existing files.
 */
async function ensureFeatureFiles(repoRoot: string, targetDir: string): Promise<void> {
  await ensureDir(targetDir);
  for (const fileName of FEATURE_FILES) {
    const filePath = path.join(targetDir, fileName);
    if (await pathExists(filePath)) {
      continue;
    }
    const resolved = await resolveTemplate(repoRoot, fileName);
    await writeTextFile(filePath, resolved ?? templateFor(fileName));
  }
}

/**
 * Update the active feature pointer.
 */
/**
 * Update the active feature pointer in the main repo.
 */
async function setActiveFeature(repoRoot: string, slug: string): Promise<void> {
  await ensureDir(featuresRoot(repoRoot));
  await writeTextFile(activeFeatureFile(repoRoot), `${slug}\n`);
}

class FeatureCommands {
  /**
   * Ensure the feature branch exists for a repo, without checking it out.
   */
  private async ensureBranchExists(repoRoot: string, branchName: string): Promise<void> {
    if (await gitBranchExists(repoRoot, branchName)) {
      return;
    }
    await runGit(repoRoot, ["branch", branchName]);
  }

  /**
   * Initialize feature spec files in the main repo branch using a temporary worktree.
   */
  private async initSpecInBranch(
    repoRoot: string,
    repoName: string,
    slug: string,
    branchName: string,
    tempRoot: string,
  ): Promise<void> {
    const tempWorktree = path.join(tempRoot, slug, repoName);
    await ensureDir(path.dirname(tempWorktree));
    if (await pathExists(tempWorktree)) {
      throw new Error(`Temp worktree already exists at ${tempWorktree}`);
    }

    await runGit(repoRoot, ["worktree", "add", tempWorktree, branchName]);
    try {
      const featurePath = featureDir(tempWorktree, slug);
      await ensureFeatureFiles(tempWorktree, featurePath);
      await runGit(tempWorktree, ["add", path.join(".features", slug)]);

      const status = await getGitStatusPorcelain(tempWorktree);
      if (status) {
        await runGit(tempWorktree, ["commit", "-m", `docs(${slug}): init feature spec`]);
      }
    } finally {
      await runGit(repoRoot, ["worktree", "remove", "--force", tempWorktree]);
    }
  }

  /**
   * Create a new feature folder and initialize missing spec files.
   */
  async create(slug: string): Promise<void> {
    const { mainRepoRoot, repoRoots, repoNames, rootDir } = await loadForgeConfig();
    const branchName = `feature/${slug}`;

    for (const repoRoot of repoRoots) {
      await this.ensureBranchExists(repoRoot, branchName);
    }

    const mainRepoName = repoNames.get(mainRepoRoot);
    if (!mainRepoName) {
      throw new Error(`Missing repo name for ${mainRepoRoot}`);
    }

    const tempRoot = path.join(rootDir, ".feat-forge", "tmp", "feature-init");
    await this.initSpecInBranch(mainRepoRoot, mainRepoName, slug, branchName, tempRoot);

    await setActiveFeature(mainRepoRoot, slug);
  }

  /**
   * Switch to a feature branch/worktree and update active feature pointer.
   */
  async use(slug: string): Promise<void> {
    const { mainRepoRoot, repoRoots, repoNames, worktreesRoot, rootDir } = await loadForgeConfig();
    const branchName = `feature/${slug}`;

    for (const repoRoot of repoRoots) {
      await this.ensureBranchExists(repoRoot, branchName);
    }

    const mainRepoName = repoNames.get(mainRepoRoot);
    if (!mainRepoName) {
      throw new Error(`Missing repo name for ${mainRepoRoot}`);
    }

    const tempRoot = path.join(rootDir, ".feat-forge", "tmp", "feature-init");
    await this.initSpecInBranch(mainRepoRoot, mainRepoName, slug, branchName, tempRoot);

    const featureRoot = path.join(worktreesRoot, slug);
    await ensureDir(featureRoot);

    for (const repoRoot of repoRoots) {
      const repoName = repoNames.get(repoRoot);
      if (!repoName) {
        throw new Error(`Missing repo name for ${repoRoot}`);
      }
      const worktreePath = path.join(featureRoot, repoName);
      if (await pathExists(worktreePath)) {
        throw new Error(`Worktree already exists at ${worktreePath}`);
      }

      if (await gitBranchExists(repoRoot, branchName)) {
        await runGit(repoRoot, ["worktree", "add", worktreePath, branchName]);
      } else {
        await runGit(repoRoot, ["worktree", "add", "-b", branchName, worktreePath]);
      }
    }

    await setActiveFeature(mainRepoRoot, slug);
  }
}

/**
 * Register feature subcommands on the main CLI program.
 */
export function registerFeatureCommands(program: Command): void {
  const feature = program.command("feature").description("Manage feature lifecycle");
  const handlers = new FeatureCommands();

  function createFeature(slug: string): Promise<void> {
    return handlers.create(slug);
  }

  function useFeature(slug: string): Promise<void> {
    return handlers.use(slug);
  }

  feature
    .command("create")
    .argument("<slug>", "Feature slug")
    .description("Create a new feature folder and activate it")
    .action(createFeature);

  feature
    .command("use")
    .argument("<slug>", "Feature slug")
    .description("Switch to a feature branch/worktree and activate it")
    .action(useFeature);
}
