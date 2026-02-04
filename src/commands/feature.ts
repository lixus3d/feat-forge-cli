import path from "path";
import { rm, symlink } from "fs/promises";
import { Command } from "commander";
import { ensureDir, pathExists, writeTextFile } from "../lib/fs";
import { FEATURE_FILES, resolveTemplate, templateFor, ensureAgentTemplates } from "../lib/templates";
import { activeFeatureFile, featureDir, featuresRoot } from "../lib/paths";
import { getGitStatusPorcelain, gitBranchExists, gitPathExistsInBranch, runGit } from "../lib/git";
import { loadForgeConfig } from "../lib/config";
import { promptChoice, promptConfirm, promptText } from "../lib/prompt";
import { confirmSlugOrThrow } from "../lib/slug";

/**
 * Ensure the spec files exist for a feature directory without overwriting existing files.
 * Also creates the agent subdirectory (empty, ready for symlinks).
 */
async function ensureFeatureFiles(repoRoot: string, targetDir: string): Promise<void> {
  await ensureDir(targetDir);

  // Create main feature files
  for (const fileName of FEATURE_FILES) {
    const filePath = path.join(targetDir, fileName);
    if (await pathExists(filePath)) {
      continue;
    }
    const resolved = await resolveTemplate(repoRoot, fileName);
    await writeTextFile(filePath, resolved ?? templateFor(fileName));
  }

  // Create agent subdirectory (but don't populate with templates)
  // Templates will be accessed via symlinks to .features/.template/agent/
  const agentDir = path.join(targetDir, "agent");
  await ensureDir(agentDir);
}

/**
 * Update the active feature pointer in the main repo.
 */
async function setActiveFeature(repoRoot: string, slug: string): Promise<void> {
  await ensureDir(featuresRoot(repoRoot));
  const activePath = activeFeatureFile(repoRoot);
  await rm(activePath, { force: true });
  await symlink(path.join(".features", slug), activePath);
}

class FeatureCommands {
  /**
   * Resolve the configured main repo name or throw if missing.
   */
  private getMainRepoName(repoNames: Map<string, string>, mainRepoRoot: string): string {
    const mainRepoName = repoNames.get(mainRepoRoot);
    if (!mainRepoName) {
      throw new Error(`Missing repo name for ${mainRepoRoot}`);
    }
    return mainRepoName;
  }

