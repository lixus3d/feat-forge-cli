#!/usr/bin/env node
import { Command } from 'commander';
import { AgentCommands } from './commands/agent';
import { FeatureCommands } from './commands/feature';
import { InitCommands } from './commands/init';
import { ModeCommands } from './commands/mode';
import { MergeCommands } from './commands/merge';
import { RebaseCommands } from './commands/rebase';
import { loadForgeConfig, ForgeContext } from './lib/config';
import { ForgeMode } from './lib/mode';

/**
 * Register the init command on the main CLI program.
 */
function registerInitCommands(program: Command): void {
    const handlers = new InitCommands();
    program.command('init').description('Create a .feat-forge.json in the current folder').action(handlers.init.bind(handlers));
}

/**
 * Register feature subcommands on the main CLI program.
 */
function registerFeatureCommands(program: Command, config: ForgeContext): void {
    const feature = program.command('feature').description('Manage feature lifecycle');
    const handlers = new FeatureCommands(config);

    feature
        .command('create')
        .argument('<slug>', 'Feature slug')
        .description('Create a new feature folder and initialize its spec')
        .action(handlers.create.bind(handlers));

    feature
        .command('start')
        .argument('<slug>', 'Feature slug')
        .description('Create/switch to feature worktrees and set local active feature in that worktree')
        .action(handlers.start.bind(handlers));

    feature
        .command('stop')
        .argument('<slug>', 'Feature slug')
        .description('Stop a feature and remove its worktrees')
        .action(handlers.stop.bind(handlers));

    feature.command('list').description('List all feature worktrees').action(handlers.list.bind(handlers));

    feature
        .command('resync')
        .argument('<slug>', 'Feature slug')
        .description('Resync all repos in a feature to the correct branch')
        .action(handlers.resync.bind(handlers));

    feature
        .command('archive')
        .argument('<slug>', 'Feature slug')
        .description('Archive a feature by moving it to .features/.archives/')
        .action(handlers.archive.bind(handlers));
}

/**
 * Register the mode commands on the main CLI program.
 */
function registerModeCommands(program: Command, config: ForgeContext): void {
    const handlers = new ModeCommands(config);
    const mode = program.command('mode').description('Switch the active feature mode');

    mode.command('spec').description('Switch to spec mode').action(() => handlers.setMode(ForgeMode.SPEC));
    mode.command('code').description('Switch to code mode').action(() => handlers.setMode(ForgeMode.CODE));
}

/**
 * Register agent commands on the main CLI program.
 */
function registerAgentCommands(program: Command, config: ForgeContext): void {
    const handlers = new AgentCommands(config);
    const agent = program.command('agent').description('Manage agent adapters');

    agent.command('refresh').description('Refresh agent adapter files for the active feature').action(handlers.refresh.bind(handlers));
}

/**
 * Register merge commands with the CLI.
 */
function registerMergeCommands(program: Command, config: ForgeContext): void {
    const mergeCmd = new MergeCommands(config);

    // Main command: forge feature merge <slug>
    const featureCommand = program.commands.find((c: Command) => c.name() === 'feature');
    if (featureCommand) {
        featureCommand.command('merge <slug>').description('Merge a feature branch into a target branch').action(mergeCmd.merge.bind(mergeCmd));
    }

    // Shortcut: forge merge <slug>
    program.command('merge <slug>').description('Merge a feature branch into a target branch (shortcut)').action(mergeCmd.merge.bind(mergeCmd));
}

/**
 * Register rebase commands with the CLI.
 */
function registerRebaseCommands(program: Command, config: ForgeContext): void {
    const rebaseCmd = new RebaseCommands(config);

    // Main command: forge feature rebase <slug>
    const featureCommand = program.commands.find((c: Command) => c.name() === 'feature');
    if (featureCommand) {
        featureCommand.command('rebase <slug>').description('Rebase a feature branch onto a base branch').action(rebaseCmd.rebase.bind(rebaseCmd));
    }

    // Shortcut: forge rebase <slug>
    program.command('rebase <slug>').description('Rebase a feature branch onto a base branch (shortcut)').action(rebaseCmd.rebase.bind(rebaseCmd));
}

/**
 * Entry point for the forge CLI.
 */
async function main() {
    const program = new Command();

    program.name('forge').description('Feature-first workflow CLI').version('0.1.0');

    // Init command doesn't need config
    registerInitCommands(program);

    // Load config for other commands
    const isInitCommand = process.argv[2] === 'init';

    if (!isInitCommand) {
        try {
            const config = await loadForgeConfig();

            // Register commands that require config
            registerFeatureCommands(program, config);
            registerModeCommands(program, config);
            registerAgentCommands(program, config);
            registerMergeCommands(program, config);
            registerRebaseCommands(program, config);
        } catch (error) {
            // Config not found - display error message if user is not running init
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error: ${message}`);
            console.error('\\nPlease run "forge init" to initialize your workspace first.');
            process.exitCode = 1;
            return;
        }
    }

    await program.parseAsync(process.argv);
}

main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
});
