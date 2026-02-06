#!/usr/bin/env node
import { Command } from 'commander';
import { AgentCommands } from './commands/AgentCommands';
import { CompletionCommands } from './commands/CompletionCommands';
import { FeatureCommands } from './commands/FeatureCommands';
import { InitCommands } from './commands/InitCommands';
import { MergeCommands } from './commands/MergeCommands';
import { ModeCommands } from './commands/ModeCommands';
import { RebaseCommands } from './commands/RebaseCommands';
import { ForgeContext } from './foundation/ForgeContext';
import { ForgeMode } from './foundation/types/ForgeMode';
import { loadForgeContext } from './lib/config';
import { ForgeConfig } from './foundation/ForgeConfig';
import { ShellName } from './foundation/types/ShellName';

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
function registerFeatureCommands(program: Command, context: ForgeContext): void {
    const feature = program.command('feature').description('Manage feature lifecycle');
    const handlers = new FeatureCommands(context);

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
function registerModeCommands(program: Command, context: ForgeContext): void {
    const handlers = new ModeCommands(context);
    const mode = program.command('mode').description('Switch the active feature mode');

    mode.command('spec')
        .description('Switch to spec mode')
        .action(() => handlers.setMode(ForgeMode.SPEC));
    mode.command('code')
        .description('Switch to code mode')
        .action(() => handlers.setMode(ForgeMode.CODE));
}

/**
 * Register agent commands on the main CLI program.
 */
function registerAgentCommands(program: Command, context: ForgeContext): void {
    const handlers = new AgentCommands(context);
    const agent = program.command('agent').description('Manage agent adapters');

    agent.command('refresh').description('Refresh agent adapter files for the active feature').action(handlers.refresh.bind(handlers));
}

/**
 * Register merge commands with the CLI.
 */
function registerMergeCommands(program: Command, context: ForgeContext): void {
    const mergeCmd = new MergeCommands(context);

    // Main command: forge feature merge <slug>
    const featureCommand = program.commands.find((c: Command) => c.name() === 'feature');
    if (featureCommand) {
        featureCommand
            .command('merge <slug>')
            .description('Merge a feature branch into a target branch')
            .action(mergeCmd.merge.bind(mergeCmd));
    }

    // Shortcut: forge merge <slug>
    program
        .command('merge <slug>')
        .description('Merge a feature branch into a target branch (shortcut)')
        .action(mergeCmd.merge.bind(mergeCmd));
}

/**
 * Register rebase commands with the CLI.
 */
function registerRebaseCommands(program: Command, context: ForgeContext): void {
    const rebaseCmd = new RebaseCommands(context);

    // Main command: forge feature rebase <slug>
    const featureCommand = program.commands.find((c: Command) => c.name() === 'feature');
    if (featureCommand) {
        featureCommand
            .command('rebase <slug>')
            .description('Rebase a feature branch onto a base branch')
            .action(rebaseCmd.rebase.bind(rebaseCmd));
    }

    // Shortcut: forge rebase <slug>
    program
        .command('rebase <slug>')
        .description('Rebase a feature branch onto a base branch (shortcut)')
        .action(rebaseCmd.rebase.bind(rebaseCmd));
}
/*
 * Register completion commands with the CLI.
 * This command works both with and without config.
 */
function registerCompletionCommands(program: Command, context?: ForgeContext): void {
    const handlers = context ? new CompletionCommands(context, program) : null;

    const validShells: string[] = [ShellName.Bash, ShellName.Zsh, ShellName.Fish];

    function isValidShellName(value: string): value is ShellName {
        return validShells.includes(value);
    }

    program
        .command('completion <shell>')
        .description(`Generate shell completion script (${validShells.join(', ')})`)
        .action(async (shell: string) => {
            // Validate shell type
            if (!isValidShellName(shell)) {
                console.error(`Error: Unsupported shell type "${shell}". Supported shells: ${validShells.join(', ')}`);
                process.exitCode = 1;
                return;
            }

            // For completion command, we need config to get worktrees path
            // If no config, we'll use a fallback implementation
            if (!handlers) {
                const fallbackContext = new ForgeContext(process.cwd(), new ForgeConfig({ repositories: ['dummy'] }));
                const fallbackHandlers = new CompletionCommands(fallbackContext, program);
                await fallbackHandlers.generate(shell);
            } else {
                await handlers.generate(shell);
            }
        });
}

/**
 * Entry point for the forge CLI.
 */
async function main() {
    const program = new Command();

    program.name('forge').description('Feature-first workflow CLI').version('0.1.0');

    // Init command doesn't need config
    registerInitCommands(program);

    // Completion command should work with or without config
    // Register it early so it's available even without .feat-forge.json
    let context: ForgeContext | undefined;

    // Load config for other commands
    const isInitCommand = process.argv[2] === 'init';
    const isCompletionCommand = process.argv[2] === 'completion';

    if (!isInitCommand) {
        try {
            context = await loadForgeContext();

            // Register commands that require config
            registerFeatureCommands(program, context);
            registerModeCommands(program, context);
            registerAgentCommands(program, context);
            registerMergeCommands(program, context);
            registerRebaseCommands(program, context);
            registerCompletionCommands(program, context);
        } catch (error) {
            // Config not found
            if (isCompletionCommand) {
                // Allow completion to work without config (using fallback)
                registerCompletionCommands(program);
            } else {
                // Display error message for other commands
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Error: ${message}`);
                console.error('\\nPlease run "forge init" to initialize your workspace first.');
                process.exitCode = 1;
                return;
            }
        }
    }

    await program.parseAsync(process.argv);
}

main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err, { stack: err instanceof Error ? err.stack : undefined });
    console.error(message);
    process.exitCode = 1;
});
