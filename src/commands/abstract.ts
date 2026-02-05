import { ForgeContext } from '../lib/config';

/**
 * Base class for command handlers with required configuration.
 */
export abstract class AbstractCommands {
    protected readonly config: ForgeContext;

    constructor(config: ForgeContext) {
        this.config = config;
    }
}
