import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNotEmpty, IsArray, ValidateNested, ArrayNotEmpty, IsBoolean } from 'class-validator';
import { AIAgentName } from './types/AIAgentName';
import { DeepPartial } from './types/DeepPartial';
import { IDEName } from './types/IDEName';
import { RepoPath, RepoName } from './types/RepositoryInfos';

export class ForgeFoldersOptions {
    /**
     * Folder for feature specs within each repo.
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    specs: string = '.specs';
    /**
     * Folder for git worktrees. Default: 'worktrees'
     * Can be empty to put them in the root of the repo, but that can get messy so we default to a separate folder
     */
    @IsOptional()
    @IsString()
    worktrees: string = 'worktrees';
    /**
     * Folder for active spec/branch tracking. Default: '.active-spec'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    activeSpec: string = '.active-spec';
    /**
     * Folder for spec files templates. Default: '.template'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    template: string = '.template';
    /**
     * Folder for repo's agents when agentsInEachRepo is active. Default: '.forge-agents'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    repoAgents: string = '.forge-agents';
    /**
     * Folder for archived feature specs within each repo. Default: '.archives'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    archive: string = '.archives';
}

export class ForgeFilesOptions {
    /**
     * File name for storing the current mode of a feature. Default: '.forge-mode'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    forgeMode: string = '.forge-mode';

    /**
     * File name for the spec file in each feature branch. Default: 'SPEC.md'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    specFile: string = 'SPEC.md';

    /**
     * File name for the TODO file in each feature branch. Default: 'TODO.md'
     */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    todoFile: string = 'TODO.md';
}

export class ForgeGitOptions {
    /**
     * Prefix for feature branches. Default: 'feature/'
     */
    @IsOptional()
    @IsString()
    featureBranchPrefix: string = 'feature/';

    /**
     * Prefix for fix branches. Default: 'fix/'
     */
    @IsOptional()
    @IsString()
    fixBranchPrefix: string = 'fix/';

    /**
     * Prefix for release branches. Default: 'release/'
     */
    @IsOptional()
    @IsString()
    releaseBranchPrefix: string = 'release/';

    /**
     * These branches will have a special status and will be protected from deletion.
     * Default: ['main', 'master', 'develop', 'dev']
     */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    protectedBranches: string[] = ['main', 'master', 'develop', 'dev'];
}

export class ForgeProcessOptions {
    /**
     * Do we ensure that .gitignore includes the .active-spec folder in all repos to avoid accidentally committing active branch pointers? Default: true
     * You might want to set this to false if you want to commit the active spec pointers for some reason, but be careful not to accidentally commit them.
     */
    manageGitIgnore: boolean = true;
    /**
     * Do we put an .active-spec folder in each repo on branch start.
     *
     * Typical use cases :
     *  - You want to open the repo itself in an IDE and have the active spec visible here
     *  - You want to execute Agents only in the context of the repo, while maintaining access to current spec
     *
     * Important : You probably want to set agentsInEachRepo to true if you set this to true.
     */
    @IsOptional()
    @IsBoolean()
    activeSpecInEachRepo: boolean = true;

    /**
     * Do we put agent instruction files in each repo on branch start, or only in the branch context?
     *
     * Typical use cases for putting them in each repo:
     *  - You want to open the repo itself in an IDE and have the agent instructions visible here
     *  - You want to execute Agents only in the context of the repo, while maintaining access to current instructions
     *
     * Important : You probably want to set activeSpecInEachRepo to true if you set this to true.
     */
    @IsOptional()
    @IsBoolean()
    agentsInEachRepo: boolean = true;
}

export class ForgeOptions {
    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeProcessOptions)
    process: ForgeProcessOptions = new ForgeProcessOptions();

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeFoldersOptions)
    folders: ForgeFoldersOptions = new ForgeFoldersOptions();

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeFilesOptions)
    files: ForgeFilesOptions = new ForgeFilesOptions();

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeGitOptions)
    git: ForgeGitOptions = new ForgeGitOptions();
}

/**
 * Type for the .feat-forge.json configuration file
 */
export class ForgeConfigFile {
    /**
     * Optional root directory for all repositories. If not set, repos paths are relative to the config file location. Can be absolute or relative.
     * Useful for monorepos or when you want to keep the config file in a separate folder.
     */
    @IsOptional()
    @IsString()
    rootDir?: string;

    /**
     * List of repositories to manage. Can be a simple string (repo path) or an object with more options.
     * If multiple repos are defined, one must be marked as "main" (or it will take the first one) -> this is the repo where the feature branches will be created and where the active feature will be tracked.
     * If only one repo is defined, it will be considered the main repo by default.
     */
    @IsArray()
    @ArrayNotEmpty()
    repositories!: RepositoryConfigEntry[];

    /**
     * List of spec files to create in each spec folder for a branch. Default: ['SPEC.md', 'TODO.md']
     *
     * Important: Template file must be named accordingly (e.g. .specs/.template/FOOBAR.md for FOOBAR.md) if you want to use custom templates for these files.
     * Note: You can specificy any type of file here (txt, json, etc.)
     */
    @IsOptional()
    @IsArray()
    @IsNotEmpty({ each: true })
    @IsString({ each: true })
    specFiles?: string[];

    /**
     * List of modes for the forge.
     *
     * Each mode can have a specific agent template file and description.
     * The first one (or the one mode marked as default) will be the default mode for new branches.
     */
    @IsOptional()
    @IsArray()
    @Type(() => ModeConfigEntry)
    modes?: ModeConfigEntry[];

    @IsOptional()
    @IsArray()
    agents?: AgentConfigEntry[];

    @IsOptional()
    @IsArray()
    ides?: IDEConfigEntry[];

    @IsOptional()
    @ValidateNested()
    @Type(() => ForgeOptions)
    options?: DeepPartial<ForgeOptions>;
}

/**
 * Agent configuration - can be a simple string (agent name or custom file)
 * or a full config object for more control
 */
export type AgentConfigEntry = string | AgentConfig;

export type AgentConfig = {
    name?: AIAgentName | string | null;
    agentFile?: string;
    settings?: Record<string, unknown>;
};

/**
 * IDE configuration - can be a simple string (IDE name) or a config object
 */
export type IDEConfigEntry = string | IDEConfig;

export type IDEConfig = {
    name: IDEName;
    createWorkspace?: boolean;
    settings?: Record<string, unknown>;
    openCommand?: string;
};

/**
 * Repository configuration - can be a simple string (repo root path) or a full config object
 */
export type RepositoryConfigEntry = RepoPath | RepositoryConfig;

export type RepositoryConfig = {
    name?: RepoName;
    path: RepoPath;
    main?: boolean;
};

export class ModeConfigEntry {
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsString()
    agentFile!: string;

    @IsOptional()
    @IsBoolean()
    default?: boolean = false;
}
