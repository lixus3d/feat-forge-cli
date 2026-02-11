import { ForgeConfigFile } from '@/foundation/ForgeConfigFile';
import { IDEName } from '@/foundation/types/IDEName';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('ForgeConfigFile', () => {
    it('should work correctly with class-validator and class-transformer', () => {
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
                },
                git: {
                    featureBranchPrefix: 'foobar/',
                },
                files: {
                    forgeMode: 'hello.json',
                },
            },
        };
        const forgeConfigFile = plainToInstance(ForgeConfigFile, validConfigObject);
        expect(forgeConfigFile).toBeInstanceOf(ForgeConfigFile);
        expect(validate(forgeConfigFile)).resolves.not.toThrow();
    });
});
