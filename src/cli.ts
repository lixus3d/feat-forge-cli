#!/usr/bin/env node
import { Command } from "commander";
import { registerAgentCommands } from "./commands/agent";
import { registerFeatureCommands } from "./commands/feature";
import { registerInitCommands } from "./commands/init";
import { registerModeCommands } from "./commands/mode";
import { loadForgeConfig, ForgeContext } from "./lib/config";

/**
 * Entry point for the forge CLI.
 */
async function main() {
  const program = new Command();

  program.name("forge").description("Feature-first workflow CLI").version("0.1.0");

  // Init command doesn't need config
  registerInitCommands(program);

  // Load config for other commands (skip if init command)
  const isInitCommand = process.argv[2] === "init";
  let config: ForgeContext | undefined;

  if (!isInitCommand) {
    try {
      config = await loadForgeConfig();
    } catch (error) {
      // Allow commands to run even if config is not found
      // Commands will fail gracefully if they need config
    }
  }

  registerFeatureCommands(program, config);
  registerModeCommands(program, config);
  registerAgentCommands(program, config);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
