import { readdir } from 'fs/promises';
import { Dirent } from 'fs';
import { AbstractCommands } from './abstract';
import { pathExists } from '../lib/fs';

/**
 * Supported shell types for completion script generation
 */
export type ShellType = 'bash' | 'zsh' | 'fish';

/**
 * Commands for managing shell completion/autocomplete
 */
export class CompletionCommands extends AbstractCommands {
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
    async generate(shell: ShellType): Promise<void> {
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
    private async generateCompletionScript(shell: ShellType): Promise<string> {
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
            if (!(await pathExists(this.config.worktreesRoot))) {
                return [];
            }

            const entries: Dirent[] = await readdir(this.config.worktreesRoot, { withFileTypes: true });
            return entries
                .filter((entry: Dirent) => entry.isDirectory())
                .map((entry: Dirent) => entry.name)
                .sort();
        } catch {
            return [];
        }
    }

    /**
     * Generate bash completion script.
     *
     * @returns Bash completion script content
     */
    private generateBashCompletion(): string {
        return `# forge bash completion script

_forge_completion() {
    local cur prev words cword
    _init_completion || return

    # Main commands available at root level
    local commands="init feature mode agent merge completion"

    # Subcommands for each main command
    local feature_commands="create start stop list resync archive merge"
    local mode_commands="spec code"
    local agent_commands="refresh"

    # Get previous word for context
    case "\${words[1]}" in
        feature)
            case "\${words[2]}" in
                merge)
                    # Suggest available features for merge
                    if [[ \${cword} -eq 3 ]]; then
                        local features=\$(find "\${FORGE_WORKTREES_ROOT:-features}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)
                        COMPREPLY=( \$(compgen -W "\${features}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
                create|start|stop|resync|archive)
                    # Suggest available features for other feature commands
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
        merge)
            # Suggest available features for merge shortcut
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
        return `#compdef forge
# forge zsh completion script

_forge() {
    local -a commands feature_commands mode_commands agent_commands

    commands=(
        'init:Create a .feat-forge.json in the current folder'
        'feature:Manage feature lifecycle'
        'mode:Switch the active feature mode'
        'agent:Manage agent adapters'
        'merge:Merge a feature branch into a target branch'
        'completion:Generate shell completion script'
    )

    feature_commands=(
        'create:Create a new feature folder and initialize its spec'
        'start:Create/switch to feature worktrees'
        'stop:Stop a feature and remove its worktrees'
        'list:List all feature worktrees'
        'resync:Resync all repos in a feature to the correct branch'
        'archive:Archive a feature by moving it to .features/.archives/'
        'merge:Merge a feature branch into a target branch'
    )

    mode_commands=(
        'spec:Switch to spec mode'
        'code:Switch to code mode'
    )

    agent_commands=(
        'refresh:Refresh agent adapter files for the active feature'
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
                        merge|create|start|stop|resync|archive)
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
                merge)
                    # Suggest available features for merge shortcut
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

_forge "$@"

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
complete -c forge -n "__fish_use_subcommand" -a init -d "Create a .feat-forge.json in the current folder"
complete -c forge -n "__fish_use_subcommand" -a feature -d "Manage feature lifecycle"
complete -c forge -n "__fish_use_subcommand" -a mode -d "Switch the active feature mode"
complete -c forge -n "__fish_use_subcommand" -a agent -d "Manage agent adapters"
complete -c forge -n "__fish_use_subcommand" -a merge -d "Merge a feature branch into a target branch"
complete -c forge -n "__fish_use_subcommand" -a completion -d "Generate shell completion script"

# Feature subcommands
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a create -d "Create a new feature folder"
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a start -d "Create/switch to feature worktrees"
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a stop -d "Stop a feature and remove its worktrees"
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a list -d "List all feature worktrees"
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a resync -d "Resync all repos in a feature"
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a archive -d "Archive a feature"
complete -c forge -n "__fish_seen_subcommand_from feature; and not __fish_seen_subcommand_from create start stop list resync archive merge" -a merge -d "Merge a feature branch"

# Feature commands with slug completion
complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from create" -a "(__forge_features)"
complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from start" -a "(__forge_features)"
complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from stop" -a "(__forge_features)"
complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from resync" -a "(__forge_features)"
complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from archive" -a "(__forge_features)"
complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from merge" -a "(__forge_features)"

# Mode subcommands
complete -c forge -n "__fish_seen_subcommand_from mode; and not __fish_seen_subcommand_from spec code" -a spec -d "Switch to spec mode"
complete -c forge -n "__fish_seen_subcommand_from mode; and not __fish_seen_subcommand_from spec code" -a code -d "Switch to code mode"

# Agent subcommands
complete -c forge -n "__fish_seen_subcommand_from agent; and not __fish_seen_subcommand_from refresh" -a refresh -d "Refresh agent adapter files"

# Merge shortcut with feature slug completion
complete -c forge -n "__fish_seen_subcommand_from merge" -a "(__forge_features)"

# Completion command with shell types
complete -c forge -n "__fish_seen_subcommand_from completion" -a "bash zsh fish" -d "Shell type"

# Installation instructions:
#   Option 1 - Source directly:
#     forge completion fish | source
#
#   Option 2 - Save to completions directory (recommended):
#     forge completion fish > ~/.config/fish/completions/forge.fish
#     # Fish will automatically load it in new sessions
`;
    }
}
