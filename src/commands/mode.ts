import path from "path";
import { rm, symlink } from "fs/promises";
import { Command } from "commander";
import { loadForgeConfig } from "../lib/config";
import { ensureDir, pathExists, writeTextFile } from "../lib/fs";
import { resolveActiveFeature } from "../lib/feature";
import { findGitRoot } from "../lib/git";

type ForgeMode = "spec" | "code";

class ModeCommands {
  /**
   * Set the current mode and refresh agent adapters for the active feature.
   */
  async setMode(mode: ForgeMode): Promise<void> {
    const { agentAdapters } = await loadForgeConfig();
    const gitRoot = await findGitRoot();
    const { featurePath } = await resolveActiveFeature(gitRoot);

    await this.writeModeFile(featurePath, mode);
    await this.refreshAdapters(featurePath, agentAdapters, mode);
  }

  private async writeModeFile(featurePath: string, mode: ForgeMode): Promise<void> {
    const modePath = path.join(featurePath, ".forge-mode");
    await writeTextFile(modePath, `${mode}\n`);
  }

  private async refreshAdapters(featurePath: string, adapters: string[], mode: ForgeMode): Promise<void> {
    const agentDir = path.join(featurePath, "agent");
    await ensureDir(agentDir);

    const contextFile = mode === "spec" ? "CONTEXT.spec.md" : "CONTEXT.code.md";
    const contextPath = path.join(agentDir, contextFile);
    if (!(await pathExists(contextPath))) {
      throw new Error(`Missing ${contextFile} in ${agentDir}`);
    }

    for (const adapter of adapters) {
      if (adapter === contextFile) {
        continue;
      }
      const adapterPath = path.join(agentDir, adapter);
      await rm(adapterPath, { force: true });
      await symlink(contextFile, adapterPath);
    }
  }
}

/**
 * Register the mode commands on the main CLI program.
 */
export function registerModeCommands(program: Command): void {
  const handlers = new ModeCommands();

  function setSpec(): Promise<void> {
    return handlers.setMode("spec");
  }

  function setCode(): Promise<void> {
    return handlers.setMode("code");
  }

  const mode = program.command("mode").description("Switch the active feature mode");
  mode.command("spec").description("Switch to spec mode").action(setSpec);
  mode.command("code").description("Switch to code mode").action(setCode);
}
