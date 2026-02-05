import { ForgeContext, loadForgeConfig } from '../lib/config';

/**
 * Base class for command handlers with lazy config loading
 */
export abstract class AbstractCommands {
    protected config?: ForgeContext;

    constructor(config?: ForgeContext) {
        this.config = config;
    }

    /**
     * Ensure config is loaded, loading it lazily if needed
     */
    protected async ensureConfig(): Promise<ForgeContext> {
        if (!this.config) {
            this.config = await loadForgeConfig();
        }
        return this.config;
    }
}
