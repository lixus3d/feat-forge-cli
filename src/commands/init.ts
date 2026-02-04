import path from "path";
import { Command } from "commander";
import { pathExists, writeTextFile, ensureDir } from "../lib/fs";
import { ensureAgentTemplates } from "../lib/templates";

class InitCommands {
  /**
   * Create a .feat-forge.json in the current working directory.
   */
  async init(): Promise<void> {
    const targetPath = path.join(process.cwd(), ".feat-forge.json");
    if (await pathExists(targetPath)) {
      throw new Error(`Config already exists at ${targetPath}`);
    }

    const contents = JSON.stringify(
      {
        repoPaths: ["repo"],
        mainRepo: "repo",
        worktreesPath: "features",
      },
      null,
      2,
    );
    await writeTextFile(targetPath, `${contents}\n`);
    
    // Initialize agent templates in .features/.template/agent/
    const repoRoot = process.cwd();
    await ensureAgentTemplates(repoRoot);
    
    console.log("Initialized .feat-forge.json and agent templates");
  }
}

/**
 * Register the init command on the main CLI program.
 */
export function registerInitCommands(program: Command): void {
  const handlers = new InitCommands();

  function initForge(): Promise<void> {
    return handlers.init();
  }

  program.command("init").description("Create a .feat-forge.json in the current folder").action(initForge);
}
