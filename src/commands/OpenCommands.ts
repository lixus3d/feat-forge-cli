import path from 'path';
import { execa } from 'execa';
import { AbstractCommands } from './AbstractCommands';
import { FeatureContext } from '../foundation/FeatureContext';
import { getDefaultIDECommand } from '../lib/ide';
import { pathExists } from '../lib/fs';

/**
 * Command handler for opening features in configured IDEs.
 */
export class OpenCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Open a feature in the configured IDE.
     * If a workspace file exists, it will be opened; otherwise, the feature directory is opened.
     *
     * @param slug - Optional feature slug. If not provided, finds the nearest feature context.
     * @throws {Error} If no IDE is configured
     */
    async open(slug?: string): Promise<void> {
        // 1. Resolve feature context
        const featureContext = slug
            ? await this.context.loadFeatureContext(slug)
            : await FeatureContext.findNearestFeatureContext(this.context);

        // 2. Check that at least one IDE is configured
        if (!this.context.ides || this.context.ides.length === 0) {
            throw new Error('No IDE configured. Add an IDE to your .feat-forge.json configuration.');
        }

        // 3. Use the first IDE from the configuration
        const ide = this.context.ides[0];

        // 4. Resolve the CLI command
        const command = ide.openCommand || getDefaultIDECommand(ide.name);

        // 5. Determine the target to open
        const workspaceFile = path.join(featureContext.path, `${featureContext.slug}.code-workspace`);
        const workspaceExists = await pathExists(workspaceFile);
        const target = workspaceExists ? workspaceFile : featureContext.path;

        // 6. Log informative messages
        if (!workspaceExists) {
            console.log('Workspace file not found, opening feature directory');
        }
        console.log(`Opening "${featureContext.slug}" in ${ide.name}...`);

        // 7. Spawn the IDE process in detached mode
        const subprocess = execa(command, [target], { detached: true, stdio: 'ignore', cleanup: false });
        subprocess.unref();
        // Prevent unhandled rejection if command is not found
        subprocess.catch((error: Error) => {
            console.error(`Failed to open IDE: ${error.message}`);
            process.exitCode = 1;
        });
    }
}
