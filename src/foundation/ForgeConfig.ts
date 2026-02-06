import path from 'path';
import { FEAT_FORGE_CONFIG_FILE } from '../lib/constants';
import { merge } from '../lib/merger';
import { AIAgent } from './types/AIAgent';
import { AIAgentName } from './types/AIAgentName';
import { IDE } from './types/IDE';
import { IDEName } from './types/IDEName';
import { RepoName, RepoPath, RepositoryInfos } from './types/RepositoryInfos';
import { ForgeConfigError } from './errors/ForgeConfigError';

/**
 * Type for the .feat-forge.json configuration file
 */
export type ForgeConfigFile = {
    rootDir?: string;
    repositories: RepositoryConfigEntry[];
    agents?: AgentConfigEntry[];
    ides?: IDEConfigEntry[];
    options?: DeepPartial<ForgeOptions>;
};

export type ForgeOptions = {
    folders: {
        /**
         * Folder for feature specs within each repo. Default: '.features'
         */
        specs: string;
        /**
         * Folder for git worktrees. Default: 'worktrees'
         */
        worktrees: string;
        /**
         * Folder for active feature tracking. Default: '.active-feature'
         */
        activeFeature: string;
        /**
         * Folder for feature templates. Default: '.template'
         */
        template: string;
        /**
         * Folder for agent instructions. Default: 'agent'
         */
        agent: string;
        /**
         * Folder for archived feature specs within each repo. Default: '.archives'
         */
        archive: string;
    };
    files: {
        /**
         * File name for storing the current mode of a feature. Default: '.forge-mode'
         */
        forgeMode: string;
    };
    git: {
        featureBranchPrefix: string; // Prefix for feature branches. Default: 'feature/'
    };
};

const DEFAULT_FORGE_OPTIONS: ForgeOptions = {
    folders: {
        specs: '.features',
        worktrees: 'worktrees',
        activeFeature: '.active-feature',
        template: '.template',
        agent: 'agent',
        archive: '.archives',
    },
    files: {
        forgeMode: '.forge-mode',
    },
    git: {
        featureBranchPrefix: 'feature/',
    },
};

/**
 * Agent configuration - can be a simple string (agent name or custom file)
 * or a full config object for more control
 */
export type AgentConfigEntry = string | AgentConfig;

export type AgentConfig = {
    name?: AIAgentName;
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
    public readonly rootDir: string | null;
    public readonly repositories: RepositoryInfos[];
    public readonly agents: AIAgent[];
    public readonly ides: IDE[];
    public readonly options: ForgeOptions;

    constructor(configFile: ForgeConfigFile) {
        this.rootDir = configFile.rootDir ? path.resolve(configFile.rootDir) : null;
        // standardize config entries
        this.repositories = this.standardizeRepositories(configFile.repositories);
        this.ides = this.standardizeIDEs(configFile.ides);
        this.agents = this.standardizeAgents(configFile.agents);
        this.options = this.standardizeOptions(configFile.options);
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
                    path: rootPath,
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
            throw new Error(`Invalid ${FEAT_FORGE_CONFIG_FILE}: "agents" must be an array.`);
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
        return merge({} as ForgeOptions, DEFAULT_FORGE_OPTIONS, options || {});
    }

    private static checkMainRepo(repositories: RepositoryInfos[]): void {
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
