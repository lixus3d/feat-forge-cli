import path from "path";
import { rm, symlink } from "fs/promises";
import { Command } from "commander";
import { ForgeContext } from "../lib/config";
import { ensureDir, pathExists, writeTextFile } from "../lib/fs";
import { resolveActiveFeature } from "../lib/feature";
import { findGitRoot } from "../lib/git";
import { TemplateFile } from "../lib/templates";
import { AbstractCommands } from "./abstract";

export enum ForgeMode {
  SPEC = "spec",
  CODE = "code",
}

export class ModeCommands extends AbstractCommands {
  /**
   * Set the current mode and refresh agent adapters for the active feature.
   */
  async setMode(mode: ForgeMode): Promise<void> {
    const gitRoot = await findGitRoot();
    const { featurePath } = await resolveActiveFeature(gitRoot);
    await this.setModeForPath(featurePath, mode);
  }

  /**
   * Set mode for a specific feature path (useful when creating features)
   */
  async setModeForPath(featurePath: string, mode: ForgeMode): Promise<void> {
    const config = await this.ensureConfig();
    const { agents } = config;

    await this.writeModeFile(featurePath, mode);
    const adapterFiles = agents.map(a => a.agentFile);
    await this.refreshAdapters(featurePath, adapterFiles, mode);
  }

  /**
   * Check if a mode file exists for a feature
   */
  async modeExists(featurePath: string): Promise<boolean> {
    return pathExists(this.getModePath(featurePath));
  }

  /**
   * Set initial mode if not already defined (used during feature creation)
   */
  async setInitialModeIfNeeded(featurePath: string, defaultMode: ForgeMode = ForgeMode.SPEC): Promise<void> {
    if (await this.modeExists(featurePath)) {
      return;
    }
    await this.setModeForPath(featurePath, defaultMode);
  }

  /**
   * Get the path to the mode file for a feature
   */
  private getModePath(featurePath: string): string {
    return path.join(featurePath, ".forge-mode");
  }

  private async writeModeFile(featurePath: string, mode: ForgeMode): Promise<void> {
    await writeTextFile(this.getModePath(featurePath), `${mode}\n`);
  }

  private async refreshAdapters(featurePath: string, adapters: string[], mode: ForgeMode): Promise<void> {
    const agentDir = path.join(featurePath, "agent");
    await ensureDir(agentDir);

    const contextFile = mode === ForgeMode.SPEC ? TemplateFile.CONTEXT_SPEC : TemplateFile.CONTEXT_CODE;

    // Check if user has a custom override in agent/, otherwise use template
    const localContextPath = path.join(agentDir, contextFile);
    let targetPath: string;

    if (await pathExists(localContextPath)) {
      // User has a local override, use it directly
      targetPath = contextFile;
    } else {
      // Use the template from .features/.template/agent/
      const repoRoot = path.resolve(featurePath, "..", "..");
      const templateContextPath = path.join(repoRoot, ".features", ".template", "agent", contextFile);

      if (!(await pathExists(templateContextPath))) {
        throw new Error(`Missing ${contextFile} in ${templateContextPath}`);
      }

      // Create relative path from agent dir to template
      targetPath = path.relative(agentDir, templateContextPath);
    }

    // Create/update symlinks for all adapters
    for (const adapter of adapters) {
      if (adapter === contextFile) {
        continue;
      }
      const adapterPath = path.join(agentDir, adapter);
      await rm(adapterPath, { force: true });
      await symlink(targetPath, adapterPath);
    }
  }
}

/**
 * Register the mode commands on the main CLI program.
 */
export function registerModeCommands(program: Command, config?: ForgeContext): void {
  const handlers = new ModeCommands(config);

  function setSpec(): Promise<void> {
    return handlers.setMode(ForgeMode.SPEC);
  }

  function setCode(): Promise<void> {
    return handlers.setMode(ForgeMode.CODE);
  }

  const mode = program.command("mode").description("Switch the active feature mode");
  mode.command("spec").description("Switch to spec mode").action(setSpec);
  mode.command("code").description("Switch to code mode").action(setCode);
}
