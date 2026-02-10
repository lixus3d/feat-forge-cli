#!/usr/bin/env node
import 'reflect-metadata';
// -----------
import { Command } from 'commander';
import { AgentCommands } from './commands/AgentCommands';
import { MaintenanceCommands } from './commands/MaintenanceCommands';
import { CompletionCommands } from './commands/CompletionCommands';
import { FeatureCommands as BranchCommands, FeatureCommands } from './commands/FeatureCommands';
import { InitCommands } from './commands/InitCommands';
import { ModeCommands } from './commands/ModeCommands';
import { ForgeContext } from './foundation/ForgeContext';
import { ForgeMode } from './foundation/types/ForgeMode';
import { loadForgeContext } from './lib/config';
import { ForgeConfig } from './foundation/ForgeConfig';
import { ShellName } from './foundation/types/ShellName';
import { SubBranchCommands } from './commands/SubBranchCommands';
import { FixCommands } from './commands/FixCommands';
import { ReleaseCommands } from './commands/ReleaseCommands';

/**
 * Register the init command on the main CLI program.
 */
function registerInitCommands(program: Command): void {
    const handlers = new InitCommands();
    program
        .command('init')
        .description('Create a .feat-forge.json in the current folder')
        .option('-y, --yes', 'Accept defaults and write configuration without prompting')
        .option('-f, --force', 'Force overwrite existing config (creates timestamped backup)')
        .option('--non-interactive', 'Require all values via flags, no interactive prompts')
        .option('-q, --quiet', 'Minimize console output')
        .option('--path <dir>', 'Target directory for config file (defaults to current directory)')
        .option('--root-dir <dir>', 'Set explicit rootDir value in config')
        .option('--repositories <paths>', 'Repository paths (comma-separated or JSON array)')
        .option('--agents <names>', 'Agent names (comma-separated or JSON array)')
        .option('--ides <names>', 'IDE names (comma-separated or JSON array)')
        .action(async (options: any) => {
            await handlers.init({
                yes: options.yes,
                force: options.force,
                nonInteractive: options.nonInteractive,
                quiet: options.quiet,
                path: options.path,
                rootDir: options.rootDir,
                repositories: options.repositories,
                agents: options.agents,
                ides: options.ides,
            });
        });
}

function genericBranchTypeCommands(
    baseCommand: Command,
    handlers: BranchCommands | SubBranchCommands,
    subType: string | null = null,
): void {
    const argName = subType ? `${subType}` : 'branch-name';
    const argDesc = subType ? `${subType} name (without prefix)` : 'Branch name';

    baseCommand
        .command('create')
        .argument(`<${argName}>`, argDesc)
        .description(`Create a new ${subType ? subType + ' ' : ''}branch folder and initialize its spec`)
        .action(handlers.create.bind(handlers));

    baseCommand
        .command('start')
        .argument(`<${argName}>`, argDesc)
        .description(`Start working on a ${subType ? subType + ' ' : ''}branch : create the worktrees and necessary spec files`)
        .action(handlers.start.bind(handlers));

    baseCommand
        .command('stop')
        .argument(`<${argName}>`, argDesc)
        .description(`Stop working on a ${subType ? subType + ' ' : ''}branch and remove its worktrees`)
        .action(handlers.stop.bind(handlers));

    baseCommand
        .command('list')
        .description(`List all active ${subType ? subType + ' ' : ''}branches worktrees`)
        .action(handlers.list.bind(handlers));

    baseCommand
        .command('resync')
        .argument(`<${argName}>`, argDesc)
        .description(
            `Ensure all repos in a ${subType ? subType + ' ' : ''}branch are on the correct branch (useful if user manually switched branches in a worktree)`,
        )
        .action(handlers.resync.bind(handlers));

    baseCommand
        .command('archive')
        .argument(`<${argName}>`, argDesc)
        .description(`Archive a ${subType ? subType + ' ' : ''}branch by moving it to .specs/.archives/`)
        .action(handlers.archive.bind(handlers));

    baseCommand
        .command('open')
        .argument(`[${argName}]`, argDesc)
        .description(
            `Open the given ${subType ? subType + ' ' : ''}branch in the configured IDE (if no ${subType ? subType + ' ' : ''}branch is given, opens the nearest ${subType ? subType + ' ' : ''}branch)`,
        )
        .action(handlers.open.bind(handlers));

    baseCommand
        .command('merge')
        .argument(`<${argName}>`, argDesc)
        .description(
            `Merge a ${subType ? subType + ' ' : ''}branch into a target branch (accross all repos). It will also ask for next actions to potentially delete the branch after merge.`,
        )
        .action(handlers.merge.bind(handlers));

    baseCommand
        .command('rebase')
        .argument(`<${argName}>`, argDesc)
        .description(`Rebase a ${subType ? subType + ' ' : ''}branch onto a base branch (accross all repos)`)
        .action(handlers.rebase.bind(handlers));
}

/**
 * Register feature subcommands on the main CLI program.
 */
function registerBranchCommands(program: Command, context: ForgeContext): void {
    return genericBranchTypeCommands(program, new BranchCommands(context));
}

/**
 * Register fix subcommands on the main CLI program.
 */
function registerFixCommands(program: Command, context: ForgeContext): void {
    const fix = program
        .command('fix')
        .description(`Same base commands, but with automatic "${context.options.git.fixBranchPrefix}" prefix for branch names`);
    const handlers = new FixCommands(context);
    return genericBranchTypeCommands(fix, handlers, 'fix');
}

/**
 * Register release subcommands on the main CLI program.
 */
function registerReleaseCommands(program: Command, context: ForgeContext): void {
    const release = program
        .command('release')
        .description(`Same base commands, but with automatic "${context.options.git.releaseBranchPrefix}" prefix for branch names`);
    const handlers = new ReleaseCommands(context);
    return genericBranchTypeCommands(release, handlers, 'release');
}

/**
 * Register feature subcommands on the main CLI program.
 */
function registerFeatureCommands(program: Command, context: ForgeContext): void {
    const feature = program
        .command('feature')
        .description(`Same base commands, but with automatic "${context.options.git.featureBranchPrefix}" prefix for branch names`);
    const handlers = new FeatureCommands(context);
    return genericBranchTypeCommands(feature, handlers, 'feature');
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
            registerBranchCommands(program, context);
            registerFeatureCommands(program, context);
            registerFixCommands(program, context);
            registerReleaseCommands(program, context);
            registerModeCommands(program, context);
            registerAgentCommands(program, context);
            registerMaintenanceCommands(program, context);
            registerCompletionCommands(program, context);
        }
    }

    await program.parseAsync(process.argv);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
