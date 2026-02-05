import path from 'path';
import { pathExists, writeTextFile } from '../lib/fs';

export class InitCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a .feat-forge.json in the current working directory.
     */
    async init(): Promise<void> {
        const targetPath = path.join(process.cwd(), '.feat-forge.json');
        if (await pathExists(targetPath)) {
            throw new Error(`Config already exists at ${targetPath}`);
        }

        const contents = JSON.stringify(
            {
                repoPaths: ['repo'],
                mainRepo: 'repo',
                worktreesPath: 'features',
            },
            null,
            2,
        );
        await writeTextFile(targetPath, `${contents}\n`);

        console.log('Initialized .feat-forge.json');
    }
}
