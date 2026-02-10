import path from 'path';
import { FEAT_FORGE_CONFIG_FILE } from '../lib/constants';
import { merge } from '../lib/merger';
import { AIAgent } from './types/AIAgent';
import { AIAgentName } from './types/AIAgentName';
import { IDE } from './types/IDE';
import { IDEName } from './types/IDEName';
import { RepoName, RepoPath, RepositoryInfos } from './types/RepositoryInfos';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, Validate, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DeepPartial } from './types/DeepPartial';
import { ForgeConfigError } from './errors';

export class ForgeFoldersOptions {
    /**
     * Folder for feature specs within each repo.
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    specs: string = '.specs';
    /**
     * Folder for git worktrees. Default: 'worktrees'
     * Can be empty to put them in the root of the repo, but that can get messy so we default to a separate folder
     */
    @IsOptional()
    @IsString()
    worktrees: string = 'worktrees';
    /**
     * Folder for active feature tracking. Default: '.active-spec'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    activeSpec: string = '.active-spec';
    /**
     * Folder for feature templates. Default: '.template'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    template: string = '.template';
    /**
     * Folder for agent instructions. Default: 'agent'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    agent: string = 'agent';
    /**
     * Folder for archived feature specs within each repo. Default: '.archives'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    archive: string = '.archives';
}

export class ForgeFilesOptions {
    /**
     * File name for storing the current mode of a feature. Default: '.forge-mode'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    forgeMode: string = '.forge-mode';
}

export class ForgeGitOptions {
    /**
     * Prefix for feature branches. Default: 'feature/'
     */
    @IsOptional()
    @IsString()
    featureBranchPrefix: string = 'feature/';

    @IsOptional()
    @IsString()
    fixBranchPrefix: string = 'fix/';

    @IsOptional()
    @IsString()
    releaseBranchPrefix: string = 'release/';

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    protectedBranches: string[] = ['main', 'master', 'develop', 'dev'];
}

export class ForgeOptions {
    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeFoldersOptions)
    folders: ForgeFoldersOptions = new ForgeFoldersOptions();

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeFilesOptions)
    files: ForgeFilesOptions = new ForgeFilesOptions();

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeGitOptions)
    git: ForgeGitOptions = new ForgeGitOptions();
}

/**
 * Type for the .feat-forge.json configuration file
 */
export class ForgeConfigFile {
    /**
     * Optional root directory for all repositories. If not set, repos paths are relative to the config file location. Can be absolute or relative.
     * Useful for monorepos or when you want to keep the config file in a separate folder.
     */
    @IsOptional()
    @IsString()
    rootDir?: string;

    /**
     * List of repositories to manage. Can be a simple string (repo path) or an object with more options.
     * If multiple repos are defined, one must be marked as "main" (or it will take the first one) -> this is the repo where the feature branches will be created and where the active feature will be tracked.
     * If only one repo is defined, it will be considered the main repo by default.
     */
    @IsArray()
    @ArrayNotEmpty()
    repositories!: RepositoryConfigEntry[];

    @IsOptional()
    @IsArray()
    agents?: AgentConfigEntry[];

    @IsOptional()
    @IsArray()
    ides?: IDEConfigEntry[];

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeOptions)
    options?: DeepPartial<ForgeOptions>;
}

/**
 * Agent configuration - can be a simple string (agent name or custom file)
 * or a full config object for more control
 */
export type AgentConfigEntry = string | AgentConfig;

export type AgentConfig = {
    name?: AIAgentName | string | null;
    agentFile?: string;
    settings?: Record<string, unknown>;
};

/**
 * IDE configuration - can be a simple string (IDE name) or a config object
 */
export type IDEConfigEntry = string | IDEConfig;

export type IDEConfig = {
    name: IDEName;
    createWorkspace?: boolean;
    settings?: Record<string, unknown>;
    openCommand?: string;
};

/**
 * Repository configuration - can be a simple string (repo root path) or a full config object
 */
export type RepositoryConfigEntry = RepoPath | RepositoryConfig;

export type RepositoryConfig = {
    name?: RepoName;
    path: RepoPath;
    main?: boolean;
};

export class ForgeConfig {
    public readonly rootDir: string;
    public readonly repositories: RepositoryInfos[];
    public readonly agents: AIAgent[];
    public readonly ides: IDE[];
    public readonly options: ForgeOptions;

    constructor(configPath: string, configFile: ForgeConfigFile) {
        this.rootDir = path.resolve(configFile.rootDir ? configFile.rootDir : configPath);
        // standardize config entries
        this.repositories = this.standardizeRepositories(configFile.repositories);
        this.ides = this.standardizeIDEs(configFile.ides);
        this.agents = this.standardizeAgents(configFile.agents);
        this.options = this.standardizeOptions(configFile.options);
    }

    private getPath(...segments: string[]): string {
        return path.resolve(this.rootDir, ...segments); // validate path segments
    }

