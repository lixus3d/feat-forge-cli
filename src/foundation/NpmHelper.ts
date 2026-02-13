import { execa } from 'execa';
import { readFile } from 'fs/promises';
import path from 'path';
import { ForgeContext } from './ForgeContext';
import { Repository } from './Repository';
import { pathExists } from '../lib/fs';
import { paramsToEnv } from '../lib/env';
import { unwatchFile } from 'fs';

interface PackageJson {
    scripts?: Record<string, string>;
    [key: string]: unknown;
}

/**
 * Helper class to manage npm scripts for forge repositories
 * Provides methods for discovering and executing npm scripts with the configured prefix
 */
export class NpmHelper {
    private forgeContext: ForgeContext;
    private repository: Repository;
    private packageManager!: string;

    constructor(forgeContext: ForgeContext, repository: Repository) {
        this.forgeContext = forgeContext;
        this.repository = repository;
    }

    /**
     * Initialize the package manager detection
     * Must be called before executing any scripts
     */
    async initialize(): Promise<void> {
        if (this.packageManager) return;
        if (await pathExists(path.join(this.repository.path, 'pnpm-lock.yaml'))) {
            this.packageManager = 'pnpm';
        } else if (await pathExists(path.join(this.repository.path, 'yarn.lock'))) {
            this.packageManager = 'yarn';
        } else {
            this.packageManager = 'npm';
        }
    }

    /**
     * Read and parse package.json from the repository
     */
    private async readPackageJson(): Promise<PackageJson | null> {
        if (process.env.VITEST) return null; // Skip reading package.json during tests to avoid filesystem dependencies

        const packageJsonPath = path.join(this.repository.path, 'package.json');

        if (!(await pathExists(packageJsonPath))) {
            return null;
        }

        try {
            const content = await readFile(packageJsonPath, 'utf-8');
            return JSON.parse(content) as PackageJson;
        } catch (error) {
            console.error(`Failed to read package.json at ${packageJsonPath}:`, error);
            return null;
        }
    }

    /**
     * Discover npm scripts matching the configured prefix
     * Returns script names like 'feat-forge:bootstrap', 'feat-forge:hooks:postBranchStart', etc.
     */
    private async discoverNpmScripts(subPart?: string, allowMany: boolean = false): Promise<string[]> {
        const packageJson = await this.readPackageJson();

        if (!packageJson || !packageJson.scripts) {
            return [];
        }

        const prefix = this.forgeContext.options.process.npmScriptPrefix;
        const search = `${prefix}:${subPart ? subPart : ''}`;
        return Object.keys(packageJson.scripts)
            .filter((scriptName) => scriptName === search || (allowMany && scriptName.startsWith(search + '_')))
            .sort();
    }

    /**
     * Execute an npm script in the repository
     * Uses the package manager detected during initialization
     */
    private async executeNpmScript(scriptName: string, params?: Record<string, unknown>): Promise<boolean> {
        const packageJson = await this.readPackageJson();

        if (!packageJson || !packageJson.scripts || !packageJson.scripts[scriptName]) {
            return false;
        }

        console.log(`🔄 Executing npm script: ${scriptName}`);
        await this.initialize();

        try {
            const hookEnv = paramsToEnv(params);
            await execa(this.packageManager, ['run', scriptName], {
                cwd: this.repository.path,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    ...hookEnv,
                },
            });

            console.log(`✅ ${this.packageManager} script ${scriptName} completed successfully`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`❌ ${this.packageManager} script ${scriptName} failed: ${message}`);
            throw error;
        }
    }

    async executeNpmScripts(scriptNames: string[], params?: Record<string, unknown>): Promise<string[]> {
        if (scriptNames.length === 0) {
            return [];
        }
        await this.initialize();

        const executedScripts: string[] = [];

        for (const scriptName of scriptNames) {
            try {
                await this.executeNpmScript(scriptName, params);
                executedScripts.push(scriptName);
            } catch (error) {
                throw new Error(`${this.packageManager} script ${scriptName} failed in ${this.repository.name}`);
            }
        }

        return executedScripts;
    }

    /**
     * Execute the npm bootstrap script if it exists
     * Looks for a script named prefix:bootstrap (e.g., 'feat-forge:bootstrap')
     */
    async executeNpmBootstrapScript(params?: Record<string, unknown>): Promise<string[]> {
        return this.executeNpmScripts(await this.discoverNpmScripts('bootstrap', false), params);
    }

    /**
     * Execute npm scripts for a specific event
     * Discovers and executes scripts matching the pattern prefix:hooks:eventType
     * (e.g., 'feat-forge:hooks:postBranchStart')
     */
    async executeNpmScriptsForEvent(eventType: string, params?: Record<string, unknown>): Promise<string[]> {
        return this.executeNpmScripts(await this.discoverNpmScripts('hooks:' + eventType, true), params);
    }
}
