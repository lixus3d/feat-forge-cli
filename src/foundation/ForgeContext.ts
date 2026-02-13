import { rm } from 'fs/promises';
import { copyFilesRecursively, ensureDir, pathExists } from '../lib/fs';
import { SOURCE_TEMPLATE_AGENT_PATH } from '../lib/templates';
import { BranchContext, BranchName } from './BranchContext';
import { ForgeModeNotDefinedError } from './errors';
import { ForgeConfig } from './ForgeConfig';
import { ForgeOptions } from './ForgeConfigFile';
import { PathHelper } from './PathHelper';
import { RootRepository } from './Repository';
import { AIAgent } from './types/AIAgent';
import { IDE } from './types/IDE';
import { ModeConfig } from './types/ModeConfig';

export class ForgeContext {
    public readonly config: ForgeConfig;
    public readonly rootDir: string;
    public readonly repositories: RootRepository[];
    public readonly agents: AIAgent[];
    public readonly ides: IDE[];
    public readonly paths: PathHelper;

    constructor(rootDir: string, config: ForgeConfig) {
        this.rootDir = config.rootDir || rootDir;
        this.config = config;
        this.repositories = config.repositories.map((repoInfos) => new RootRepository(this, repoInfos));
        this.agents = config.agents;
        this.ides = config.ides;
        this.paths = new PathHelper(this);
    }

    get options(): ForgeOptions {
        return this.config.options;
    }

    get mainRepo(): RootRepository {
        return this.repositories.find((repo) => repo.main)!;
    }

    get mainRepoName(): string {
        return this.mainRepo.name;
    }

    get secondaryRepos(): RootRepository[] {
        return this.repositories.filter((repo) => !repo.main);
    }

    getRepo(repoName: string): RootRepository {
        return this.repositories.find((r) => r.name === repoName)!;
    }

    makeBranchContext(branchName: BranchName) {
        const branchRootPath = this.paths.getBranchRootPath(branchName);
        return new BranchContext(this, branchName, branchRootPath, [], false);
    }

    async loadBranchContext(branchName: string): Promise<BranchContext> {
        const branchRootPath = this.paths.getBranchRootPath(branchName);
        return BranchContext.loadFromPath(this, branchName, branchRootPath);
    }

    async loadActiveBranchesContexts(startDir: string = this.paths.worktreesRoot, prefix: string[] = []): Promise<BranchContext[]> {
        if (!(await pathExists(startDir))) {
            return [];
        }

        const branchContexts: BranchContext[] = [];
        const mainRepoBranches = await this.mainRepo.getBranches();
        // Test logic
        await Promise.all(
            mainRepoBranches.map(async (branchName) => {
                if (await this.branchRootExists(branchName)) {
                    branchContexts.push(await this.loadBranchContext(branchName));
                }
            }),
        );

        return branchContexts;
    }

    async isBranchActive(branchName: string): Promise<boolean> {
        return this.branchRootExists(branchName);
    }

    async getBranchContext(branchName: string): Promise<BranchContext> {
        if (!(await this.isBranchActive(branchName))) {
            return this.makeBranchContext(branchName);
        }
        return this.loadBranchContext(branchName);
    }

    async branchRootExists(branchName: string): Promise<boolean> {
        const branchRootPath = this.paths.getBranchRootPath(branchName);
        return pathExists(branchRootPath);
    }

    getFeatureBranchName(featureSlug: string): string {
        return `${this.options.git.featureBranchPrefix}${featureSlug}`;
    }

    getFixBranchName(fixSlug: string): string {
        return `${this.options.git.fixBranchPrefix}${fixSlug}`;
    }

    getReleaseBranchName(releaseSlug: string): string {
        return `${this.options.git.releaseBranchPrefix}${releaseSlug}`;
    }

    async hasBranch(branchName: string): Promise<boolean> {
        // only check on mainRepo
        return this.mainRepo.hasBranch(branchName);
    }

    async hasFeatureBranch(featureSlug: string): Promise<boolean> {
        // only check on mainRepo
        const branchName = this.getFeatureBranchName(featureSlug);
        return this.mainRepo.hasBranch(branchName);
    }

