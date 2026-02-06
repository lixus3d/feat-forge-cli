import { Command } from 'commander';
import { Dirent } from 'fs';
import { readdir } from 'fs/promises';
import { pathExists } from '../lib/fs';
import { AbstractCommands } from './AbstractCommands';
import { ShellName } from '../foundation/types/ShellName';

/**
 * Information about a command extracted from Commander.js
 */
interface CommandInfo {
    name: string;
    description: string;
    subcommands: CommandInfo[];
    hasSlugArgument: boolean;
}

/**
 * Commands for managing shell completion/autocomplete
 */
export class CompletionCommands extends AbstractCommands {
    private readonly program: Command;

    constructor(config: any, program: Command) {
        super(config);
        this.program = program;
    }
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Generate and display shell completion script for the specified shell.
     * Outputs only the script to stdout for piping or sourcing.
     *
     * @param shell - The target shell type (bash, zsh, or fish)
     */
    /**
     * Generate and display shell completion script for the specified shell.
     * Outputs only the script to stdout for piping or sourcing.
     *
     * @param shell - The target shell type (bash, zsh, or fish)
     */
    async generate(shell: ShellName): Promise<void> {
        const script = await this.generateCompletionScript(shell);
        console.log(script);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Generate the appropriate completion script based on shell type.
     *
     * @param shell - The target shell type
     * @returns The generated completion script as a string
     */
    private async generateCompletionScript(shell: ShellName): Promise<string> {
        switch (shell) {
            case 'bash':
                return this.generateBashCompletion();
            case 'zsh':
                return this.generateZshCompletion();
            case 'fish':
                return this.generateFishCompletion();
            default:
                throw new Error(`Unsupported shell: ${shell}`);
        }
    }

    /**
     * Get list of available feature slugs for contextual completion.
     * Returns empty array if features directory doesn't exist or if there's an error.
     *
     * @returns Array of feature slugs
     */
    private async getAvailableFeatures(): Promise<string[]> {
        try {
            if (!(await pathExists(this.context.paths.worktreesRoot))) {
                return [];
            }

            const entries: Dirent[] = await readdir(this.context.paths.worktreesRoot, { withFileTypes: true });
            return entries
                .filter((entry: Dirent) => entry.isDirectory())
                .map((entry: Dirent) => entry.name)
                .sort();
        } catch {
            return [];
        }
    }

    /**
     * Extract command information from Commander.js program.
     * Recursively extracts all commands and their subcommands.
     *
     * @param command - Commander.js Command object
     * @returns Structured command information
     */
    private extractCommandInfo(command: Command): CommandInfo {
        const name = command.name();
        const description = command.description();
        const hasSlugArgument = command.registeredArguments?.some((arg: any) => arg._name === 'slug' && arg.required) ?? false;

        const subcommands = command.commands.filter((cmd) => !cmd.name().includes('help')).map((cmd) => this.extractCommandInfo(cmd));

        return { name, description, subcommands, hasSlugArgument };
    }

    /**
     * Get all main commands from the program.
     *
     * @returns Array of command information
     */
    private getMainCommands(): CommandInfo[] {
        return this.program.commands.filter((cmd) => !cmd.name().includes('help')).map((cmd) => this.extractCommandInfo(cmd));
    }

    /**
     * Find a specific command by name.
     *
     * @param commandName - Name of the command to find
     * @returns Command information or undefined
     */
    private findCommand(commandName: string): CommandInfo | undefined {
        return this.getMainCommands().find((cmd) => cmd.name === commandName);
    }

    /**
     * Get list of command names that have a required slug argument.
     *
     * @returns Array of command names
     */
    private getCommandsWithSlug(): string[] {
        const commands: string[] = [];

        const checkCommand = (cmd: CommandInfo, parentName?: string) => {
            const fullName = parentName ? `${parentName}|${cmd.name}` : cmd.name;
            if (cmd.hasSlugArgument) {
                commands.push(cmd.name);
            }
            cmd.subcommands.forEach((sub) => checkCommand(sub, cmd.name));
        };

        this.getMainCommands().forEach((cmd) => checkCommand(cmd));
        return commands;
    }

    /**
     * Generate bash completion script.
     *
     * @returns Bash completion script content
     */
    private generateBashCompletion(): string {
        const mainCommands = this.getMainCommands();
        const featureCmd = this.findCommand('feature');
        const modeCmd = this.findCommand('mode');
        const agentCmd = this.findCommand('agent');
        const completionCmd = this.findCommand('completion');

        // Build command lists
        const commands = mainCommands.map((cmd) => cmd.name).join(' ');
        const featureCommands = featureCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const modeCommands = modeCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const agentCommands = agentCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';

        // Find commands with slug argument (for feature suggestions)
        const featureWithSlug = featureCmd?.subcommands.filter((cmd) => cmd.hasSlugArgument).map((cmd) => cmd.name) || [];
        const mainWithSlug = mainCommands.filter((cmd) => cmd.hasSlugArgument).map((cmd) => cmd.name);

        return `# forge bash completion script

_forge_completion() {
    local cur prev words cword
    _init_completion || return

    # Main commands available at root level
    local commands="${commands}"

    # Subcommands for each main command
    local feature_commands="${featureCommands}"
    local mode_commands="${modeCommands}"
    local agent_commands="${agentCommands}"

    # Get previous word for context
    case "\${words[1]}" in
        feature)
            case "\${words[2]}" in
                ${featureWithSlug.join('|')})
                    # Suggest available features
                    if [[ \${cword} -eq 3 ]]; then
                        local features=\$(find "\${FORGE_WORKTREES_ROOT:-features}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)
                        COMPREPLY=( \$(compgen -W "\${features}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
                *)
                    # Suggest feature subcommands
                    if [[ \${cword} -eq 2 ]]; then
                        COMPREPLY=( \$(compgen -W "\${feature_commands}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
            esac
            ;;
        mode)
            # Suggest mode subcommands
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "\${mode_commands}" -- "\${cur}") )
                return 0
            fi
            ;;
        agent)
            # Suggest agent subcommands
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "\${agent_commands}" -- "\${cur}") )
                return 0
            fi
            ;;
        ${mainWithSlug.join('|')})
            # Suggest available features for commands with slug argument
            if [[ \${cword} -eq 2 ]]; then
                local features=\$(find "\${FORGE_WORKTREES_ROOT:-features}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)
                COMPREPLY=( \$(compgen -W "\${features}" -- "\${cur}") )
                return 0
            fi
            ;;
        completion)
            # Suggest shell types for completion
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "bash zsh fish" -- "\${cur}") )
                return 0
            fi
            ;;
        *)
            # Suggest main commands at root level
            if [[ \${cword} -eq 1 ]]; then
                COMPREPLY=( \$(compgen -W "\${commands}" -- "\${cur}") )
                return 0
            fi
            ;;
    esac
}

# Register completion for forge command
complete -F _forge_completion forge

# Installation instructions:
#   Option 1 - Add to ~/.bashrc:
#     source <(forge completion bash)
#
#   Option 2 - Save to file:
#     forge completion bash > ~/.local/share/bash-completion/completions/forge
#     # Or system-wide: /etc/bash_completion.d/forge
`;
    }

    /**
     * Generate zsh completion script.
     *
     * @returns Zsh completion script content
     */
    private generateZshCompletion(): string {
        const mainCommands = this.getMainCommands();
        const featureCmd = this.findCommand('feature');
        const modeCmd = this.findCommand('mode');
        const agentCmd = this.findCommand('agent');
        const completionCmd = this.findCommand('completion');

        // Build command arrays with descriptions
        const commandsArray = mainCommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n');

        const featureArray =
            featureCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        const modeArray =
            modeCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        const agentArray =
            agentCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        // Find commands with slug argument
        const featureWithSlug = featureCmd?.subcommands.filter((cmd) => cmd.hasSlugArgument).map((cmd) => cmd.name) || [];
        const mainWithSlug = mainCommands.filter((cmd) => cmd.hasSlugArgument).map((cmd) => cmd.name);

        return `#compdef forge
# forge zsh completion script

_forge() {
    local -a commands feature_commands mode_commands agent_commands

    commands=(
${commandsArray}
    )

    feature_commands=(
${featureArray}
    )

    mode_commands=(
${modeArray}
    )

    agent_commands=(
${agentArray}
    )

    _arguments -C \\
        '1: :->command' \\
        '*::arg:->args'

    case \${state} in
        command)
            _describe 'forge command' commands
            ;;
        args)
            case \${words[1]} in
                feature)
                    case \${words[2]} in
                        ${featureWithSlug.join('|')})
                            # Suggest available features
                            local features
                            features=(\${(f)"\$(find "\${FORGE_WORKTREES_ROOT:-features}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)"})
                            _describe 'feature slug' features
                            ;;
                        *)
                            _describe 'feature command' feature_commands
                            ;;
                    esac
                    ;;
                mode)
                    _describe 'mode command' mode_commands
                    ;;
                agent)
                    _describe 'agent command' agent_commands
                    ;;
                ${mainWithSlug.join('|')})
                    # Suggest available features for merge/rebase shortcut
                    local features
                    features=(\${(f)"\$(find "\${FORGE_WORKTREES_ROOT:-features}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)"})
                    _describe 'feature slug' features
                    ;;
                completion)
                    local shells
                    shells=('bash' 'zsh' 'fish')
                    _describe 'shell type' shells
                    ;;
            esac
            ;;
    esac
}

# Register the completion function
compdef _forge forge

# Installation instructions:
#   Option 1 - Add to ~/.zshrc:
#     source <(forge completion zsh)
#
#   Option 2 - Save to fpath directory:
#     forge completion zsh > ~/.zsh/completions/_forge
#     # Add to .zshrc: fpath=(~/.zsh/completions $fpath)
#     # Then run: autoload -Uz compinit && compinit
`;
    }

    /**
     * Generate fish completion script.
     *
     * @returns Fish completion script content
     */
    private generateFishCompletion(): string {
        const mainCommands = this.getMainCommands();
        const featureCmd = this.findCommand('feature');
        const modeCmd = this.findCommand('mode');
        const agentCmd = this.findCommand('agent');
        const completionCmd = this.findCommand('completion');

        // Generate main commands
        const mainCommandsLines = mainCommands
            .map((cmd) => `complete -c forge -n "__fish_use_subcommand" -a ${cmd.name} -d "${cmd.description.replace(/"/g, '\\"')}"`)
            .join('\n');

        // Generate feature subcommands
        const featureSubLines = featureCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const featureSubCmds =
            featureCmd?.subcommands
                .map(
                    (cmd) =>
                        `complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from ${featureSubLines}" -a ${cmd.name} -d "${cmd.description.replace(/"/g, '\\"')}"`,
                )
                .join('\n') || '';

        // Generate mode subcommands
        const modeSubLines = modeCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const modeSubCmds =
            modeCmd?.subcommands
                .map(
                    (cmd) =>
                        `complete -c forge -n "__fish_seen_subcommand_from mode; and not __fish_seen_subcommand_from ${modeSubLines}" -a ${cmd.name} -d "${cmd.description.replace(/"/g, '\\"')}"`,
                )
                .join('\n') || '';

        // Generate agent subcommands
        const agentSubLines = agentCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const agentSubCmds =
            agentCmd?.subcommands
                .map(
                    (cmd) =>
                        `complete -c forge -n "__fish_seen_subcommand_from agent; and not __fish_seen_subcommand_from ${agentSubLines}" -a ${cmd.name} -d "${cmd.description.replace(/"/g, '\\"')}"`,
                )
                .join('\n') || '';

        // Find commands with slug argument
        const featureWithSlug = featureCmd?.subcommands.filter((cmd) => cmd.hasSlugArgument) || [];
        const featureSlugCompletions = featureWithSlug
            .map(
                (cmd) =>
                    `complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from ${cmd.name}" -a "(__forge_features)"`,
            )
            .join('\n');

        const mainWithSlug = mainCommands.filter((cmd) => cmd.hasSlugArgument);
        const mainSlugCompletions = mainWithSlug
            .map((cmd) => `complete -c forge -n "__fish_seen_subcommand_from ${cmd.name}" -a "(__forge_features)"`)
            .join('\n');

        return `# forge fish completion script

# Helper function to get available features
function __forge_features
    set -l worktrees_root (test -n "$FORGE_WORKTREES_ROOT"; and echo $FORGE_WORKTREES_ROOT; or echo "features")
    if test -d $worktrees_root
        for dir in $worktrees_root/*/
            basename $dir
        end
    end
end

# Disable file completion by default
complete -c forge -f

# Main commands
${mainCommandsLines}

# Feature subcommands
${featureSubCmds}

# Feature commands with slug completion
${featureSlugCompletions}

# Mode subcommands
${modeSubCmds}

# Agent subcommands
${agentSubCmds}

# Main commands with feature slug completion
${mainSlugCompletions}

# Completion command with shell types
complete -c forge -n "__fish_seen_subcommand_from completion" -a bash -d "Generate bash completion"
# Completion command with shell types
complete -c forge -n "__fish_seen_subcommand_from completion" -a bash -d "Generate bash completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a zsh -d "Generate zsh completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a fish -d "Generate fish completion"

# Installation instructions:
#   Option 1 - Add to ~/.config/fish/config.fish:
#     forge completion fish | source
#
#   Option 2 - Save to completions directory:
#     forge completion fish > ~/.config/fish/completions/forge.fish
`;
    }
}
