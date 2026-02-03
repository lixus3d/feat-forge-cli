import path from "path";
import { Command } from "commander";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "../lib/fs";
import { FEATURE_FILES, resolveTemplate, templateFor } from "../lib/templates";
import { activeFeatureFile, featureDir, featuresRoot } from "../lib/paths";
import { loadForgeConfig } from "../lib/config";

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
 * Read the active feature slug from .features/.active.
 */
async function readActiveFeature(repoRoot: string): Promise<string> {
  const activePath = activeFeatureFile(repoRoot);
  if (!(await pathExists(activePath))) {
    throw new Error("No active feature found. Run `forge feature create <slug>` first.");
  }
  const slug = (await readTextFile(activePath)).trim();
  if (!slug) {
    throw new Error("Active feature file is empty.");
  }
  return slug;
}

class SpecCommands {
  /**
   * Initialize spec files for the active feature.
   */
  async init(): Promise<void> {
    const { mainRepoRoot } = await loadForgeConfig();
    await ensureDir(featuresRoot(mainRepoRoot));
    const slug = await readActiveFeature(mainRepoRoot);
    const targetDir = featureDir(mainRepoRoot, slug);
    await ensureFeatureFiles(mainRepoRoot, targetDir);
  }
}

/**
 * Register spec subcommands on the main CLI program.
 */
export function registerSpecCommands(program: Command): void {
  const spec = program.command("spec").description("Manage feature specs");
  const handlers = new SpecCommands();

  function initSpec(): Promise<void> {
    return handlers.init();
  }

  spec
    .command("init")
    .description("Initialize spec files for the active feature")
    .action(initSpec);
}
