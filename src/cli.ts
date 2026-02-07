#!/usr/bin/env node
import 'reflect-metadata';
// -----------
import { Command } from 'commander';
import { AgentCommands } from './commands/AgentCommands';
import { MaintenanceCommands } from './commands/MaintenanceCommands';
import { CompletionCommands } from './commands/CompletionCommands';
import { FeatureCommands } from './commands/FeatureCommands';
import { InitCommands } from './commands/InitCommands';
import { MergeCommands } from './commands/MergeCommands';
import { ModeCommands } from './commands/ModeCommands';
import { OpenCommands } from './commands/OpenCommands';
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
 * Register maintenance commands on the main CLI program.
 */
function registerMaintenanceCommands(program: Command, context: ForgeContext): void {
    const handlers = new MaintenanceCommands(context);
    const maintenance = program.command('maintenance').description('Maintenance utilities');

    maintenance
        .command('rewrite-agent-files <slug>')
        .description('Rewrite all agent template files from built-in templates (overwrite)')
        .option('--dry-run', 'Simulate changes without writing files')
        .option('--commit', 'Commit changes if files are written')
        .action(async (slug: string, opts: any) => {
            await handlers.rewriteAgentFiles(slug, { dryRun: opts.dryRun, commit: opts.commit });
        });
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
/**
 * Register open commands with the CLI.
 */
function registerOpenCommands(program: Command, context: ForgeContext): void {
    const handlers = new OpenCommands(context);

    // Main command: forge feature open [slug]
    const featureCommand = program.commands.find((c: Command) => c.name() === 'feature');
    if (featureCommand) {
        featureCommand
            .command('open [slug]')
            .description('Open the feature workspace in IDE')
            .action(handlers.open.bind(handlers));
    }

    // Shortcut: forge open [slug]
    program
        .command('open [slug]')
        .description('Open the feature workspace in IDE (shortcut)')
        .action(handlers.open.bind(handlers));
}

/*
 * Register completion commands with the CLI.
 * This command works both with and without config.
 */
function registerCompletionCommands(program: Command, context?: ForgeContext): void {
    const handlers = context ? new CompletionCommands(context, program) : null;

    const validShells: string[] = [ShellName.Bash, ShellName.Zsh, ShellName.Fish, ShellName.PowerShell, ShellName.Pwsh];

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
                const cwd = process.cwd();
                const fallbackContext = new ForgeContext(cwd, new ForgeConfig(cwd, { repositories: ['dummy'] }));
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
        } catch (error) {
            // Config not found
            if (isCompletionCommand) {
                // Allow completion to work without config (using fallback)
                registerCompletionCommands(program);
            } else {
                throw error;
            }
        }
        if (context) {
            // Register commands that require config
            registerFeatureCommands(program, context);
            registerModeCommands(program, context);
            registerAgentCommands(program, context);
            registerMaintenanceCommands(program, context);
            registerOpenCommands(program, context);
            registerMergeCommands(program, context);
            registerRebaseCommands(program, context);
            registerCompletionCommands(program, context);
        }
    }

    await program.parseAsync(process.argv);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
