import { ForgeConfig, ForgeConfigFile } from '@/foundation/ForgeConfig';
import { ForgeContext } from '@/foundation/ForgeContext';
import { merge } from '@/lib/merger';

export class ContextHelper {
    public readonly configFile: ForgeConfigFile;
    public readonly config: ForgeConfig;
    public readonly context: ForgeContext;

    constructor(configFile: ForgeConfigFile, configPath: string = process.cwd()) {
        this.configFile = configFile;
        this.config = new ForgeConfig(configPath, configFile);
        this.context = new ForgeContext(configPath, this.config);
    }

    static default(config: Partial<ForgeConfigFile> = {}): ContextHelper {
        const configFile = merge(
            {
                repositories: ['repo1', 'repo2'],
                options: {
                    folders: {
                        activeSpec: 'test-active-feature',
                        worktrees: 'test-features',
                        agent: 'test-agents',
                        archive: 'test-archive',
                        specs: 'test-specs',
                        template: 'test-templates',
                    },
                    files: {
                        forgeMode: 'test-forge-mode.txt',
                    },
                },
            } as ForgeConfigFile,
            config,
        );
        return new ContextHelper(configFile);
    }

    extract() {
        return {
            forgeConfigFile: this.configFile,
            forgeConfig: this.config,
            forgeContext: this.context,
        };
    }
}
