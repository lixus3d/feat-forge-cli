import { ForgeConfigError } from '@/foundation/errors';
import { ForgeConfig } from '@/foundation/ForgeConfig';
import { ForgeFoldersOptions } from '@/foundation/ForgeConfigFile';
import { IDEName } from '@/foundation/types/IDEName';
import path from 'path';

describe('ForgeConfig', () => {
    let configPath = '/path/to/config';

    const minimumConfig = {
        repositories: ['repoA', 'repoB'],
    };

    const customFoldersConfig = {
        ...minimumConfig,
        options: {
            folders: {
                activeSpec: 'test-active-spec',
                worktrees: 'test-features',
                repoAgents: 'test-agents',
                archive: 'test-archive',
                specs: 'test-specs',
                template: 'test-templates',
            } as ForgeFoldersOptions,
        },
    };

    const defaultFolderOptions = new ForgeFoldersOptions();

    describe('constructor', () => {
        it('should create a new ForgeConfig instance', () => {
            const forgeConfig = new ForgeConfig(configPath, minimumConfig);
            expect(forgeConfig).toBeInstanceOf(ForgeConfig);
        });

        it('should enforge an absolute rootDir path', () => {
            const relativeConfigPath = '../path/to/config';
            const absolutePath = path.resolve(relativeConfigPath);
            const forgeConfig = new ForgeConfig(relativeConfigPath, minimumConfig);
            expect(forgeConfig.rootDir).toBe(absolutePath);
        });

        it('should use the provided rootDir if specified', () => {
            const customRootDir = '../custom/root/dir';
            const absoluteCustomRootDir = path.resolve(customRootDir);
            const forgeConfig = new ForgeConfig(configPath, {
                ...minimumConfig,
                rootDir: customRootDir,
            });
            expect(forgeConfig.rootDir).toBe(absoluteCustomRootDir);
        });
    });

    describe('standardizeOptions', () => {
        it('should standardize options with default values', () => {
            const forgeConfig = new ForgeConfig(configPath, customFoldersConfig);
            expect(forgeConfig.options.folders).toEqual(customFoldersConfig.options.folders);
        });

        it('should use a mix of default folder names and customs if some are provided', () => {
            const forgeConfig = new ForgeConfig(configPath, {
                ...minimumConfig,
                options: {
                    folders: {
                        activeSpec: 'my-active-feature',
                    },
                },
            });
            expect(forgeConfig.options.folders.activeSpec).toEqual('my-active-feature');
            expect(forgeConfig.options.folders.worktrees).toEqual(defaultFolderOptions.worktrees);
            expect(forgeConfig.options.folders.repoAgents).toEqual(defaultFolderOptions.repoAgents);
            expect(forgeConfig.options.folders.archive).toEqual(defaultFolderOptions.archive);
            expect(forgeConfig.options.folders.specs).toEqual(defaultFolderOptions.specs);
        });
    });

    describe('standardizeRepositories', () => {
        it('should standardize repositories from string array to RepositoryInfos array', () => {
            const forgeConfig = new ForgeConfig(configPath, minimumConfig);
            expect(forgeConfig.repositories).toEqual([
                { name: 'repoA', path: path.resolve(`${configPath}/repoA`), main: true },
                { name: 'repoB', path: path.resolve(`${configPath}/repoB`), main: false },
            ]);
        });

        it('should handle repositories with custom paths and main flags', () => {
            const customReposConfig = {
                repositories: ['repoA', { name: 'repoB', path: '/custom/path/repoB', main: true }],
            };
            const forgeConfig = new ForgeConfig(configPath, customReposConfig);
            expect(forgeConfig.repositories).toEqual([
                { name: 'repoA', path: path.resolve(`${configPath}/repoA`), main: false },
                { name: 'repoB', path: '/custom/path/repoB', main: true },
            ]);
        });

        it('should throw an error if multiple repositories are marked as main', () => {
            const invalidReposConfig = {
                repositories: [
                    { name: 'repoA', path: '/path/repoA', main: true },
                    { name: 'repoB', path: '/path/repoB', main: true },
                ],
            };
            expect(() => new ForgeConfig(configPath, invalidReposConfig)).toThrowError(ForgeConfigError);
        });

        it('should throw an error if no repositories are defined', () => {
            const emptyReposConfig = {
                repositories: [],
            };
            expect(() => new ForgeConfig(configPath, emptyReposConfig)).toThrowError(ForgeConfigError);
        });

        it('should throw if a repository entry is invalid', () => {
            const invalidRepoEntryConfigNumber = {
                repositories: [123 as any],
            };
            expect(() => new ForgeConfig(configPath, invalidRepoEntryConfigNumber)).toThrowError(ForgeConfigError);
            const invalidRepoEntryConfigObject = {
                repositories: [{ name: 'repoA' } as any], // Must at least have a path property
            };
            expect(() => new ForgeConfig(configPath, invalidRepoEntryConfigObject)).toThrowError(ForgeConfigError);
        });
    });

    describe('standardizeIDEs', () => {
        it('should standardize ides from string array to IDEInfos array', () => {
            const configWithIDEs = {
                ...minimumConfig,
                ides: ['VSCode'],
            };
            const forgeConfig = new ForgeConfig(configPath, configWithIDEs);
            expect(forgeConfig.ides).toEqual([{ name: 'VSCode', createWorkspace: true, openCommand: undefined, settings: {} }]);
        });

        it('should handle IDE entries with custom settings', () => {
            const configWithCustomIDEs = {
                ...minimumConfig,
                ides: [{ name: IDEName.VSCODE, openCommand: 'code', settings: { theme: 'dark' } }],
            };
            const forgeConfig = new ForgeConfig(configPath, configWithCustomIDEs);
            expect(forgeConfig.ides).toEqual([
                { name: 'VSCode', createWorkspace: true, openCommand: 'code', settings: { theme: 'dark' } },
            ]);
        });

        it('should accept empty array for ides', () => {
            const configWithEmptyIDEs = {
                ...minimumConfig,
                ides: [],
            };
            const forgeConfig = new ForgeConfig(configPath, configWithEmptyIDEs);
            expect(forgeConfig.ides).toEqual([]);
        });

        it('should throw if an IDE entry is invalid', () => {
            const invalidIDEEntryConfig = {
                ...minimumConfig,
                ides: [123 as any],
            };
            expect(() => new ForgeConfig(configPath, invalidIDEEntryConfig)).toThrowError(ForgeConfigError);
        });

        it('should throw if ides is not an array', () => {
            const invalidIDEsConfig = {
                ...minimumConfig,
                ides: 'VSCode' as any,
            };
            expect(() => new ForgeConfig(configPath, invalidIDEsConfig)).toThrowError(ForgeConfigError);
        });
    });

    describe('standardizeAgents', () => {
        it('should standardize agents from string array to AgentInfos array', () => {
            const configWithAgents = {
                ...minimumConfig,
                agents: ['AgentA', 'Gemini', 'Copilot'],
            };
            const forgeConfig = new ForgeConfig(configPath, configWithAgents);
            expect(forgeConfig.agents).toEqual([
                { name: 'AgentA', agentFile: 'AGENTS.md', settings: undefined, requiresIDEConfig: false },
                { name: 'Gemini', agentFile: 'GEMINI.md', settings: undefined, requiresIDEConfig: false },
                { name: 'Copilot', agentFile: 'AGENTS.md', settings: undefined, requiresIDEConfig: true },
            ]);
        });

        it('should handle agent entries with custom settings', () => {
            const configWithCustomAgents = {
                ...minimumConfig,
                agents: ['Gemini', { agentFile: 'FOOBAR.md', settings: { version: '1.0' } }],
            };
            const forgeConfig = new ForgeConfig(configPath, configWithCustomAgents);
            expect(forgeConfig.agents).toEqual([
                { name: 'Gemini', agentFile: 'GEMINI.md', settings: undefined, requiresIDEConfig: false },
                { name: null, agentFile: 'FOOBAR.md', settings: { version: '1.0' }, requiresIDEConfig: false },
            ]);
        });

        it('should throw if an agent entry is invalid', () => {
            const invalidAgentEntryConfig = {
                ...minimumConfig,
                agents: [123 as any],
            };
            expect(() => new ForgeConfig(configPath, invalidAgentEntryConfig)).toThrowError(ForgeConfigError);
        });

        it('should throw if agents is not an array', () => {
            const invalidAgentsConfig = {
                ...minimumConfig,
                agents: 'AgentA' as any,
            };
            expect(() => new ForgeConfig(configPath, invalidAgentsConfig)).toThrowError(ForgeConfigError);
        });
    });
});
