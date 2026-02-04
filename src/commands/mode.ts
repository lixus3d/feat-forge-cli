import path from "path";
import { rm, symlink } from "fs/promises";
import { Command } from "commander";
import { loadForgeConfig } from "../lib/config";
import { ensureDir, pathExists, writeTextFile } from "../lib/fs";
import { resolveActiveFeature } from "../lib/feature";
import { findGitRoot } from "../lib/git";
import { TemplateFile } from "../lib/templates";

export enum ForgeMode {
  SPEC = "spec",
  CODE = "code",
}

class ModeCommands {
  /**
   * Set the current mode and refresh agent adapters for the active feature.
   */
  async setMode(mode: ForgeMode): Promise<void> {
    const { agents } = await loadForgeConfig();
    const gitRoot = await findGitRoot();
    const { featurePath } = await resolveActiveFeature(gitRoot);

    await this.writeModeFile(featurePath, mode);
    const adapterFiles = agents.map(a => a.agentFile);
    await this.refreshAdapters(featurePath, adapterFiles, mode);
  }

  private async writeModeFile(featurePath: string, mode: ForgeMode): Promise<void> {
    const modePath = path.join(featurePath, ".forge-mode");
    await writeTextFile(modePath, `${mode}\n`);
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
export function registerModeCommands(program: Command): void {
  const handlers = new ModeCommands();

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