    private standardizeRepositories(repos: RepositoryConfigEntry[]): RepositoryInfos[] {
        const repositories = repos
            .map((entry) => {
                if (typeof entry === 'string') {
                    return {
                        path: entry,
                    } as RepositoryConfig;
                } else return entry;
            })
            .map((repositoryConfig) => {
                if (typeof repositoryConfig.path !== 'string' || repositoryConfig.path.trim() === '') {
                    throw new ForgeConfigError(`Invalid ${FEAT_FORGE_CONFIG_FILE}: Repository entries must have a non-empty "path".`);
                }
                const rootPath = repositoryConfig.path.trim();
                return {
                    name: repositoryConfig.name ?? path.basename(rootPath),
                    path: this.getPath(rootPath),
                    main: !!(repositoryConfig.main ?? false),
                };
            });

        ForgeConfig.checkMainRepo(repositories);

        return repositories;
    }

    private standardizeIDEs(ides?: IDEConfigEntry[] | string[]): IDE[] {
        if (!ides) {
            return [];
        }

        if (!Array.isArray(ides)) {
            throw new ForgeConfigError(`Invalid ${FEAT_FORGE_CONFIG_FILE}: "ides" must be an array.`);
        }

        return ides
            .map((entry) => {
                if (typeof entry === 'string') {
                    return {
                        name: entry,
                        createWorkspace: true,
                    } as IDEConfig;
                } else return entry;
            })
            .map((ideConfig) => {
                // Full config object
                const ideName = Object.values(IDEName).find((name) => name === ideConfig.name);

                if (!ideName) {
                    throw new ForgeConfigError(
                        `Invalid ${FEAT_FORGE_CONFIG_FILE}: IDE config objects must have a valid "name" property.`,
                    );
                }
                return {
                    name: ideName,
                    createWorkspace: ideConfig.createWorkspace ?? true,
                    settings: ideConfig.settings ?? {},
                    openCommand: ideConfig.openCommand,
                };
            });
    }

    private standardizeAgents(agents?: AgentConfigEntry[] | string[]): AIAgent[] {
        if (!agents) {
            return [
                {
                    name: null,
                    agentFile: 'AGENTS.md',
                    requiresIDEConfig: false,
                },
            ];
        }

        if (!Array.isArray(agents)) {
            throw new ForgeConfigError(`Invalid ${FEAT_FORGE_CONFIG_FILE}: "agents" must be an array.`);
        }

        return agents
            .map((entry) => {
                if (typeof entry === 'string') {
                    return {
                        name: entry,
                    } as AgentConfig;
                } else return entry;
            })
            .map((agentConfig) => {
                const name = agentConfig.name?.trim() ?? null;
                let agentFile = agentConfig.agentFile?.trim() ?? null;

                if (!name && !agentFile) {
                    throw new ForgeConfigError(
                        `Invalid ${FEAT_FORGE_CONFIG_FILE}: Agent config objects must have either a valid "name" or an "agentFile" property.`,
                    );
                }

                if (!agentFile) {
                    agentFile = ForgeConfig.getAgentFile(name);
                }

                return {
                    name,
                    agentFile,
                    requiresIDEConfig: name ? ForgeConfig.agentRequiresIDEConfig(name) : false,
                    settings: agentConfig.settings,
                };
            });
    }

    private standardizeOptions(options?: DeepPartial<ForgeOptions>): ForgeOptions {
        return merge(new ForgeOptions(), options || {});
    }

    private static checkMainRepo(repositories: RepositoryInfos[]): void {
        if (repositories.filter((repo) => repo.main).length > 1) {
            throw new ForgeConfigError('Multiple repositories cannot be marked as main in the configuration.');
        }
        let mainRepo = repositories.find((repo) => repo.main);
        if (!mainRepo) {
            if (repositories.length > 0) {
                repositories[0].main = true;
            } else {
                throw new ForgeConfigError('At least one repository must be defined in the configuration.');
            }
        }
    }

    /**
     * Get default agent file name for known agents
     */
    private static getAgentFile(agentName?: AIAgentName | string | null): string {
        const agentFiles: { [key in AIAgentName]: string } = {
            [AIAgentName.CLAUDE]: 'CLAUDE.md',
            [AIAgentName.COPILOT]: 'COPILOT.instructions.md',
            [AIAgentName.GEMINI]: 'GEMINI.md',
            [AIAgentName.CODEX]: 'AGENTS.md',
            [AIAgentName.CURSOR]: 'AGENTS.md',
        };
        return agentFiles[agentName as AIAgentName] || 'AGENTS.md';
    }

    /**
     * Check if agent requires IDE configuration
     */
    private static agentRequiresIDEConfig(agentName?: AIAgentName | string | null): boolean {
        const agentRequiringIDEConfig: { [key in AIAgentName]: boolean } = {
            [AIAgentName.COPILOT]: true,
            [AIAgentName.CURSOR]: true,
            [AIAgentName.CLAUDE]: false,
            [AIAgentName.GEMINI]: false,
            [AIAgentName.CODEX]: false,
        };
        return !!agentRequiringIDEConfig[agentName as AIAgentName];
    }
}
