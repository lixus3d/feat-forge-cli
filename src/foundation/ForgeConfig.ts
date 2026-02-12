import path from 'path';
import { FEAT_FORGE_CONFIG_FILE } from '../lib/constants';
import { merge } from '../lib/merger';
import { ForgeConfigError } from './errors';
import { AIAgent } from './types/AIAgent';
import { AIAgentName } from './types/AIAgentName';
import { DeepPartial } from './types/DeepPartial';
import { IDE } from './types/IDE';
import { IDEName } from './types/IDEName';
import { RepositoryInfos } from './types/RepositoryInfos';
import {
    ForgeOptions,
    ForgeConfigFile,
    RepositoryConfigEntry,
    RepositoryConfig,
    IDEConfigEntry,
    IDEConfig,
    AgentConfigEntry,
    AgentConfig,
    ModeConfigEntry,
} from './ForgeConfigFile';
import { ModeConfig } from './types/ModeConfig';

export const DEFAULT_SPEC_FILES = ['SPEC.md', 'TODO.md'];
export const DEFAULT_MODES: ModeConfigEntry[] = [
    {
        name: 'general',
        agentFile: '001.general.Omnibus.agent.md',
        description: 'Default mode with no special behavior',
    },
    {
        name: 'discovery',
        agentFile: '002.discovery.Inventorius.agent.md',
        description: 'Help to define a functional perimeter for a feature',
        default: true,
    },
    {
        name: 'design',
        agentFile: '003.design.Architecturius.agent.md',
        description: 'Help to define an architecture for a feature',
    },
    {
        name: 'plan',
        agentFile: '004.plan.Strategos.agent.md',
        description: 'Generate a plan for a feature, in SPEC.md & TODO.md by default',
    },
    {
        name: 'tdd',
        agentFile: '005.tdd.TestDrivenCodificius.agent.md',
        description: 'Test Driven Development agent to implement the feature',
    },
    {
        name: 'code',
        agentFile: '006.code.Codificius.agent.md',
        description: 'Code agent to implement the feature',
    },
    {
        name: 'simplify',
        agentFile: '007.simplify.Consolidarius.agent.md',
        description: 'Simplify and consolidate the feature',
    },
    {
        name: 'review',
        agentFile: '008.review.Auditorix.agent.md',
        description: 'Review the feature and ensure code guidelines',
    },
    {
        name: 'test-writer',
        agentFile: '009.testwriter.TestScriptor.agent.md',
        description: 'Write unit/functional tests',
    },
    {
        name: 'test-executor',
        agentFile: '010.testexecutor.TestExecutor.agent.md',
        description: 'Execute unit/functional tests',
    },
    {
        name: 'commit',
        agentFile: '011.commit.Scribus.agent.md',
        description: 'Propose commit message based changes related to the feature and then commit',
    },
];

export class ForgeConfig {
    public readonly rootDir: string;
    public readonly repositories: RepositoryInfos[];
    public readonly agents: AIAgent[];
    public readonly ides: IDE[];
    public readonly options: ForgeOptions;
    public readonly specFiles: string[];
    public readonly modes: ModeConfig[];

    constructor(configPath: string, configFile: ForgeConfigFile) {
        this.rootDir = path.resolve(configFile.rootDir ? path.resolve(configPath, configFile.rootDir) : configPath);
        this.specFiles = configFile.specFiles || DEFAULT_SPEC_FILES;
        // standardize config entries
        this.modes = this.standardizeModes(configFile.modes || DEFAULT_MODES);
        this.repositories = this.standardizeRepositories(configFile.repositories);
        this.ides = this.standardizeIDEs(configFile.ides);
        this.agents = this.standardizeAgents(configFile.agents);
        this.options = this.standardizeOptions(configFile.options);
    }

    private getPath(...segments: string[]): string {
        return path.resolve(this.rootDir, ...segments); // validate path segments
    }

    private standardizeModes(rawModes: ModeConfigEntry[]): ModeConfig[] {
        if (!Array.isArray(rawModes)) {
            throw new ForgeConfigError(`Invalid ${FEAT_FORGE_CONFIG_FILE}: "modes" must be an array.`);
        }

        if (rawModes.length === 0) {
            throw new ForgeConfigError(`Invalid ${FEAT_FORGE_CONFIG_FILE}: At least one mode must be defined in the "modes" array.`);
        }

        const modes = rawModes.map((entry) => {
            const agentFile = entry.agentFile?.trim();
            if (!agentFile) {
                throw new ForgeConfigError(
                    `Invalid ${FEAT_FORGE_CONFIG_FILE}: Each mode entry must have a non-empty "agentFile" property.`,
                );
            }
            const name = entry.name?.trim() || agentFile.replace(/\.[^/.]+$/, ''); // default name from agentFile if not provided
            if (!name) {
                throw new ForgeConfigError(
                    `Invalid ${FEAT_FORGE_CONFIG_FILE}: Each mode entry must have a non-empty "name" or valid "agentFile" property.`,
                );
            }
            return {
                name,
                agentFile,
                description: entry.description?.trim(),
                default: !!entry.default,
            } as ModeConfig;
        });

        ForgeConfig.checkDefaultMode(modes);

        return modes;
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

    private static checkDefaultMode(modes: ModeConfig[]): void {
        const defaultModes = modes.filter((mode) => mode.default);
        if (defaultModes.length > 1) {
            throw new ForgeConfigError('Multiple modes cannot be marked as default in the configuration.');
        }
        if (defaultModes.length === 0) {
            modes[0].default = true; // set first mode as default if none marked
        }
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
            [AIAgentName.COPILOT]: 'AGENTS.md',
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
