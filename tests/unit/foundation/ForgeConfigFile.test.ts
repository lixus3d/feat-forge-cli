import { ForgeConfigFile, ForgeOptions } from '@/foundation/ForgeConfigFile';
import { IDEName } from '@/foundation/types/IDEName';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('ForgeConfigFile', () => {
    it('should work correctly with class-validator and class-transformer', async () => {
        const validConfigObject: ForgeConfigFile = {
            repositories: ['repo1', 'repo2'],
            ides: ['VSCode', { name: IDEName.VSCODE, openCommand: 'webstorm' }],
            agents: ['AgentA', { name: 'AgentB', settings: { key: 'value' } }],
            options: {
                folders: {
                    activeSpec: 'test-active-feature',
                    worktrees: 'test-features',
                    repoAgents: 'test-agents',
                    archive: 'test-archive',
                    specs: 'test-specs',
                    template: 'test-templates',
                    workspaceRootFiles: false,
                },
                git: {
                    featureBranchPrefix: 'foobar/',
                },
                files: {
                    forgeMode: 'hello.json',
                },
                workspace: {
                    rootFiles: {
                        allowSymlinks: true,
                    },
                },
                process: {
                    useNvmrc: true,
                },
            },
        };
        const forgeConfigFile = plainToInstance(ForgeConfigFile, validConfigObject);
        expect(forgeConfigFile).toBeInstanceOf(ForgeConfigFile);
        await expect(validate(forgeConfigFile)).resolves.not.toThrow();
    });

    it('should default workspaceRootFiles to the conventional folder name', () => {
        const forgeOptions = new ForgeOptions();

        expect(forgeOptions.folders.workspaceRootFiles).toBe('workspace-root-files');
        expect(forgeOptions.process.useNvmrc).toBe(false);
        expect(forgeOptions.workspace.rootFiles.allowSymlinks).toBe(false);
    });
});