    async hasFixBranch(fixSlug: string): Promise<boolean> {
        // only check on mainRepo
        const branchName = this.getFixBranchName(fixSlug);
        return this.mainRepo.hasBranch(branchName);
    }

    async hasReleaseBranch(releaseSlug: string): Promise<boolean> {
        // only check on mainRepo
        const branchName = this.getReleaseBranchName(releaseSlug);
        return this.mainRepo.hasBranch(branchName);
    }

    async hasFeatureBranchOnAllRepositories(featureSlug: string): Promise<boolean> {
        const branchName = this.getFeatureBranchName(featureSlug);
        return Promise.all(this.repositories.map((repo) => repo.hasBranch(branchName))).then((results) => results.every(Boolean));
    }

    async hasFixBranchOnAllRepositories(fixSlug: string): Promise<boolean> {
        const branchName = this.getFixBranchName(fixSlug);
        return Promise.all(this.repositories.map((repo) => repo.hasBranch(branchName))).then((results) => results.every(Boolean));
    }

    async hasReleaseBranchOnAllRepositories(releaseSlug: string): Promise<boolean> {
        const branchName = this.getReleaseBranchName(releaseSlug);
        return Promise.all(this.repositories.map((repo) => repo.hasBranch(branchName))).then((results) => results.every(Boolean));
    }

    getDefaultMode(): ModeConfig {
        return this.config.modes.find((mode) => mode.default)!;
    }

    hasMode(modeName: string): boolean {
        return this.config.modes.findIndex((mode) => mode.name === modeName) >= 0;
    }

    modeExistsOrThrow(modeName: string): boolean {
        if (!this.hasMode(modeName)) {
            throw new ForgeModeNotDefinedError(
                `Mode '${modeName}' not found in configuration. Please add it to your configuration file before using it.`,
            );
        }
        return true;
    }

    getMode(modeName: string): ModeConfig {
        this.modeExistsOrThrow(modeName);
        return this.config.modes.find((mode) => mode.name === modeName)!;
    }
    /**
     * Create agent template files in the main repository.
     * They will be used as source templates for the agent context files that will be created on any branch.
     *
     * Typical use case :
     *  - You want to customize the default agent templates provided by FeatForge for all developers working on the project
     *  - You want to stabilize the agent templates used in the project (not using FeatForge internal version)
     *
     * Note : They can be superceded by user-defined templates if placed in the local project .feat-forge folder, so a developer can still customize them locally if needed without affecting the rest of the team.
     */
    async installAgentTemplateLocally(
        targetRepository: RootRepository,
        options: { deleteExisting?: boolean; dryRun?: boolean; overwrite?: boolean } = {},
    ): Promise<string[]> {
        const { deleteExisting = false, dryRun = true, overwrite = false } = options;
        const templateAgentDir = targetRepository.getAgentTemplatePath();
        if (deleteExisting) {
            if (!dryRun) {
                await rm(templateAgentDir, { recursive: true, force: true });
            }
        }
        await ensureDir(templateAgentDir);

        // basically copy every files in the TEMPLATE_AGENT_PATH folder (with subdirectories)  to templateAgentDir
        const fileChanges = await copyFilesRecursively(SOURCE_TEMPLATE_AGENT_PATH, templateAgentDir, { overwrite, dryRun });

        return fileChanges;
    }

    async ensureBranch(branchName: string, baseBranch?: string): Promise<number> {
        let totalChanges = 0;
        for (const repo of this.repositories) {
            totalChanges += await repo.createBranch(branchName, baseBranch);
        }
        return totalChanges;
    }

    /**
     * Look for any worktree that matches the branch but whose path does not exist (orphaned worktree), and remove it.
     */
    async cleanOrphanedWorktrees(branchName: string): Promise<void> {
        // We look at all context repositories to find any worktree that matches the branch but
        // whose path does not exist (orphaned worktree), and we remove it.
        for (const repo of this.repositories) {
            await repo.cleanOrphanedWorktree(branchName);
        }
    }
}
