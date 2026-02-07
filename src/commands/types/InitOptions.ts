/**
 * Options for the forge init command.
 * Supports both interactive and non-interactive modes.
 */
export interface InitOptions {
    /**
     * Skip all prompts and use provided values or defaults.
     */
    yes?: boolean;

    /**
     * Force overwrite of existing config (creates timestamped backup).
     */
    force?: boolean;

    /**
     * Require all values via flags, no interactive prompts.
     * Fails with error if required fields are missing.
     */
    nonInteractive?: boolean;

    /**
     * Minimize console output (summary and informational messages).
     */
    quiet?: boolean;

    /**
     * Target directory for config file (defaults to cwd).
     */
    path?: string;

    /**
     * Explicit rootDir value for the config.
     */
    rootDir?: string;

    /**
     * Repository paths (comma-separated string or JSON array).
     */
    repositories?: string;

    /**
     * Agent names (comma-separated string or JSON array).
     */
    agents?: string;

    /**
     * IDE names (comma-separated string or JSON array).
     */
    ides?: string;
}
