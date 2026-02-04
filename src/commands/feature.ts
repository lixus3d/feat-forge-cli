import path from "path";
import { rm, symlink, readdir } from "fs/promises";
import { Command } from "commander";
import { ensureDir, pathExists, writeTextFile, ensureGitIgnore } from "../lib/fs";
import { FEATURE_FILES, resolveTemplate, templateFor, ensureAgentTemplates } from "../lib/templates";
import { activeFeatureFile, featureDir, featuresRoot } from "../lib/paths";
import { getGitStatusPorcelain, gitBranchExists, gitPathExistsInBranch, runGit, getCurrentBranch, checkoutBranch, getWorktrees, removeOrphanedWorktree } from "../lib/git";
import { Agent, IDE, loadForgeConfig } from "../lib/config";
import { promptChoice, promptConfirm, promptText } from "../lib/prompt";
import { confirmSlugOrThrow } from "../lib/slug";
import { createIDEWorkspaces } from "../lib/ide";

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
 * Update the active feature pointers:
 * - Main repo: .active-feature → .features/<slug>/
 * - Secondary repos: .active-feature → ../main-repo/.active-feature
 */
async function setActiveFeature(
  mainRepoWorktree: string,
  secondaryRepoWorktrees: string[],
  mainRepoName: string,
  slug: string,
): Promise<void> {
  // Set .active-feature in main repo pointing to .features/<slug>/
  await ensureDir(featuresRoot(mainRepoWorktree));
  const mainActivePath = activeFeatureFile(mainRepoWorktree);
  await rm(mainActivePath, { force: true });
  await symlink(path.join(".features", slug), mainActivePath);

  // Set .active-feature in secondary repos pointing to main repo's .active-feature
  for (const secondaryWorktree of secondaryRepoWorktrees) {
    const secondaryActivePath = activeFeatureFile(secondaryWorktree);
    await rm(secondaryActivePath, { force: true });
    // Create relative path from secondary to main's .active-feature
    const relativePathToMain = path.join("..", mainRepoName, ".active-feature");
    await symlink(relativePathToMain, secondaryActivePath);
  }
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
    agents: Agent[];
    ides: IDE[];
  }> {
    const safeSlug = await confirmSlugOrThrow(slug);
    const { mainRepoRoot, repoRoots, repoNames, worktreesRoot, rootDir, agents, ides } = await loadForgeConfig();
    const branchName = `feature/${safeSlug}`;

    // Ensure agent templates exist in .features/.template/agent/
    await ensureAgentTemplates(mainRepoRoot);
    await ensureGitIgnore(repoRoots);

    for (const repoRoot of repoRoots) {
      await this.ensureBranchExists(repoRoot, branchName);
    }

    const mainRepoName = this.getMainRepoName(repoNames, mainRepoRoot);
    const tempRoot = path.join(rootDir, ".feat-forge", "tmp", "feature-init");
    await this.initSpecInBranch(mainRepoRoot, mainRepoName, safeSlug, branchName, tempRoot);

    return { safeSlug, branchName, mainRepoRoot, repoRoots, repoNames, worktreesRoot, rootDir, agents, ides };
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
    const { safeSlug, mainRepoRoot, repoRoots, repoNames, worktreesRoot, branchName, agents, ides } =
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
      const secondaryWorktrees = repoRoots
        .filter(r => repoNames.get(r) !== mainRepoName)
        .map(r => path.join(featureRoot, repoNames.get(r)!));
      await setActiveFeature(mainWorktree, secondaryWorktrees, mainRepoName, safeSlug);

      // Create IDE workspaces if needed
      if (ides.length > 0) {
        await createIDEWorkspaces(safeSlug, featureRoot, mainRepoName, repoNames, ides, agents);
      }

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
        throw new Error(
          `Worktree already exists at ${worktreePath}.\n` +
          `If you have manually deleted worktree folders, run 'forge feature stop ${safeSlug}' to clean up.`
        );
      }

      if (await gitBranchExists(repoRoot, branchName)) {
        await runGit(repoRoot, ["worktree", "add", worktreePath, branchName]);
      } else {
        await runGit(repoRoot, ["worktree", "add", "-b", branchName, worktreePath]);
      }
    }

    const mainWorktree = path.join(featureRoot, mainRepoName);
    const secondaryWorktrees = repoRoots
      .filter(r => repoNames.get(r) !== mainRepoName)
      .map(r => path.join(featureRoot, repoNames.get(r)!));
    await setActiveFeature(mainWorktree, secondaryWorktrees, mainRepoName, safeSlug);

    // Create IDE workspaces
    if (ides.length > 0) {
      await createIDEWorkspaces(safeSlug, featureRoot, mainRepoName, repoNames, ides, agents);
    }
  }

  /**
   * List all feature worktrees with their git branches.
   */
  async list(): Promise<void> {
    const { worktreesRoot, repoRoots, repoNames } = await loadForgeConfig();

    if (!(await pathExists(worktreesRoot))) {
      console.log("No features directory found.");
      return;
    }

    const entries = await readdir(worktreesRoot, { withFileTypes: true });
    const featureDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    if (featureDirs.length === 0) {
      console.log("No feature worktrees found.");
      return;
    }

    console.log("Feature worktrees:");
    for (const slug of featureDirs.sort()) {
      const featureRoot = path.join(worktreesRoot, slug);
      const branches: Map<string, string> = new Map();

      // Get branch for each repo in this feature worktree
      for (const repoRoot of repoRoots) {
        const repoName = repoNames.get(repoRoot);
        if (!repoName) continue;

        const worktreePath = path.join(featureRoot, repoName);
        if (await pathExists(worktreePath)) {
          const branch = await getCurrentBranch(worktreePath);
          if (branch) {
            branches.set(repoName, branch);
          }
        }
      }

      // Format output based on branch consistency
      const uniqueBranches = new Set(branches.values());
      let branchInfo = "";
      let isInconsistent = false;

      if (uniqueBranches.size === 0) {
        branchInfo = " (no branch info)";
      } else if (uniqueBranches.size === 1) {
        // All repos on same branch
        branchInfo = ` (branch: ${Array.from(uniqueBranches)[0]})`;
      } else {
        // Different branches across repos - show all
        isInconsistent = true;
        const branchList = Array.from(branches.entries())
          .map(([repo, branch]) => `${repo}: ${branch}`)
          .join(", ");
        branchInfo = ` (${branchList})`;
      }

      // Use red color for inconsistent branches
      const RED = "\x1b[31m";
      const RESET = "\x1b[0m";
      const output = isInconsistent
        ? `  - ${slug}${RED}${branchInfo}${RESET}`
        : `  - ${slug}${branchInfo}`;

      console.log(output);
    }
  }

  /**
   * Resync all repos in a feature worktree to the correct branch.
   */
  async resync(slug: string): Promise<void> {
    const safeSlug = await confirmSlugOrThrow(slug);
    const { worktreesRoot, repoRoots, repoNames } = await loadForgeConfig();
    const featureRoot = path.join(worktreesRoot, safeSlug);

    if (!(await pathExists(featureRoot))) {
      throw new Error(`Feature worktree not found: ${safeSlug}`);
    }

    const expectedBranch = `feature/${safeSlug}`;
    console.log(`Resyncing feature "${safeSlug}" to branch "${expectedBranch}"...`);

    let hasErrors = false;

    for (const repoRoot of repoRoots) {
      const repoName = repoNames.get(repoRoot);
      if (!repoName) continue;

      const worktreePath = path.join(featureRoot, repoName);
      if (!(await pathExists(worktreePath))) {
        console.log(`  ⚠ ${repoName}: worktree not found, skipping`);
        continue;
      }

      const currentBranch = await getCurrentBranch(worktreePath);
      if (currentBranch === expectedBranch) {
        console.log(`  ✓ ${repoName}: already on ${expectedBranch}`);
        continue;
      }

      // Check for uncommitted changes
      const status = await getGitStatusPorcelain(worktreePath);
      if (status) {
        console.log(`  ✗ ${repoName}: has uncommitted changes, cannot switch branch`);
        hasErrors = true;
        continue;
      }

      // Check if expected branch exists
      if (!(await gitBranchExists(worktreePath, expectedBranch))) {
        console.log(`  ✗ ${repoName}: branch ${expectedBranch} does not exist`);
        hasErrors = true;
        continue;
      }

      try {
        await checkoutBranch(worktreePath, expectedBranch);
        console.log(`  ✓ ${repoName}: switched from ${currentBranch} to ${expectedBranch}`);
      } catch (error) {
        console.log(`  ✗ ${repoName}: failed to checkout ${expectedBranch}`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.log("\n⚠ Resync completed with errors.");
    } else {
      console.log("\n✓ All repos resynced successfully.");
    }
  }

  /**
   * Stop a feature by removing its worktrees and clearing active pointer.
   */
  async stop(slug: string): Promise<void> {
    const safeSlug = await confirmSlugOrThrow(slug);
    const { repoRoots, repoNames, worktreesRoot } = await loadForgeConfig();
    const featureRoot = path.join(worktreesRoot, safeSlug);
    const branchName = `feature/${safeSlug}`;

    // First, clean up any orphaned worktrees (worktrees pointing to non-existent paths)
    console.log("Checking for orphaned worktrees...");
    for (const repoRoot of repoRoots) {
      const repoName = repoNames.get(repoRoot);
      if (!repoName) continue;

      const worktrees = await getWorktrees(repoRoot);
      for (const worktree of worktrees) {
        // Check if this worktree is for our feature branch
        if (worktree.branch === branchName && !(await pathExists(worktree.path))) {
          console.log(`  Removing orphaned worktree for ${repoName}: ${worktree.path}`);
          try {
            await removeOrphanedWorktree(repoRoot, worktree.path);
          } catch (error) {
            console.log(`  Warning: Could not remove orphaned worktree: ${error}`);
          }
        }
      }
    }

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

  function listFeatures(): Promise<void> {
    return handlers.list();
  }

  function resyncFeature(slug: string): Promise<void> {
    return handlers.resync(slug);
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

  feature
    .command("list")
    .description("List all feature worktrees")
    .action(listFeatures);

  feature
    .command("resync")
    .argument("<slug>", "Feature slug")
    .description("Resync all repos in a feature to the correct branch")
    .action(resyncFeature);
}
