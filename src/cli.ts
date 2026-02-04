#!/usr/bin/env node
import { Command } from "commander";
import { registerFeatureCommands } from "./commands/feature";
import { registerInitCommands } from "./commands/init";
import { registerModeCommands } from "./commands/mode";

/**
 * Entry point for the forge CLI.
 */
async function main() {
  const program = new Command();

  program.name("forge").description("Feature-first workflow CLI").version("0.1.0");

  registerFeatureCommands(program);
  registerInitCommands(program);
  registerModeCommands(program);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