  /**
   * Prepare feature branch + spec initialization shared by create/start.
   */
  private async prepareFeature(slug: string): Promise<{
    safeSlug: string;
    branchName: string;
    mainRepoRoot: string;
    repoRoots: string[];
    repoNames: Map<string, string>;
    worktreesRoot: string;
    rootDir: string;
  }> {
    const safeSlug = await confirmSlugOrThrow(slug);
    const { mainRepoRoot, repoRoots, repoNames, worktreesRoot, rootDir } = await loadForgeConfig();
    const branchName = `feature/${safeSlug}`;

    // Ensure agent templates exist in .features/.template/agent/
    await ensureAgentTemplates(mainRepoRoot);

    for (const repoRoot of repoRoots) {
      await this.ensureBranchExists(repoRoot, branchName);
    }

    const mainRepoName = this.getMainRepoName(repoNames, mainRepoRoot);
    const tempRoot = path.join(rootDir, ".feat-forge", "tmp", "feature-init");
    await this.initSpecInBranch(mainRepoRoot, mainRepoName, safeSlug, branchName, tempRoot);

    return { safeSlug, branchName, mainRepoRoot, repoRoots, repoNames, worktreesRoot, rootDir };
  }

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
    const featurePaths = FEATURE_FILES.map((fileName) => path.posix.join(".features", slug, fileName));
    const existing = await Promise.all(
      featurePaths.map((featurePath) => gitPathExistsInBranch(repoRoot, branchName, featurePath)),
    );
    if (existing.every(Boolean)) {
      return;
    }

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
      // Cleanup temp directory
      await rm(tempWorktree, { recursive: true, force: true });
    }
  }

  /**
   * Create a new feature folder and initialize missing spec files.
   */
  async create(slug: string): Promise<void> {
    await this.prepareFeature(slug);
  }

  /**
   * Switch to a feature branch/worktree and update active feature pointer.
   */
  async start(slug: string): Promise<void> {
    const { safeSlug, mainRepoRoot, repoRoots, repoNames, worktreesRoot, branchName } =
      await this.prepareFeature(slug);
    const mainRepoName = this.getMainRepoName(repoNames, mainRepoRoot);

    const featureRoot = path.join(worktreesRoot, safeSlug);
    await ensureDir(featureRoot);

    const worktreeTargets = repoRoots.map((repoRoot) => {
      const repoName = repoNames.get(repoRoot);
      if (!repoName) {
        throw new Error(`Missing repo name for ${repoRoot}`);
      }
      return path.join(featureRoot, repoName);
    });

    const existingWorktrees = await Promise.all(worktreeTargets.map((worktreePath) => pathExists(worktreePath)));
    if (existingWorktrees.every(Boolean)) {
      const mainWorktree = path.join(featureRoot, mainRepoName);
      await setActiveFeature(mainWorktree, safeSlug);
      console.log(`Feature "${safeSlug}" already started.`);
      return;
    }

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

    const mainWorktree = path.join(featureRoot, mainRepoName);
    await setActiveFeature(mainWorktree, safeSlug);
  }

  /**
   * Stop a feature by removing its worktrees and clearing active pointer.
   */
  async stop(slug: string): Promise<void> {
    const safeSlug = await confirmSlugOrThrow(slug);
    const { repoRoots, repoNames, worktreesRoot } = await loadForgeConfig();
    const featureRoot = path.join(worktreesRoot, safeSlug);

    const worktrees = repoRoots.map((repoRoot) => {
      const repoName = repoNames.get(repoRoot);
      if (!repoName) {
        throw new Error(`Missing repo name for ${repoRoot}`);
      }
      return { repoRoot, repoName, worktreePath: path.join(featureRoot, repoName) };
    });

    const dirtyWorktrees = [];
    for (const worktree of worktrees) {
      if (!(await pathExists(worktree.worktreePath))) {
        continue;
      }
      const status = await getGitStatusPorcelain(worktree.worktreePath);
      if (status) {
        dirtyWorktrees.push(worktree);
      }
    }

    if (dirtyWorktrees.length > 0) {
      const action = await this.promptDirtyAction();

      if (action === "B") {
        return;
      }

      if (action === "A") {
        const message = await promptText("Commit message to use");
        if (!message) {
          throw new Error("Commit message is required.");
        }

        for (const worktree of dirtyWorktrees) {
          await runGit(worktree.worktreePath, ["add", "-A"]);
          await runGit(worktree.worktreePath, ["commit", "-m", message]);
          const status = await getGitStatusPorcelain(worktree.worktreePath);
          if (status) {
            throw new Error(`Worktree still dirty after commit: ${worktree.worktreePath}`);
          }
        }
      }

      if (action === "C") {
        const confirmed = await promptConfirm("This will discard local changes. Proceed?");
        if (!confirmed) {
          return;
        }
      }
    }

    for (const worktree of worktrees) {
      if (!(await pathExists(worktree.worktreePath))) {
        continue;
      }
      await runGit(worktree.repoRoot, ["worktree", "remove", "--force", worktree.worktreePath]);
    }

    if (await pathExists(featureRoot)) {
      await rm(featureRoot, { recursive: true, force: true });
    }

  }

  /**
   * Prompt the user for a dirty-worktree action until a valid answer is provided.
   */
  private async promptDirtyAction(): Promise<"A" | "B" | "C"> {
    while (true) {
      const answer = await promptChoice(
        "Worktrees contain uncommitted changes. Choose an action:",
        [
          { key: "A", label: "Commit work in all dirty worktrees" },
          { key: "B", label: "Stop here and do nothing" },
          { key: "C", label: "Discard work and remove worktrees" },
        ],
      );

      const normalized = answer.trim().toUpperCase();
      if (normalized === "A" || normalized === "B" || normalized === "C") {
        return normalized;
      }
    }
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

  function startFeature(slug: string): Promise<void> {
    return handlers.start(slug);
  }

  function stopFeature(slug: string): Promise<void> {
    return handlers.stop(slug);
  }

  feature
    .command("create")
    .argument("<slug>", "Feature slug")
    .description("Create a new feature folder and initialize its spec")
    .action(createFeature);

  feature
    .command("start")
    .argument("<slug>", "Feature slug")
    .description("Create/switch to feature worktrees and set local active feature in that worktree")
    .action(startFeature);

  feature
    .command("stop")
    .argument("<slug>", "Feature slug")
    .description("Stop a feature and remove its worktrees")
    .action(stopFeature);
}
