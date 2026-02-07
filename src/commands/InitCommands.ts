import path from 'path';
import { stat } from 'fs/promises';
import { pathExists, writeConfigSafely } from '../lib/fs';
import { FEAT_FORGE_CONFIG_FILE } from '../lib/constants';
import { ForgeConfigFile, RepositoryConfigEntry, AgentConfigEntry, IDEConfigEntry } from '../foundation/ForgeConfig';
import { scanGitRepos, findAncestorForgeConfig } from '../lib/scanner';
import { promptConfirm, promptText, promptChoice, promptCheckbox, CheckboxChoice } from '../lib/prompt';
import { AIAgentName } from '../foundation/types/AIAgentName';
import { IDEName } from '../foundation/types/IDEName';
import { ForgeConfigError } from '../foundation/errors/ForgeConfigError';
import { InitOptions } from './types/InitOptions';

// Constants for UI strings
const DEFAULT_LABEL = ' (default)';
const FEATURES_FOLDER = '.features';
const VSCODE_FOLDER = '.vscode';
const IDEA_FOLDER = '.idea';

export class InitCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Create a .feat-forge.json in the current working directory.
     * Supports both interactive and non-interactive modes via options.
     * 
     * @param options - Configuration options for init behavior
     */
    async init(options: InitOptions = {}): Promise<void> {
        const workingDir = options.path ? path.resolve(options.path) : process.cwd();
        const targetPath = path.join(workingDir, FEAT_FORGE_CONFIG_FILE);
        const isInteractive = !options.nonInteractive && !options.yes;
        const isQuiet = options.quiet || false;

        // Validate environment and check for conflicts
        await this.validateInitEnvironment(targetPath, workingDir, options.force || false, isInteractive);

        // Gather repository paths
        const repoPaths = await this.gatherRepositoryPaths(workingDir, options.repositories, isInteractive, options.nonInteractive || false, options.yes || false);

        // Validate repository paths exist
        await this.validateRepositoryPaths(repoPaths, workingDir);

        // Build configuration
        const configFile = await this.buildConfiguration(
            repoPaths,
            workingDir,
            options.rootDir,
            options.agents,
            options.ides,
            isInteractive,
            options.yes || false
        );

        // Confirm and write configuration
        await this.confirmAndWriteConfig(configFile, targetPath, isInteractive, isQuiet);

        if (!isQuiet) {
            console.log(`✓ Initialized ${FEAT_FORGE_CONFIG_FILE} at ${targetPath}`);
        }
    }

    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================

    /**
     * Validate that the environment is suitable for initialization.
     * Checks for ancestor configs and handles existing config files.
     */
    private async validateInitEnvironment(
        targetPath: string,
        workingDir: string,
        force: boolean,
        isInteractive: boolean
    ): Promise<void> {
        // Check for ancestor configuration
        const ancestor = await findAncestorForgeConfig(workingDir);
        if (ancestor) {
            throw new ForgeConfigError(`An ancestor configuration already exists at ${ancestor}. Aborting init.`);
        }

        // Handle existing config file
        if (await pathExists(targetPath)) {
            if (force) {
                // Force mode: will create backup via writeConfigSafely
                return;
            }

            if (!isInteractive) {
                throw new ForgeConfigError(
                    `Configuration already exists at ${targetPath}. Use --force to overwrite.`
                );
            }

            const overwrite = await promptConfirm(`Configuration already exists at ${targetPath}. Overwrite?`);
            if (!overwrite) {
                console.log('Initialization cancelled.');
                process.exit(0);
            }
        }
    }

    /**
     * Gather repository paths through scanning and user interaction.
     */
    private async gatherRepositoryPaths(
        workingDir: string,
        repositoriesFlag?: string,
        isInteractive: boolean = true,
        nonInteractive: boolean = false,
        useDefaults: boolean = false
    ): Promise<string[]> {
        // If repositories provided via flag, use those
        if (repositoriesFlag) {
            return this.parseStringOrJSON(repositoriesFlag);
        }

        // In non-interactive mode without repositories flag, must fail
        if (nonInteractive) {
            throw new ForgeConfigError(
                'Missing required --repositories flag in non-interactive mode. ' +
                'Provide as comma-separated list or JSON array.'
            );
        }

        const repos = await scanGitRepos(workingDir);

        // Handle no repositories found
        if (repos.length === 0) {
            return await this.handleNoRepositoriesFound(isInteractive);
        }

        const repoPaths = repos.map((r) => this.makeRelativePath(r.path, workingDir));

        // In --yes mode, use discovered repositories automatically
        if (useDefaults) {
            console.log('Discovered repositories:');
            repoPaths.forEach((r) => console.log(` - ${r}`));
            return repoPaths;
        }

        // Present discovered repositories to user with checkbox selection
        console.log('Discovered repositories:');
        repoPaths.forEach((r) => console.log(` - ${r}`));

        const choices: CheckboxChoice[] = repoPaths.map((r) => ({
            name: r,
            value: r,
            checked: true,
        }));

        choices.push({
            name: 'Add custom path...',
            value: '__custom__',
            checked: false,
        });

        const selected = await promptCheckbox('Select repositories to include in the config:', choices);

        // Handle custom path addition
        if (selected.includes('__custom__')) {
            const customPath = await promptText('Enter custom repository path (relative to this folder):');
            if (customPath && customPath.trim()) {
                selected.splice(selected.indexOf('__custom__'), 1);
                selected.push(customPath.trim());
            } else {
                selected.splice(selected.indexOf('__custom__'), 1);
            }
        }

        return selected.length > 0 ? selected : ['.'];
    }

    /**
     * Handle the case when no git repositories are found.
     */
    private async handleNoRepositoriesFound(isInteractive: boolean): Promise<string[]> {
        if (!isInteractive) {
            // Non-interactive: default to current directory
            return ['.'];
        }

        const useCwd = await promptConfirm('No git repositories found. Use current directory as repository?');
        if (useCwd) {
            return ['.'];
        }

        const manual = await promptText('Enter repository path to add (relative to this folder):');
        return [manual || '.'];
    }

    /**
     * Build the complete configuration object.
     */
    private async buildConfiguration(
        repoPaths: string[],
        workingDir: string,
        rootDirFlag?: string,
        agentsFlag?: string,
        idesFlag?: string,
        isInteractive: boolean = true,
        useDefaults: boolean = false
    ): Promise<ForgeConfigFile> {
        const repositories = await this.selectMainRepository(repoPaths, workingDir, isInteractive, useDefaults);
        const agents = await this.configureAgents(agentsFlag, isInteractive, useDefaults);
        const ides = await this.configureIDEs(workingDir, idesFlag, isInteractive, useDefaults);

        return {
            rootDir: rootDirFlag || '.',
            repositories,
            agents,
            ides,
        };
    }

    /**
     * Display configuration summary and confirm before writing.
     */
    private async confirmAndWriteConfig(
        configFile: ForgeConfigFile,
        targetPath: string,
        isInteractive: boolean,
        isQuiet: boolean
    ): Promise<void> {
        if (!isQuiet) {
            console.log('\n=== Configuration Summary ===');
            console.log(JSON.stringify(configFile, null, 4));
            console.log('=============================\n');
        }

        if (isInteractive) {
            const confirmed = await promptConfirm('Write this configuration to .feat-forge.json?');
            if (!confirmed) {
                console.log('Initialization cancelled.');
                process.exit(0);
            }
        }

        const contents = JSON.stringify(configFile, null, 4);
        await writeConfigSafely(targetPath, `${contents}\n`);
    }

    /**
     * Convert an absolute path to a relative path from working directory.
     * Returns '.' if the path is the current directory.
     */
    private makeRelativePath(absolutePath: string, workingDir: string): string {
        return path.relative(workingDir, absolutePath) || '.';
    }

    /**
     * Parse comma-separated input string into trimmed array.
     */
    private parseCommaSeparated(input: string): string[] {
        return input.split(',').map((s) => s.trim()).filter(Boolean);
    }

    /**
     * Parse string input that could be comma-separated or JSON array.
     */
    private parseStringOrJSON(input: string): string[] {
        const trimmed = input.trim();
        
        // Try to parse as JSON array first
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map(String).filter(Boolean);
                }
            } catch {
                throw new ForgeConfigError(`Invalid JSON array: ${trimmed}`);
            }
        }
        
        // Otherwise treat as comma-separated
        return this.parseCommaSeparated(trimmed);
    }

    /**
     * Validate that repository paths exist and are directories.
     */
    private async validateRepositoryPaths(repoPaths: string[], workingDir: string): Promise<void> {
        for (const repoPath of repoPaths) {
            const fullPath = path.join(workingDir, repoPath);
            
            if (!(await pathExists(fullPath))) {
                throw new ForgeConfigError(`Repository path does not exist: ${repoPath}`);
            }
            
            try {
                const stats = await stat(fullPath);
                if (!stats.isDirectory()) {
                    throw new ForgeConfigError(`Repository path is not a directory: ${repoPath}`);
                }
            } catch (error) {
                throw new ForgeConfigError(`Cannot access repository path: ${repoPath}`);
            }
        }
    }

    /**
     * Select the main repository from the list of repository paths.
     * Auto-selects if one has a .features folder, otherwise prompts the user.
     */
    private async selectMainRepository(
        repoPaths: string[],
        workingDir: string,
        isInteractive: boolean,
        useDefaults: boolean
    ): Promise<RepositoryConfigEntry[]> {
        // Handle empty or single repository cases
        if (repoPaths.length === 0) {
            return [];
        }

        if (repoPaths.length === 1) {
            return [{ path: repoPaths[0], main: true }];
        }

        // Determine main repository from multiple options
        const mainRepoPath = await this.determineMainRepository(repoPaths, workingDir, isInteractive, useDefaults);

        // Build repository config entries with main flag
        return repoPaths.map((rp) => ({
            path: rp,
            main: rp === mainRepoPath,
        }));
    }

    /**
     * Determine which repository should be marked as main.
     * Auto-selects if exactly one has .features folder, otherwise prompts.
     */
    private async determineMainRepository(
        repoPaths: string[],
        workingDir: string,
        isInteractive: boolean,
        useDefaults: boolean
    ): Promise<string> {
        const reposWithFeatures = await this.findRepositoriesWithFeatures(repoPaths, workingDir);

        // Auto-select if exactly one repo has .features folder
        if (reposWithFeatures.length === 1) {
            const mainRepo = reposWithFeatures[0];
            console.log(`Auto-selected '${mainRepo}' as main repository (has ${FEATURES_FOLDER} folder).`);
            return mainRepo;
        }

        // If using defaults or non-interactive, pick first repo
        if (!isInteractive || useDefaults) {
            return repoPaths[0];
        }

        // Multiple repos with .features - let user choose
        if (reposWithFeatures.length > 1) {
            console.log(`\nMultiple repositories have ${FEATURES_FOLDER} folders. Select the main repository:`);
            return await this.promptForMainRepository(reposWithFeatures, false);
        }

        // No repos with .features - prompt with first as default
        console.log('\nMultiple repositories found. Select the main repository:');
        return await this.promptForMainRepository(repoPaths, true);
    }

    /**
     * Find which repositories contain a .features folder.
     */
    private async findRepositoriesWithFeatures(repoPaths: string[], workingDir: string): Promise<string[]> {
        const reposWithFeatures: string[] = [];

        for (const repoPath of repoPaths) {
            const fullPath = path.join(workingDir, repoPath);
            const featuresPath = path.join(fullPath, FEATURES_FOLDER);
            if (await pathExists(featuresPath)) {
                reposWithFeatures.push(repoPath);
            }
        }

        return reposWithFeatures;
    }

    /**
     * Prompt user to select main repository from list.
     * @param repos - List of repository paths to choose from
     * @param markFirstAsDefault - Whether to mark the first option as default
     */
    private async promptForMainRepository(repos: string[], markFirstAsDefault: boolean): Promise<string> {
        const choices = repos.map((rp, idx) => ({
            key: String(idx + 1),
            label: `${rp}${markFirstAsDefault && idx === 0 ? DEFAULT_LABEL : ''}`,
        }));

        const selection = await promptChoice('Choose main repository:', choices);
        const selectedChoice = choices.find((c) => c.key === selection);

        if (selectedChoice) {
            return selectedChoice.label.replace(DEFAULT_LABEL, '');
        }

        // Fallback to first repository if selection failed
        return repos[0];
    }

    /**
     * Configure agents for the project.
     * Suggests default agents and allows user to customize via checkboxes.
     */
    private async configureAgents(
        agentsFlag?: string,
        isInteractive: boolean = true,
        useDefaults: boolean = false
    ): Promise<AgentConfigEntry[] | undefined> {
        // If agents provided via flag, use those
        if (agentsFlag) {
            const agentNames = this.parseStringOrJSON(agentsFlag);
            return agentNames.length > 0 ? agentNames : undefined;
        }

        // If using defaults mode, return default agents
        if (useDefaults) {
            return [AIAgentName.COPILOT];
        }

        // Non-interactive: use ForgeConfig defaults (undefined)
        if (!isInteractive) {
            return undefined;
        }

        console.log('\n--- Agent Configuration ---');

        // Build checkbox choices for all available agents
        const availableAgents = Object.values(AIAgentName);
        const choices: CheckboxChoice[] = availableAgents.map((agent) => ({
            name: agent,
            value: agent,
            checked: agent === AIAgentName.COPILOT, // Pre-check COPILOT as default
        }));

        const selected = await promptCheckbox('Select agents to enable:', choices);

        return selected.length > 0 ? selected : undefined;
    }

    /**
     * Configure IDEs for the project.
     * Detects .vscode or .idea folders and allows selection via checkboxes.
     */
    private async configureIDEs(
        workingDir: string,
        idesFlag?: string,
        isInteractive: boolean = true,
        useDefaults: boolean = false
    ): Promise<IDEConfigEntry[] | undefined> {
        // If IDEs provided via flag, use those
        if (idesFlag) {
            const ideNames = this.parseStringOrJSON(idesFlag);
            return ideNames.length > 0 ? ideNames : undefined;
        }

        const detectedIDEs = await this.detectIDEs(workingDir);

        // If using defaults mode, use detected IDEs or undefined
        if (useDefaults) {
            return detectedIDEs.length > 0 ? detectedIDEs : undefined;
        }

        // Non-interactive: use detected IDEs or undefined
        if (!isInteractive) {
            return detectedIDEs.length > 0 ? detectedIDEs : undefined;
        }

        console.log('\n--- IDE Configuration ---');

        // Build checkbox choices for available IDEs
        const availableIDEs = [IDEName.VSCODE]; // Only VSCode is currently supported
        const choices: CheckboxChoice[] = availableIDEs.map((ide) => ({
            name: ide,
            value: ide,
            checked: detectedIDEs.includes(ide), // Pre-check detected IDEs
        }));

        const selected = await promptCheckbox('Select IDEs to configure:', choices);

        return selected.length > 0 ? selected : undefined;
    }

    /**
     * Detect IDE folders in the working directory.
     */
    private async detectIDEs(workingDir: string): Promise<IDEName[]> {
        const vscodeExists = await pathExists(path.join(workingDir, VSCODE_FOLDER));
        const ideaExists = await pathExists(path.join(workingDir, IDEA_FOLDER));

        const detectedIDEs: IDEName[] = [];

        if (vscodeExists) {
            detectedIDEs.push(IDEName.VSCODE);
            console.log(`Detected: VSCode (${VSCODE_FOLDER} folder found)`);
        }

        if (ideaExists) {
            console.log(`Note: ${IDEA_FOLDER} folder found, but IntelliJ IDEA is not yet supported in this version.`);
        }

        return detectedIDEs;
    }

}
