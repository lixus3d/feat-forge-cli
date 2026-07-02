import { Command } from 'commander';
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
 * Centralized completion metadata extracted from the Commander program.
 */
interface CompletionData {
    mainCommands: CommandInfo[];
    featureCmd: CommandInfo | undefined;
    fixCmd: CommandInfo | undefined;
    releaseCmd: CommandInfo | undefined;
    servicesCmd: CommandInfo | undefined;
    envCmd: CommandInfo | undefined;
    maintenanceCmd: CommandInfo | undefined;
    modeCmd: CommandInfo | undefined;
    agentCmd: CommandInfo | undefined;
    /** Subcommands that accept an existing branch slug (position 3 under feature/fix/release) */
    slugSubcommands: string[];
    /** Root-level commands that accept a full branch name (position 2) */
    rootSlugCommands: string[];
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
    async generate(shell: ShellName): Promise<void> {
        const script = await this.generateCompletionScript(shell);
        console.log(script);
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    /**
     * Generate the appropriate completion script based on shell type.
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
     * Extract command information from Commander.js program.
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
     */
    private getMainCommands(): CommandInfo[] {
        return this.program.commands.filter((cmd) => !cmd.name().includes('help')).map((cmd) => this.extractCommandInfo(cmd));
    }

    /**
     * Find a specific command by name.
     */
    private findCommand(commandName: string): CommandInfo | undefined {
        return this.getMainCommands().find((cmd) => cmd.name === commandName);
    }

    /**
     * Centralized extraction of all completion metadata.
     */
    private getCompletionData(): CompletionData {
        const mainCommands = this.getMainCommands();
        return {
            mainCommands,
            featureCmd: this.findCommand('feature'),
            fixCmd: this.findCommand('fix'),
            releaseCmd: this.findCommand('release'),
            servicesCmd: this.findCommand('services'),
            envCmd: this.findCommand('env'),
            maintenanceCmd: this.findCommand('maintenance'),
            modeCmd: this.findCommand('mode'),
            agentCmd: this.findCommand('agent'),
            slugSubcommands: ['stop', 'start', 'archive', 'resync', 'merge', 'rebase', 'pull', 'open', 'path'],
            rootSlugCommands: ['stop', 'start', 'archive', 'resync', 'merge', 'rebase', 'pull', 'open', 'path'],
        };
    }

    /**
     * Generate the Node.js config-reading snippet used by bash/zsh.
     * Returns variables: _FORGE_WORKTREES_ROOT, _FORGE_FEATURE_PREFIX, _FORGE_FIX_PREFIX, _FORGE_RELEASE_PREFIX, _FORGE_MODES
     */
    private nodeConfigSnippet(): string {
        return `'const fs=require("fs");const path=require("path");
try{
  const file=process.argv[1];
  const configRoot=path.dirname(file);
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  let rootDir=data.rootDir;
  if(rootDir){ if(!path.isAbsolute(rootDir)) rootDir=path.join(configRoot, rootDir); }
  else { rootDir=configRoot; }
  const opts=data.options||{};
  const folders=opts.folders||data.folders||{};
  const git=opts.git||data.git||{};
  const worktrees=folders.worktrees||"worktrees";
  const fp=git.featureBranchPrefix||"feature/";
  const xp=git.fixBranchPrefix||"fix/";
  const rp=git.releaseBranchPrefix||"release/";
  const modes=(data.modes||[]).map(m=>m.name||path.basename(m.agentFile||"",".md")).filter(Boolean).join(" ");
  process.stdout.write("_FORGE_WORKTREES_ROOT="+path.join(rootDir, worktrees)+"\\n");
  process.stdout.write("_FORGE_FEATURE_PREFIX="+fp+"\\n");
  process.stdout.write("_FORGE_FIX_PREFIX="+xp+"\\n");
  process.stdout.write("_FORGE_RELEASE_PREFIX="+rp+"\\n");
  process.stdout.write("_FORGE_MODES="+modes+"\\n");
}catch(e){}'`;
    }

    /**
     * Generate the Node.js config-reading snippet for fish shell.
     * Outputs `set -g` commands instead of VAR= assignments.
     */
    private nodeConfigSnippetFish(): string {
        return `'const fs=require("fs");const path=require("path");
try{
  const file=process.argv[1];
  const configRoot=path.dirname(file);
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  let rootDir=data.rootDir;
  if(rootDir){ if(!path.isAbsolute(rootDir)) rootDir=path.join(configRoot, rootDir); }
  else { rootDir=configRoot; }
  const opts=data.options||{};
  const folders=opts.folders||data.folders||{};
  const git=opts.git||data.git||{};
  const worktrees=folders.worktrees||"worktrees";
  const fp=git.featureBranchPrefix||"feature/";
  const xp=git.fixBranchPrefix||"fix/";
  const rp=git.releaseBranchPrefix||"release/";
  const modes=(data.modes||[]).map(m=>m.name||path.basename(m.agentFile||"",".md")).filter(Boolean).join(" ");
  process.stdout.write("set -g _FORGE_WORKTREES_ROOT "+path.join(rootDir, worktrees)+"\\n");
  process.stdout.write("set -g _FORGE_FEATURE_PREFIX "+fp+"\\n");
  process.stdout.write("set -g _FORGE_FIX_PREFIX "+xp+"\\n");
  process.stdout.write("set -g _FORGE_RELEASE_PREFIX "+rp+"\\n");
  process.stdout.write("set -g _FORGE_MODES "+modes+"\\n");
}catch(e){}'`;
    }

    /**
     * Generate the Node.js config-reading snippet for PowerShell.
     * Outputs a JSON object parsable with ConvertFrom-Json.
     */
    private nodeConfigSnippetPowerShell(): string {
        return `'const fs=require("fs");const path=require("path");
try{
  const file=process.argv[1];
  const configRoot=path.dirname(file);
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  let rootDir=data.rootDir;
  if(rootDir){ if(!path.isAbsolute(rootDir)) rootDir=path.join(configRoot, rootDir); }
  else { rootDir=configRoot; }
  const opts=data.options||{};
  const folders=opts.folders||data.folders||{};
  const git=opts.git||data.git||{};
  const worktrees=folders.worktrees||"worktrees";
  const fp=git.featureBranchPrefix||"feature/";
  const xp=git.fixBranchPrefix||"fix/";
  const rp=git.releaseBranchPrefix||"release/";
  const modes=(data.modes||[]).map(m=>m.name||path.basename(m.agentFile||"",".md")).filter(Boolean);
  process.stdout.write(JSON.stringify({worktreesRoot:path.join(rootDir,worktrees),featurePrefix:fp,fixPrefix:xp,releasePrefix:rp,modes:modes}));
}catch(e){process.stdout.write("{}");}'`;
    }

    // ============================================================================
    // BASH COMPLETION
    // ============================================================================

    private generateBashCompletion(): string {
        const data = this.getCompletionData();

        const commands = data.mainCommands.map((cmd) => cmd.name).join(' ');
        const featureCommands = data.featureCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const fixCommands = data.fixCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const releaseCommands = data.releaseCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const servicesCommands = data.servicesCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const envCommands = data.envCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const maintenanceCommands = data.maintenanceCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';
        const agentCommands = data.agentCmd?.subcommands.map((cmd) => cmd.name).join(' ') || '';

        const featureSlugCmds =
            data.featureCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const fixSlugCmds =
            data.fixCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const releaseSlugCmds =
            data.releaseCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [];

        const mainSlugCmds = data.mainCommands.filter((cmd) => data.rootSlugCommands.includes(cmd.name)).map((cmd) => cmd.name);

        const featureSlugCase =
            featureSlugCmds.length > 0
                ? `                ${featureSlugCmds.join('|')})
                    if [[ \${cword} -eq 3 ]]; then
                        local slugs="\$(_forge_feature_slugs)"
                        COMPREPLY=( \$(compgen -W "\${slugs}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
`
                : '';

        const fixSlugCase =
            fixSlugCmds.length > 0
                ? `                ${fixSlugCmds.join('|')})
                    if [[ \${cword} -eq 3 ]]; then
                        local slugs="\$(_forge_fix_slugs)"
                        COMPREPLY=( \$(compgen -W "\${slugs}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
`
                : '';

        const releaseSlugCase =
            releaseSlugCmds.length > 0
                ? `                ${releaseSlugCmds.join('|')})
                    if [[ \${cword} -eq 3 ]]; then
                        local slugs="\$(_forge_release_slugs)"
                        COMPREPLY=( \$(compgen -W "\${slugs}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
`
                : '';

        const mainSlugCase =
            mainSlugCmds.length > 0
                ? `        ${mainSlugCmds.join('|')})
            if [[ \${cword} -eq 2 ]]; then
                local branches="\$(_forge_all_branches)"
                COMPREPLY=( \$(compgen -W "\${branches}" -- "\${cur}") )
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

# Load forge config once and cache variables for the current completion
_forge_config_loaded=0
_forge_load_config() {
    if [[ \${_forge_config_loaded} -eq 1 ]]; then
        return 0
    fi
    _FORGE_WORKTREES_ROOT=""
    _FORGE_FEATURE_PREFIX="feature/"
    _FORGE_FIX_PREFIX="fix/"
    _FORGE_RELEASE_PREFIX="release/"
    _FORGE_MODES=""

    if [[ -n "\${FORGE_WORKTREES_ROOT}" ]]; then
        _FORGE_WORKTREES_ROOT="\${FORGE_WORKTREES_ROOT}"
    fi

    local start="\${PWD}"
    local config_root
    config_root="\$(_forge_find_config "\${start}")" || true
    if [[ -n "\${config_root}" ]]; then
        local output
        output=\$(node -e ${this.nodeConfigSnippet()} "\${config_root}/.feat-forge.json" 2>/dev/null)
        if [[ -n "\${output}" ]]; then
            eval "\${output}"
        elif [[ -z "\${_FORGE_WORKTREES_ROOT}" ]]; then
            _FORGE_WORKTREES_ROOT="\${config_root}/worktrees"
        fi
    elif [[ -z "\${_FORGE_WORKTREES_ROOT}" ]]; then
        _FORGE_WORKTREES_ROOT="worktrees"
    fi
    _forge_config_loaded=1
}

_forge_feature_slugs() {
    _forge_load_config
    local prefix_dir="\${_FORGE_FEATURE_PREFIX%/}"
    local dir="\${_FORGE_WORKTREES_ROOT}/\${prefix_dir}"
    if [[ -d "\${dir}" ]]; then
        find "\${dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null
    fi
}

_forge_fix_slugs() {
    _forge_load_config
    local prefix_dir="\${_FORGE_FIX_PREFIX%/}"
    local dir="\${_FORGE_WORKTREES_ROOT}/\${prefix_dir}"
    if [[ -d "\${dir}" ]]; then
        find "\${dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null
    fi
}

_forge_release_slugs() {
    _forge_load_config
    local prefix_dir="\${_FORGE_RELEASE_PREFIX%/}"
    local dir="\${_FORGE_WORKTREES_ROOT}/\${prefix_dir}"
    if [[ -d "\${dir}" ]]; then
        find "\${dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null
    fi
}

_forge_all_branches() {
    _forge_load_config
    local root="\${_FORGE_WORKTREES_ROOT}"
    if [[ ! -d "\${root}" ]]; then
        return
    fi
    local prefix_dirs=()
    for p in "\${_FORGE_FEATURE_PREFIX%/}" "\${_FORGE_FIX_PREFIX%/}" "\${_FORGE_RELEASE_PREFIX%/}"; do
        if [[ -n "\${p}" ]]; then
            prefix_dirs+=("\${p}")
        fi
    done
    for entry in "\${root}"/*/; do
        [[ -d "\${entry}" ]] || continue
        local name="\$(basename "\${entry}")"
        local is_prefix=0
        for pd in "\${prefix_dirs[@]}"; do
            if [[ "\${name}" == "\${pd}" ]]; then
                is_prefix=1
                break
            fi
        done
        if [[ \${is_prefix} -eq 1 ]]; then
            for sub in "\${entry}"*/; do
                [[ -d "\${sub}" ]] || continue
                echo "\${name}/\$(basename "\${sub}")"
            done
        else
            echo "\${name}"
        fi
    done
}

_forge_modes() {
    _forge_load_config
    echo "\${_FORGE_MODES}"
}

_forge_completion() {
    local cur prev words cword
    _init_completion || return

    # Reset config cache for each completion
    _forge_config_loaded=0

    local commands="${commands}"

    local feature_commands="${featureCommands}"
    local fix_commands="${fixCommands}"
    local release_commands="${releaseCommands}"
    local services_commands="${servicesCommands}"
    local env_commands="${envCommands}"
    local maintenance_commands="${maintenanceCommands}"
    local agent_commands="${agentCommands}"

    case "\${words[1]}" in
        feature)
            case "\${words[2]}" in
${featureSlugCase}                *)
                    if [[ \${cword} -eq 2 ]]; then
                        COMPREPLY=( \$(compgen -W "\${feature_commands}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
            esac
            ;;
        fix)
            case "\${words[2]}" in
${fixSlugCase}                *)
                    if [[ \${cword} -eq 2 ]]; then
                        COMPREPLY=( \$(compgen -W "\${fix_commands}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
            esac
            ;;
        release)
            case "\${words[2]}" in
${releaseSlugCase}                *)
                    if [[ \${cword} -eq 2 ]]; then
                        COMPREPLY=( \$(compgen -W "\${release_commands}" -- "\${cur}") )
                        return 0
                    fi
                    ;;
            esac
            ;;
        services)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "\${services_commands}" -- "\${cur}") )
                return 0
            fi
            ;;
        env)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "\${env_commands}" -- "\${cur}") )
                return 0
            fi
            ;;
        maintenance)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "\${maintenance_commands}" -- "\${cur}") )
                return 0
            fi
            if [[ \${cword} -eq 3 ]]; then
                local branches="\$(_forge_all_branches)"
                COMPREPLY=( \$(compgen -W "\${branches}" -- "\${cur}") )
                return 0
            fi
            ;;
        mode)
            if [[ \${cword} -eq 2 ]]; then
                local modes="\$(_forge_modes)"
                COMPREPLY=( \$(compgen -W "\${modes}" -- "\${cur}") )
                return 0
            fi
            ;;
        agent)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "\${agent_commands}" -- "\${cur}") )
                return 0
            fi
            ;;
${mainSlugCase}        completion)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "bash zsh fish powershell pwsh" -- "\${cur}") )
                return 0
            fi
            ;;
        alias)
            if [[ \${cword} -eq 2 ]]; then
                COMPREPLY=( \$(compgen -W "bash zsh fish powershell pwsh" -- "\${cur}") )
                return 0
            fi
            ;;
        *)
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

    // ============================================================================
    // ZSH COMPLETION
    // ============================================================================

    private generateZshCompletion(): string {
        const data = this.getCompletionData();

        const commandsArray = data.mainCommands
            .map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`)
            .join('\n');

        const featureArray =
            data.featureCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';
        const fixArray =
            data.fixCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';
        const releaseArray =
            data.releaseCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';
        const servicesArray =
            data.servicesCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') ||
            '';
        const envArray =
            data.envCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';
        const maintenanceArray =
            data.maintenanceCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') ||
            '';
        const agentArray =
            data.agentCmd?.subcommands.map((cmd) => `        '${cmd.name}:${cmd.description.replace(/'/g, "''")}'`).join('\n') || '';

        const featureSlugCmds =
            data.featureCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const fixSlugCmds =
            data.fixCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const releaseSlugCmds =
            data.releaseCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [];
        const mainSlugCmds = data.mainCommands.filter((cmd) => data.rootSlugCommands.includes(cmd.name)).map((cmd) => cmd.name);

        const featureSlugCase =
            featureSlugCmds.length > 0
                ? `                        ${featureSlugCmds.join('|')})
                            local -a slugs
                            slugs=(\${(f)"\$(_forge_feature_slugs)"})
                            _describe 'feature slug' slugs
                            ;;
`
                : '';

        const fixSlugCase =
            fixSlugCmds.length > 0
                ? `                        ${fixSlugCmds.join('|')})
                            local -a slugs
                            slugs=(\${(f)"\$(_forge_fix_slugs)"})
                            _describe 'fix slug' slugs
                            ;;
`
                : '';

        const releaseSlugCase =
            releaseSlugCmds.length > 0
                ? `                        ${releaseSlugCmds.join('|')})
                            local -a slugs
                            slugs=(\${(f)"\$(_forge_release_slugs)"})
                            _describe 'release slug' slugs
                            ;;
`
                : '';

        const mainSlugCase =
            mainSlugCmds.length > 0
                ? `                ${mainSlugCmds.join('|')})
                    local -a branches
                    branches=(\${(f)"\$(_forge_all_branches)"})
                    _describe 'branch name' branches
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

# Load forge config once and cache variables for the current completion
_forge_config_loaded=0
_forge_load_config() {
    if [[ \${_forge_config_loaded} -eq 1 ]]; then
        return 0
    fi
    _FORGE_WORKTREES_ROOT=""
    _FORGE_FEATURE_PREFIX="feature/"
    _FORGE_FIX_PREFIX="fix/"
    _FORGE_RELEASE_PREFIX="release/"
    _FORGE_MODES=""

    if [[ -n "\${FORGE_WORKTREES_ROOT}" ]]; then
        _FORGE_WORKTREES_ROOT="\${FORGE_WORKTREES_ROOT}"
    fi

    local start="\${PWD}"
    local config_root
    config_root="\$(_forge_find_config "\${start}")" || true
    if [[ -n "\${config_root}" ]]; then
        local output
        output=\$(node -e ${this.nodeConfigSnippet()} "\${config_root}/.feat-forge.json" 2>/dev/null)
        if [[ -n "\${output}" ]]; then
            eval "\${output}"
        elif [[ -z "\${_FORGE_WORKTREES_ROOT}" ]]; then
            _FORGE_WORKTREES_ROOT="\${config_root}/worktrees"
        fi
    elif [[ -z "\${_FORGE_WORKTREES_ROOT}" ]]; then
        _FORGE_WORKTREES_ROOT="worktrees"
    fi
    _forge_config_loaded=1
}

_forge_feature_slugs() {
    _forge_load_config
    local prefix_dir="\${_FORGE_FEATURE_PREFIX%/}"
    local dir="\${_FORGE_WORKTREES_ROOT}/\${prefix_dir}"
    if [[ -d "\${dir}" ]]; then
        find "\${dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null
    fi
}

_forge_fix_slugs() {
    _forge_load_config
    local prefix_dir="\${_FORGE_FIX_PREFIX%/}"
    local dir="\${_FORGE_WORKTREES_ROOT}/\${prefix_dir}"
    if [[ -d "\${dir}" ]]; then
        find "\${dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null
    fi
}

_forge_release_slugs() {
    _forge_load_config
    local prefix_dir="\${_FORGE_RELEASE_PREFIX%/}"
    local dir="\${_FORGE_WORKTREES_ROOT}/\${prefix_dir}"
    if [[ -d "\${dir}" ]]; then
        find "\${dir}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; 2>/dev/null
    fi
}

_forge_all_branches() {
    _forge_load_config
    local root="\${_FORGE_WORKTREES_ROOT}"
    if [[ ! -d "\${root}" ]]; then
        return
    fi
    local prefix_dirs=()
    for p in "\${_FORGE_FEATURE_PREFIX%/}" "\${_FORGE_FIX_PREFIX%/}" "\${_FORGE_RELEASE_PREFIX%/}"; do
        if [[ -n "\${p}" ]]; then
            prefix_dirs+=("\${p}")
        fi
    done
    for entry in "\${root}"/*/; do
        [[ -d "\${entry}" ]] || continue
        local name="\$(basename "\${entry}")"
        local is_prefix=0
        for pd in "\${prefix_dirs[@]}"; do
            if [[ "\${name}" == "\${pd}" ]]; then
                is_prefix=1
                break
            fi
        done
        if [[ \${is_prefix} -eq 1 ]]; then
            for sub in "\${entry}"*/; do
                [[ -d "\${sub}" ]] || continue
                echo "\${name}/\$(basename "\${sub}")"
            done
        else
            echo "\${name}"
        fi
    done
}

_forge_modes() {
    _forge_load_config
    echo "\${_FORGE_MODES}"
}

_forge() {
    local -a commands feature_commands fix_commands release_commands
    local -a services_commands env_commands maintenance_commands
    local -a agent_commands

    # Reset config cache for each completion
    _forge_config_loaded=0

    commands=(
${commandsArray}
    )

    feature_commands=(
${featureArray}
    )

    fix_commands=(
${fixArray}
    )

    release_commands=(
${releaseArray}
    )

    services_commands=(
${servicesArray}
    )

    env_commands=(
${envArray}
    )

    maintenance_commands=(
${maintenanceArray}
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
                fix)
                    case \${words[2]} in
${fixSlugCase}                        *)
                            _describe 'fix command' fix_commands
                            ;;
                    esac
                    ;;
                release)
                    case \${words[2]} in
${releaseSlugCase}                        *)
                            _describe 'release command' release_commands
                            ;;
                    esac
                    ;;
                services)
                    _describe 'services command' services_commands
                    ;;
                env)
                    _describe 'env command' env_commands
                    ;;
                maintenance)
                    if (( CURRENT == 2 )); then
                        _describe 'maintenance command' maintenance_commands
                    else
                        local -a branches
                        branches=(\${(f)"\$(_forge_all_branches)"})
                        _describe 'branch name' branches
                    fi
                    ;;
                mode)
                    local -a modes
                    modes=(\${(f)"\$(_forge_modes)"})
                    if [[ \${#modes} -gt 0 ]]; then
                        _describe 'mode name' modes
                    fi
                    ;;
                agent)
                    _describe 'agent command' agent_commands
                    ;;
${mainSlugCase}                completion)
                    local -a shells
                    shells=('bash' 'zsh' 'fish' 'powershell' 'pwsh')
                    _describe 'shell type' shells
                    ;;
                alias)
                    local -a shells
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

    // ============================================================================
    // FISH COMPLETION
    // ============================================================================

    private generateFishCompletion(): string {
        const data = this.getCompletionData();

        // Main commands
        const mainCommandsLines = data.mainCommands
            .map((cmd) => `complete -c forge -n "__fish_use_subcommand" -a ${cmd.name} -d "${cmd.description.replace(/"/g, '\\"')}"`)
            .join('\n');

        // Helper to generate subcommand completions for a group
        const genSubCmds = (parentName: string, cmd: CommandInfo | undefined): string => {
            if (!cmd || !cmd.subcommands.length) return '';
            const subNames = cmd.subcommands.map((c) => c.name).join(' ');
            return cmd.subcommands
                .map(
                    (c) =>
                        `complete -c forge -n "__fish_seen_subcommand_from ${parentName}; and not __fish_seen_subcommand_from ${subNames}" -a ${c.name} -d "${c.description.replace(/"/g, '\\"')}"`,
                )
                .join('\n');
        };

        const featureSubCmds = genSubCmds('feature', data.featureCmd);
        const fixSubCmds = genSubCmds('fix', data.fixCmd);
        const releaseSubCmds = genSubCmds('release', data.releaseCmd);
        const servicesSubCmds = genSubCmds('services', data.servicesCmd);
        const envSubCmds = genSubCmds('env', data.envCmd);
        const maintenanceSubCmds = genSubCmds('maintenance', data.maintenanceCmd);
        const agentSubCmds = genSubCmds('agent', data.agentCmd);

        // Slug completions for feature/fix/release
        const genSlugCompletions = (parentName: string, cmd: CommandInfo | undefined, slugFn: string): string => {
            if (!cmd) return '';
            const slugCmds = cmd.subcommands.filter((c) => data.slugSubcommands.includes(c.name));
            return slugCmds
                .map(
                    (c) =>
                        `complete -c forge -n "__fish_seen_subcommand_from ${parentName}; and __fish_seen_subcommand_from ${c.name}" -a "(${slugFn})"`,
                )
                .join('\n');
        };

        const featureSlugCompletions = genSlugCompletions('feature', data.featureCmd, '__forge_feature_slugs');
        const fixSlugCompletions = genSlugCompletions('fix', data.fixCmd, '__forge_fix_slugs');
        const releaseSlugCompletions = genSlugCompletions('release', data.releaseCmd, '__forge_release_slugs');

        // Root-level slug commands
        const mainSlugCmds = data.mainCommands.filter((cmd) => data.rootSlugCommands.includes(cmd.name));
        const mainSlugCompletions = mainSlugCmds
            .map((cmd) => `complete -c forge -n "__fish_seen_subcommand_from ${cmd.name}" -a "(__forge_all_branches)"`)
            .join('\n');

        // Maintenance slug completion at position 3
        const maintenanceSlugCompletion =
            data.maintenanceCmd?.subcommands
                .map(
                    (c) =>
                        `complete -c forge -n "__fish_seen_subcommand_from maintenance; and __fish_seen_subcommand_from ${c.name}" -a "(__forge_all_branches)"`,
                )
                .join('\n') || '';

        return `# forge fish completion script

# Helper functions
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

set -g _forge_config_loaded 0

function __forge_load_config
    if test $_forge_config_loaded -eq 1
        return 0
    end
    set -g _FORGE_WORKTREES_ROOT ""
    set -g _FORGE_FEATURE_PREFIX "feature/"
    set -g _FORGE_FIX_PREFIX "fix/"
    set -g _FORGE_RELEASE_PREFIX "release/"
    set -g _FORGE_MODES ""

    if test -n "$FORGE_WORKTREES_ROOT"
        set -g _FORGE_WORKTREES_ROOT $FORGE_WORKTREES_ROOT
    end

    set -l config_root (__forge_find_config_root)
    if test -n "$config_root"
        set -l output (node -e ${this.nodeConfigSnippetFish()} "$config_root/.feat-forge.json" 2>/dev/null)
        if test -n "$output"
            eval $output
        else if test -z "$_FORGE_WORKTREES_ROOT"
            set -g _FORGE_WORKTREES_ROOT "$config_root/worktrees"
        end
    else if test -z "$_FORGE_WORKTREES_ROOT"
        set -g _FORGE_WORKTREES_ROOT "worktrees"
    end
    set -g _forge_config_loaded 1
end

function __forge_feature_slugs
    __forge_load_config
    set -l prefix_dir (string trim --right --chars=/ $_FORGE_FEATURE_PREFIX)
    set -l dir "$_FORGE_WORKTREES_ROOT/$prefix_dir"
    if test -d "$dir"
        for entry in $dir/*/
            basename $entry
        end
    end
end

function __forge_fix_slugs
    __forge_load_config
    set -l prefix_dir (string trim --right --chars=/ $_FORGE_FIX_PREFIX)
    set -l dir "$_FORGE_WORKTREES_ROOT/$prefix_dir"
    if test -d "$dir"
        for entry in $dir/*/
            basename $entry
        end
    end
end

function __forge_release_slugs
    __forge_load_config
    set -l prefix_dir (string trim --right --chars=/ $_FORGE_RELEASE_PREFIX)
    set -l dir "$_FORGE_WORKTREES_ROOT/$prefix_dir"
    if test -d "$dir"
        for entry in $dir/*/
            basename $entry
        end
    end
end

function __forge_all_branches
    __forge_load_config
    set -l root $_FORGE_WORKTREES_ROOT
    if not test -d "$root"
        return
    end
    set -l prefix_dirs (string trim --right --chars=/ $_FORGE_FEATURE_PREFIX) (string trim --right --chars=/ $_FORGE_FIX_PREFIX) (string trim --right --chars=/ $_FORGE_RELEASE_PREFIX)
    for entry in $root/*/
        set -l name (basename $entry)
        set -l is_prefix 0
        for pd in $prefix_dirs
            if test "$name" = "$pd"
                set is_prefix 1
                break
            end
        end
        if test $is_prefix -eq 1
            for sub in $entry*/
                if test -d "$sub"
                    echo "$name/"(basename $sub)
                end
            end
        else
            echo $name
        end
    end
end

function __forge_modes
    __forge_load_config
    string split " " $_FORGE_MODES
end

# Reset config cache on each completion invocation
function __forge_reset_config --on-event fish_prompt
    set -g _forge_config_loaded 0
end

# Disable file completion by default
complete -c forge -f

# Main commands
${mainCommandsLines}

# Feature subcommands
${featureSubCmds}

# Feature slug completions
${featureSlugCompletions}

# Fix subcommands
${fixSubCmds}

# Fix slug completions
${fixSlugCompletions}

# Release subcommands
${releaseSubCmds}

# Release slug completions
${releaseSlugCompletions}

# Services subcommands
${servicesSubCmds}

# Env subcommands
${envSubCmds}

# Maintenance subcommands
${maintenanceSubCmds}

# Maintenance slug completions
${maintenanceSlugCompletion}

# Agent subcommands
${agentSubCmds}

# Root-level commands with branch completion
${mainSlugCompletions}

# Mode command with mode name completion
complete -c forge -n "__fish_seen_subcommand_from mode" -a "(__forge_modes)"

# Completion command with shell types
complete -c forge -n "__fish_seen_subcommand_from completion" -a bash -d "Generate bash completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a zsh -d "Generate zsh completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a fish -d "Generate fish completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a powershell -d "Generate PowerShell completion"
complete -c forge -n "__fish_seen_subcommand_from completion" -a pwsh -d "Generate PowerShell completion"

# Alias command with shell types
complete -c forge -n "__fish_seen_subcommand_from alias" -a bash -d "Generate bash aliases"
complete -c forge -n "__fish_seen_subcommand_from alias" -a zsh -d "Generate zsh aliases"
complete -c forge -n "__fish_seen_subcommand_from alias" -a fish -d "Generate fish aliases"
complete -c forge -n "__fish_seen_subcommand_from alias" -a powershell -d "Generate PowerShell aliases"
complete -c forge -n "__fish_seen_subcommand_from alias" -a pwsh -d "Generate PowerShell aliases"

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

    // ============================================================================
    // POWERSHELL COMPLETION
    // ============================================================================

    private generatePowerShellCompletion(): string {
        const data = this.getCompletionData();

        const toPsArray = (items: string[]): string =>
            items.length > 0 ? items.map((item) => `'${item.replace(/'/g, "''")}'`).join(', ') : '';

        const mainCommandsList = toPsArray(data.mainCommands.map((cmd) => cmd.name));
        const featureCommandsList = toPsArray(data.featureCmd?.subcommands.map((cmd) => cmd.name) || []);
        const fixCommandsList = toPsArray(data.fixCmd?.subcommands.map((cmd) => cmd.name) || []);
        const releaseCommandsList = toPsArray(data.releaseCmd?.subcommands.map((cmd) => cmd.name) || []);
        const servicesCommandsList = toPsArray(data.servicesCmd?.subcommands.map((cmd) => cmd.name) || []);
        const envCommandsList = toPsArray(data.envCmd?.subcommands.map((cmd) => cmd.name) || []);
        const maintenanceCommandsList = toPsArray(data.maintenanceCmd?.subcommands.map((cmd) => cmd.name) || []);
        const agentCommandsList = toPsArray(data.agentCmd?.subcommands.map((cmd) => cmd.name) || []);

        const featureSlugCommandsList = toPsArray(
            data.featureCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [],
        );
        const fixSlugCommandsList = toPsArray(
            data.fixCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [],
        );
        const releaseSlugCommandsList = toPsArray(
            data.releaseCmd?.subcommands.filter((cmd) => data.slugSubcommands.includes(cmd.name)).map((cmd) => cmd.name) || [],
        );
        const mainSlugCommandsList = toPsArray(
            data.mainCommands.filter((cmd) => data.rootSlugCommands.includes(cmd.name)).map((cmd) => cmd.name),
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

$script:__ForgeConfigLoaded = $false
$script:__ForgeConfig = $null

function __ForgeLoadConfig {
    if ($script:__ForgeConfigLoaded) { return }

    $script:__ForgeConfig = @{
        WorktreesRoot = ""
        FeaturePrefix = "feature/"
        FixPrefix = "fix/"
        ReleasePrefix = "release/"
        Modes = @()
    }

    if ($env:FORGE_WORKTREES_ROOT) {
        $script:__ForgeConfig.WorktreesRoot = $env:FORGE_WORKTREES_ROOT
    }

    $configRoot = __ForgeFindConfigRoot
    if ($configRoot) {
        try {
            $output = node -e ${this.nodeConfigSnippetPowerShell()} (Join-Path $configRoot ".feat-forge.json") 2>$null
            if ($output) {
                $parsed = $output | ConvertFrom-Json
                if ($parsed.worktreesRoot) { $script:__ForgeConfig.WorktreesRoot = $parsed.worktreesRoot }
                if ($parsed.featurePrefix) { $script:__ForgeConfig.FeaturePrefix = $parsed.featurePrefix }
                if ($parsed.fixPrefix) { $script:__ForgeConfig.FixPrefix = $parsed.fixPrefix }
                if ($parsed.releasePrefix) { $script:__ForgeConfig.ReleasePrefix = $parsed.releasePrefix }
                if ($parsed.modes) { $script:__ForgeConfig.Modes = $parsed.modes }
            }
        } catch {}
        if (-not $script:__ForgeConfig.WorktreesRoot) {
            $script:__ForgeConfig.WorktreesRoot = Join-Path $configRoot "worktrees"
        }
    }
    if (-not $script:__ForgeConfig.WorktreesRoot) {
        $script:__ForgeConfig.WorktreesRoot = "worktrees"
    }
    $script:__ForgeConfigLoaded = $true
}

function __ForgeFeatureSlugs {
    __ForgeLoadConfig
    $prefix = $script:__ForgeConfig.FeaturePrefix.TrimEnd('/')
    $dir = Join-Path $script:__ForgeConfig.WorktreesRoot $prefix
    if (Test-Path $dir) {
        Get-ChildItem -Directory -Path $dir | ForEach-Object { $_.Name }
    }
}

function __ForgeFixSlugs {
    __ForgeLoadConfig
    $prefix = $script:__ForgeConfig.FixPrefix.TrimEnd('/')
    $dir = Join-Path $script:__ForgeConfig.WorktreesRoot $prefix
    if (Test-Path $dir) {
        Get-ChildItem -Directory -Path $dir | ForEach-Object { $_.Name }
    }
}

function __ForgeReleaseSlugs {
    __ForgeLoadConfig
    $prefix = $script:__ForgeConfig.ReleasePrefix.TrimEnd('/')
    $dir = Join-Path $script:__ForgeConfig.WorktreesRoot $prefix
    if (Test-Path $dir) {
        Get-ChildItem -Directory -Path $dir | ForEach-Object { $_.Name }
    }
}

function __ForgeAllBranches {
    __ForgeLoadConfig
    $root = $script:__ForgeConfig.WorktreesRoot
    if (-not (Test-Path $root)) { return }
    $prefixDirs = @(
        $script:__ForgeConfig.FeaturePrefix.TrimEnd('/'),
        $script:__ForgeConfig.FixPrefix.TrimEnd('/'),
        $script:__ForgeConfig.ReleasePrefix.TrimEnd('/')
    )
    Get-ChildItem -Directory -Path $root | ForEach-Object {
        $name = $_.Name
        if ($prefixDirs -contains $name) {
            Get-ChildItem -Directory -Path $_.FullName | ForEach-Object {
                "$name/$($_.Name)"
            }
        } else {
            $name
        }
    }
}

function __ForgeModes {
    __ForgeLoadConfig
    $script:__ForgeConfig.Modes
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
$fixCommands = @(${fixCommandsList})
$releaseCommands = @(${releaseCommandsList})
$servicesCommands = @(${servicesCommandsList})
$envCommands = @(${envCommandsList})
$maintenanceCommands = @(${maintenanceCommandsList})
$agentCommands = @(${agentCommandsList})
$featureSlugCommands = @(${featureSlugCommandsList})
$fixSlugCommands = @(${fixSlugCommandsList})
$releaseSlugCommands = @(${releaseSlugCommandsList})
$mainSlugCommands = @(${mainSlugCommandsList})
$completionShells = @(${completionShellsList})

Register-ArgumentCompleter -CommandName forge -ScriptBlock {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)

    # Reset config cache for each completion
    $script:__ForgeConfigLoaded = $false

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
        'fix' {
            if ($elements.Count -le 2) {
                __ForgeCompletionResults -Items $fixCommands -Word $wordToComplete
                return
            }
            $sub = $elements[2]
            if ($fixSlugCommands -contains $sub) {
                __ForgeCompletionResults -Items (__ForgeFixSlugs) -Word $wordToComplete
                return
            }
        }
        'release' {
            if ($elements.Count -le 2) {
                __ForgeCompletionResults -Items $releaseCommands -Word $wordToComplete
                return
            }
            $sub = $elements[2]
            if ($releaseSlugCommands -contains $sub) {
                __ForgeCompletionResults -Items (__ForgeReleaseSlugs) -Word $wordToComplete
                return
            }
        }
        'services' {
            __ForgeCompletionResults -Items $servicesCommands -Word $wordToComplete
            return
        }
        'env' {
            __ForgeCompletionResults -Items $envCommands -Word $wordToComplete
            return
        }
        'maintenance' {
            if ($elements.Count -le 2) {
                __ForgeCompletionResults -Items $maintenanceCommands -Word $wordToComplete
                return
            }
            __ForgeCompletionResults -Items (__ForgeAllBranches) -Word $wordToComplete
            return
        }
        'mode' {
            __ForgeCompletionResults -Items (__ForgeModes) -Word $wordToComplete
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
        'alias' {
            __ForgeCompletionResults -Items $completionShells -Word $wordToComplete
            return
        }
        default {
            if ($mainSlugCommands -contains $first) {
                __ForgeCompletionResults -Items (__ForgeAllBranches) -Word $wordToComplete
                return
            }
        }
    }
}

# Installation instructions:
#   Option 1 - Add to \$PROFILE:
#     forge completion powershell | Out-String | Invoke-Expression
#
# Tip: Run 'forge alias powershell' to generate shell aliases for quick access.
`;
    }
}
