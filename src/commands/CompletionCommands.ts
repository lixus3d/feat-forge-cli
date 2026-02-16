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
            case 'powershell':
            case 'pwsh':
                return this.generatePowerShellCompletion();
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

    private escapeDoubleQuotes(value: string): string {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    private escapeSingleQuotes(value: string): string {
        return value.replace(/'/g, "''");
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
        // Build command lists
        const commands = mainCommands.map((cmd) => cmd.name).join(' ');
        const featureCommands = featureCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const modeCommands = modeCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const agentCommands = agentCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';

        // Limit slug completions to active feature commands only
        const activeFeatureSlugCommands = ['stop', 'archive', 'resync', 'merge', 'rebase', 'open'];
        const featureWithActiveSlug =
            featureCmd?.subcommands.filter((cmd) => activeFeatureSlugCommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const mainWithActiveSlug = mainCommands.filter((cmd) => ['merge', 'rebase', 'open'].includes(cmd.name)).map((cmd) => cmd.name);

        const featureSlugCase =
            featureWithActiveSlug.length > 0
                ? `                ${featureWithActiveSlug.join('|')})
                    # Suggest available features
                    if [[ \${cword} -eq 3 ]]; then
                        local worktrees_root="\$(_forge_worktrees_root)"
                        local features=\$(find "\${worktrees_root}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)
                        COMPREPLY=( \$(compgen -W "\${features}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
`
                : '';

        const mainSlugCase =
            mainWithActiveSlug.length > 0
                ? `        ${mainWithActiveSlug.join('|')})
            # Suggest available features for commands with slug argument
            if [[ \${cword} -eq 2 ]]; then
                local worktrees_root="\$(_forge_worktrees_root)"
                local features=\$(find "\${worktrees_root}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)
                COMPREPLY=( \$(compgen -W "\${features}" -- "\${cur}") )
                return 0
            fi
            ;;
`
                : '';

        return `# forge bash completion script

_forge_find_config() {
    local dir="\$1"
    while [[ -n "\${dir}" && "\${dir}" != "/" ]]; do
        if [[ -f "\${dir}/.feat-forge.json" ]]; then
            echo "\${dir}"
            return 0
        fi
        dir="\${dir%/*}"
    done
    return 1
}

_forge_worktrees_root() {
    if [[ -n "\${FORGE_WORKTREES_ROOT}" ]]; then
        echo "\${FORGE_WORKTREES_ROOT}"
        return 0
    fi
    local start="\${PWD}"
    local config_root
    config_root="\$(_forge_find_config "\${start}")" || true
    if [[ -n "\${config_root}" ]]; then
        local worktrees
        worktrees=\$(node -e 'const fs=require("fs");const path=require("path");
try{
  const file=process.argv[1];
  const configRoot=path.dirname(file);
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  let rootDir=data.rootDir;
  if(rootDir){ if(!path.isAbsolute(rootDir)) rootDir=path.join(configRoot, rootDir); }
  else { rootDir=configRoot; }
  const folders=(data.options && data.options.folders) || data.folders || {};
  const worktrees=folders.worktrees || "features";
  process.stdout.write(path.join(rootDir, worktrees));
}catch(e){}
' "\${config_root}/.feat-forge.json" 2>/dev/null)
        if [[ -n "\${worktrees}" ]]; then
            echo "\${worktrees}"
            return 0
        fi
        echo "\${config_root}/features"
        return 0
    fi
    echo "features"
}

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
${featureSlugCase}                *)
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
${mainSlugCase}        completion)
            # Suggest shell types for completion
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "bash zsh fish powershell pwsh" -- "\${cur}") )
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
#
# Tip: Run 'forge alias bash' to generate shell aliases for quick access.
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
        // Build command arrays with descriptions
        const commandsArray = mainCommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n');

        const featureArray =
            featureCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        const modeArray =
            modeCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        const agentArray =
            agentCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        // Limit slug completions to active feature commands only
        const activeFeatureSlugCommands = ['stop', 'archive', 'resync', 'merge', 'rebase', 'open'];
        const featureWithActiveSlug =
            featureCmd?.subcommands.filter((cmd) => activeFeatureSlugCommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const mainWithActiveSlug = mainCommands.filter((cmd) => ['merge', 'rebase', 'open'].includes(cmd.name)).map((cmd) => cmd.name);

        const featureSlugCase =
            featureWithActiveSlug.length > 0
                ? `                        ${featureWithActiveSlug.join('|')})
                            # Suggest available features
                            local features
                            local worktrees_root="\$(_forge_worktrees_root)"
                            features=(\${(f)"\$(find "\${worktrees_root}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)"})
                            _describe 'feature slug' features
                            ;;
`
                : '';

        const mainSlugCase =
            mainWithActiveSlug.length > 0
                ? `                ${mainWithActiveSlug.join('|')})
                    # Suggest available features for shortcut commands
                    local features
                    local worktrees_root="\$(_forge_worktrees_root)"
                    features=(\${(f)"\$(find "\${worktrees_root}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null)"})
                    _describe 'feature slug' features
                    ;;
`
                : '';

        return `#compdef forge
# forge zsh completion script

_forge_find_config() {
    local dir="\$1"
    while [[ -n "\${dir}" && "\${dir}" != "/" ]]; do
        if [[ -f "\${dir}/.feat-forge.json" ]]; then
            echo "\${dir}"
            return 0
        fi
        dir="\${dir%/*}"
    done
    return 1
}

_forge_worktrees_root() {
    if [[ -n "\${FORGE_WORKTREES_ROOT}" ]]; then
        echo "\${FORGE_WORKTREES_ROOT}"
        return 0
    fi
    local start="\${PWD}"
    local config_root
    config_root="\$(_forge_find_config "\${start}")" || true
    if [[ -n "\${config_root}" ]]; then
        local worktrees
        worktrees=\$(node -e 'const fs=require("fs");const path=require("path");
try{
  const file=process.argv[1];
  const configRoot=path.dirname(file);
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  let rootDir=data.rootDir;
  if(rootDir){ if(!path.isAbsolute(rootDir)) rootDir=path.join(configRoot, rootDir); }
  else { rootDir=configRoot; }
  const folders=(data.options && data.options.folders) || data.folders || {};
  const worktrees=folders.worktrees || "features";
  process.stdout.write(path.join(rootDir, worktrees));
}catch(e){}
' "\${config_root}/.feat-forge.json" 2>/dev/null)
        if [[ -n "\${worktrees}" ]]; then
            echo "\${worktrees}"
            return 0
        fi
        echo "\${config_root}/features"
        return 0
    fi
    echo "features"
}

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
${featureSlugCase}                        *)
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
${mainSlugCase}                completion)
                    local shells
                    shells=('bash' 'zsh' 'fish' 'powershell' 'pwsh')
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
#
# Tip: Run 'forge alias zsh' to generate shell aliases for quick access.
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

        // Limit slug completions to active feature commands only
        const activeFeatureSlugCommands = ['stop', 'archive', 'resync', 'merge', 'rebase', 'open'];
        const featureWithActiveSlug = featureCmd?.subcommands.filter((cmd) => activeFeatureSlugCommands.includes(cmd.name)) || [];
        const featureSlugCompletions = featureWithActiveSlug
            .map(
                (cmd) =>
                    `complete -c forge -n "__fish_seen_subcommand_from feature; and __fish_seen_subcommand_from ${cmd.name}" -a "(__forge_features)"`,
            )
            .join('\n');

        const mainWithActiveSlug = mainCommands.filter((cmd) => ['merge', 'rebase', 'open'].includes(cmd.name));
        const mainSlugCompletions = mainWithActiveSlug
            .map((cmd) => `complete -c forge -n "__fish_seen_subcommand_from ${cmd.name}" -a "(__forge_features)"`)
            .join('\n');

        return `# forge fish completion script

# Helper functions to get available features
function __forge_find_config_root
    set -l dir $PWD
    while test -n "$dir" -a "$dir" != "/"
        if test -f "$dir/.feat-forge.json"
            echo $dir
            return 0
        end
        set dir (dirname $dir)
    end
    return 1
end

function __forge_worktrees_root
    if test -n "$FORGE_WORKTREES_ROOT"
        echo $FORGE_WORKTREES_ROOT
        return 0
    end
    set -l config_root (__forge_find_config_root)
    if test -n "$config_root"
        set -l worktrees (node -e 'const fs=require("fs");const path=require("path");
try{
  const file=process.argv[1];
  const configRoot=path.dirname(file);
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  let rootDir=data.rootDir;
  if(rootDir){ if(!path.isAbsolute(rootDir)) rootDir=path.join(configRoot, rootDir); }
  else { rootDir=configRoot; }
  const folders=(data.options && data.options.folders) || data.folders || {};
  const worktrees=folders.worktrees || "features";
  process.stdout.write(path.join(rootDir, worktrees));
}catch(e){}
' "$config_root/.feat-forge.json" 2>/dev/null)
        if test -n "$worktrees"
            echo "$worktrees"
            return 0
        end
        echo "$config_root/features"
        return 0
    end
    echo "features"
end

function __forge_features
    set -l worktrees_root (__forge_worktrees_root)
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
complete -c forge -n "__fish_seen_subcommand_from completion" -a zsh -d "Generate zsh completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a fish -d "Generate fish completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a powershell -d "Generate PowerShell completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a pwsh -d "Generate PowerShell completion"

# Installation instructions:
#   Option 1 - Add to ~/.config/fish/config.fish:
#     forge completion fish | source
#
#   Option 2 - Save to completions directory:
#     forge completion fish > ~/.config/fish/completions/forge.fish
#
# Tip: Run 'forge alias fish' to generate shell aliases for quick access.
`;
    }

    /**
     * Generate PowerShell completion script.
     *
     * @returns PowerShell completion script content
     */
    private generatePowerShellCompletion(): string {
        const mainCommands = this.getMainCommands();
        const featureCmd = this.findCommand('feature');
        const modeCmd = this.findCommand('mode');
        const agentCmd = this.findCommand('agent');
        const toPsArray = (items: string[]): string =>
            items.length > 0 ? items.map((item) => `'${item.replace(/'/g, "''")}'`).join(', ') : '';

        const mainCommandsList = toPsArray(mainCommands.map((cmd) => cmd.name));
        const featureCommandsList = toPsArray(featureCmd?.subcommands.map((cmd) => cmd.name) || []);
        const modeCommandsList = toPsArray(modeCmd?.subcommands.map((cmd) => cmd.name) || []);
        const agentCommandsList = toPsArray(agentCmd?.subcommands.map((cmd) => cmd.name) || []);

        const activeFeatureSlugCommands = ['stop', 'archive', 'resync', 'merge', 'rebase', 'open'];
        const featureWithActiveSlug = featureCmd?.subcommands.filter((cmd) => activeFeatureSlugCommands.includes(cmd.name)) || [];
        const featureSlugCommandsList = toPsArray(featureWithActiveSlug.map((cmd) => cmd.name));
        const mainSlugCommandsList = toPsArray(
            mainCommands.filter((cmd) => ['merge', 'rebase', 'open'].includes(cmd.name)).map((cmd) => cmd.name),
        );
        const completionShellsList = toPsArray(['bash', 'zsh', 'fish', 'powershell', 'pwsh']);

        return `# forge PowerShell completion script

function __ForgeFindConfigRoot {
    $dir = $PWD.Path
    while ($dir -and $dir -ne [System.IO.Path]::GetPathRoot($dir)) {
        if (Test-Path (Join-Path $dir ".feat-forge.json")) {
            return $dir
        }
        $dir = Split-Path -Parent $dir
    }
    return $null
}

function __ForgeWorktreesRoot {
    if ($env:FORGE_WORKTREES_ROOT) { return $env:FORGE_WORKTREES_ROOT }
    $configRoot = __ForgeFindConfigRoot
    if ($configRoot) {
        try {
            $json = Get-Content -Raw -Path (Join-Path $configRoot ".feat-forge.json") | ConvertFrom-Json
            $rootDir = $json.rootDir
            if ($rootDir) {
                if (-not [System.IO.Path]::IsPathRooted($rootDir)) {
                    $rootDir = Join-Path $configRoot $rootDir
                }
            } else {
                $rootDir = $configRoot
            }
            if ($json.options -and $json.options.folders -and $json.options.folders.worktrees) {
                return (Join-Path $rootDir $json.options.folders.worktrees)
            }
            if ($json.folders -and $json.folders.worktrees) {
                return (Join-Path $rootDir $json.folders.worktrees)
            }
        } catch {
        }
        return (Join-Path $rootDir "features")
    }
    return "features"
}

function __ForgeFeatureSlugs {
    $worktreesRoot = __ForgeWorktreesRoot
    if (Test-Path $worktreesRoot) {
        Get-ChildItem -Directory -Path $worktreesRoot | ForEach-Object { $_.Name }
    }
}

function __ForgeCompletionResults {
    param([string[]]$Items, [string]$Word)
    if (-not $Items) { return }
    $Items | Where-Object { $_ -like "$Word*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
}

$mainCommands = @(${mainCommandsList})
$featureCommands = @(${featureCommandsList})
$modeCommands = @(${modeCommandsList})
$agentCommands = @(${agentCommandsList})
$featureSlugCommands = @(${featureSlugCommandsList})
$mainSlugCommands = @(${mainSlugCommandsList})
$completionShells = @(${completionShellsList})

Register-ArgumentCompleter -CommandName forge -ScriptBlock {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)

    $elements = $commandAst.CommandElements | ForEach-Object { $_.Value }

    if ($elements.Count -le 1) {
        __ForgeCompletionResults -Items $mainCommands -Word $wordToComplete
        return
    }

    $first = $elements[1]
    switch ($first) {
        'feature' {
            if ($elements.Count -le 2) {
                __ForgeCompletionResults -Items $featureCommands -Word $wordToComplete
                return
            }
            $sub = $elements[2]
            if ($featureSlugCommands -contains $sub) {
                __ForgeCompletionResults -Items (__ForgeFeatureSlugs) -Word $wordToComplete
                return
            }
        }
        'mode' {
            __ForgeCompletionResults -Items $modeCommands -Word $wordToComplete
            return
        }
        'agent' {
            __ForgeCompletionResults -Items $agentCommands -Word $wordToComplete
            return
        }
        'completion' {
            __ForgeCompletionResults -Items $completionShells -Word $wordToComplete
            return
        }
        default {
            if ($mainSlugCommands -contains $first) {
                __ForgeCompletionResults -Items (__ForgeFeatureSlugs) -Word $wordToComplete
                return
            }
        }
    }
}

# Installation instructions:
#   Option 1 - Add to $PROFILE:
#     forge completion powershell | Out-String | Invoke-Expression
#
# Tip: Run 'forge alias powershell' to generate shell aliases for quick access.
`;
    }
}
