import { readdir, readFile, rm, symlink } from 'fs/promises';
import path from 'path';
import { ForgeContext } from './ForgeContext';
import { RepositoryStatus, RootRepository, WorktreeRepository } from './Repository';
import { ensureDir, ensureLineInFile, pathExists, writeTextFile } from '../lib/fs';
import { getGitStatusPorcelain, runGit } from '../lib/git';
import { ForgeMode } from './types/ForgeMode';
import { replaceTemplateMarkers, SOURCE_TEMPLATE_AGENT_PATH, TemplateFile } from '../lib/templates';
import { refreshCopilotAgentContextFiles } from '../lib/agents';
import { AIAgentName } from './types/AIAgentName';
import { createIDEWorkspaces } from '../lib/ide';
import { RepoName } from './types/RepositoryInfos';
import { promptConfirm, promptForBranch } from '../lib/prompt';
import { TemporaryFolderType } from '../lib/constants';

export type FeatureSlug = string; // must be sanitized for branch names and file paths

export class FeatureContext {
    private context: ForgeContext;
    slug: FeatureSlug;
    path: string;
    repositories: WorktreeRepository[];
    active: boolean;

    constructor(context: ForgeContext, slug: FeatureSlug, path: string, repositories: WorktreeRepository[], active: boolean) {
        this.context = context;
        this.slug = slug;
        this.path = path;
        this.repositories = repositories;
        this.active = active;
    }

    static async loadFromPath(context: ForgeContext, featureRootPath: string): Promise<FeatureContext> {
        const slug = path.basename(featureRootPath);
        // search folder in the featureRootPath that matches a context repository name
        if ((await pathExists(featureRootPath)) === false) {
            throw new Error(`Feature root path does not exist: ${featureRootPath}`);
        }
        const repositories = await FeatureContext.loadWorktreeRepositories(context, featureRootPath);
        return new FeatureContext(context, slug, featureRootPath, repositories, true);
    }

    static async loadWorktreeRepositories(context: ForgeContext, featureRootPath: string): Promise<WorktreeRepository[]> {
        const items = await readdir(featureRootPath, { withFileTypes: true });
        const repoDirs = items.filter((item) => item.isDirectory() && context.repositories.some((repo) => repo.name === item.name));

        if (repoDirs.length === 0) {
            throw new Error(`No repository folder found in feature path: ${featureRootPath}`);
        }

        const repositories: WorktreeRepository[] = repoDirs.map((dir) => {
            const rootRepo = context.repositories.find((r) => r.name === dir.name)!;
            return new WorktreeRepository(
                context,
                { name: rootRepo.name, path: path.join(featureRootPath, dir.name), main: rootRepo.main },
                context.mainRepo,
            );
        });

        return repositories;
    }

    static async findNearestFeatureContext(context: ForgeContext, startDir: string = process.cwd()): Promise<FeatureContext> {
        const currentDir = path.resolve(startDir);
        const currentDirParts = currentDir.split(path.sep);
        const worktreesRootParts = context.paths.worktreesRoot.split(path.sep);

        const featureRootParts = [];

        for (let i = 0; i < currentDirParts.length; i++) {
            if (!worktreesRootParts[i]) {
                if (featureRootParts.length < worktreesRootParts.length) {
                    throw new Error(`Current directory ${currentDir} is not inside the worktrees root ${context.paths.worktreesRoot}`);
                }
                featureRootParts.push(currentDirParts[i]);
                break;
            } else {
                if (currentDirParts[i] === worktreesRootParts[i]) {
                    featureRootParts.push(currentDirParts[i]);
                } else {
                    throw new Error(`Current directory ${currentDir} is not inside the worktrees root ${context.paths.worktreesRoot}`);
                }
            }
        }

        return FeatureContext.loadFromPath(context, path.join(...featureRootParts));
    }

    protected mustBeActive() {
        if (!this.active) {
            throw new Error('This operation requires an active feature context.');
        }
    }

    get mainRepo() {
        return this.repositories.find((repo) => repo.main)!;
    }

    get secondaryRepos() {
        return this.repositories.filter((repo) => !repo.main);
    }

    get featureBranchName(): string {
        return this.context.getFeatureBranchName(this.slug);
    }

    hasRepo(repoName: string): boolean {
        return this.repositories.some((repo) => repo.name === repoName);
    }

    getRepo(repoName: string): WorktreeRepository {
        if (!this.hasRepo(repoName)) throw new Error(`Repository ${repoName} is not part of the feature context`);
        return this.repositories.find((r) => r.name === repoName)!;
    }

    async getTemporaryRepo(repoName: string, type: TemporaryFolderType): Promise<WorktreeRepository> {
        const rootRepo = this.context.getRepo(repoName);
        const tempRepo = await rootRepo.getTemporaryWorktree(this.slug, type);
        this.repositories.push(tempRepo);
        return tempRepo;
    }

    getAgentPath(): string {
        return this.mainRepo.getAgentPath(this.slug);
    }

    getTemplatePath(...segments: string[]): string {
        return this.mainRepo.getTemplatePath(...segments);
    }

    getAgentTemplatePath(...segments: string[]): string {
        return this.mainRepo.getAgentTemplatePath(...segments);
    }

    async getMode(): Promise<ForgeMode> {
        return this.mainRepo.getMode();
    }

    async setMode(mode: ForgeMode): Promise<void> {
        await this.mainRepo.setMode(mode);
        await this.refreshAgentContextFiles(mode);
    }

    async initMode(mode: ForgeMode = ForgeMode.SPEC): Promise<void> {
        if (!(await this.mainRepo.hasModeFile())) {
            await this.setMode(mode);
        }
    }

    async getDirtyRepositories(): Promise<WorktreeRepository[]> {
        this.mustBeActive();

        const dirtyRepositories: WorktreeRepository[] = [];

        for (const repo of this.repositories) {
            const status = await getGitStatusPorcelain(repo.path);
            if (status.length > 0) {
                dirtyRepositories.push(repo);
            }
        }

        return dirtyRepositories;
    }

    async refreshAgentContextFiles(mode?: ForgeMode): Promise<void> {
        const { agents } = this.context;
        mode = mode || (await this.getMode());

        const agentPath = this.getAgentPath();
        await ensureDir(agentPath);

        const agentContextFileName = mode === ForgeMode.SPEC ? TemplateFile.CONTEXT_SPEC : TemplateFile.CONTEXT_CODE;

        // Check if user has a custom override in agent/, otherwise use template
        const overrideAgentContextFilePath = path.join(agentPath, agentContextFileName);
        let targetPath: string;

        if (await pathExists(overrideAgentContextFilePath)) {
            // User has an override in this feature, use it directly
            targetPath = agentContextFileName;
        } else {
            // Use the template from .features/.template/agent/
            const agentContextFileTemplatePath = this.getAgentTemplatePath(agentContextFileName);

            if (!(await pathExists(agentContextFileTemplatePath))) {
                throw new Error(`Missing ${agentContextFileName} in ${agentContextFileTemplatePath}`);
            }

            // Create relative path from agent dir to template
            targetPath = path.relative(agentPath, agentContextFileTemplatePath);
        }

        // Create/update symlinks for all context files
        // Multiple can point to the same context file, so we keep track of which ones we've already created to avoid redundant work
        const createdAgentFiles = new Set<string>();

        for (const agent of agents) {
            // Do not overwrite the context file we're using as source
            if (agent.agentFile === agentContextFileName) {
                continue;
            }

            let useDefaultSymlinkLogic = true;

            switch (agent.name) {
                case AIAgentName.COPILOT:
                    await refreshCopilotAgentContextFiles(this, agent, mode);
                    break;
            }

            if (useDefaultSymlinkLogic) {
                const agentContextFilePath = path.join(agentPath, agent.agentFile);
                if (createdAgentFiles.has(agentContextFilePath)) continue; // already created symlink for this agent file

                await rm(agentContextFilePath, { force: true });
                await symlink(targetPath, agentContextFilePath);
                createdAgentFiles.add(agentContextFilePath);
            }
        }
    }

    async start(): Promise<void> {
        const featureRoot = this.path;
        await ensureDir(featureRoot);

        this.repositories = await this.ensureWorktrees();

        // Set active feature pointer
        await this.setActiveFeature();

        // Set initial mode to spec if not defined
        await this.initMode(); // default to spec mode on start

        // Create IDE workspaces if configured
        if (this.context.ides.length > 0) {
            await createIDEWorkspaces(
                this.slug,
                this.path,
                this.mainRepo.name,
                this.repositories,
                this.context.ides,
                this.context.agents,
            );
        }
        this.active = true;
    }

    async ensureWorktrees(): Promise<WorktreeRepository[]> {
        return Promise.all(
            this.context.repositories.map((repo) => {
                return this.ensureWorktreeForRepo(repo);
            }),
        );
    }

    async ensureWorktreeForRepo(repo: RootRepository): Promise<WorktreeRepository> {
        if (await repo.hasWorktree(this.slug)) {
            return repo.getWorktree(this.slug);
        } else {
            return repo.addWorktree(this.slug);
        }
    }

    async setActiveFeature(): Promise<void> {
        await Promise.all(this.repositories.map((repo) => repo.setActiveFeature(this)));
    }

    async collectRepositoriesStatus(): Promise<Record<RepoName, RepositoryStatus>> {
        const status: Record<RepoName, RepositoryStatus> = {};
        for (const repo of this.repositories) {
            status[repo.name] = await repo.getStatus(this.slug); // use the new getStatus method that includes onFeatureBranch information
        }
        return status;
    }

    async cleanOrphanedWorktrees(): Promise<void> {
        // We look at all context repositories to find any worktree that matches the feature branch but
        // whose path does not exist (orphaned worktree), and we remove it.
        for (const repo of this.context.repositories) {
            await repo.cleanOrphanedWorktree(this);
        }
    }

    async stop(): Promise<void> {
        // Clean up any orphaned worktrees first
        await this.cleanOrphanedWorktrees();

        // Check for uncommitted changes in worktrees
        const dirtyRepositories = await this.getDirtyRepositories();

        // Handle dirty worktrees if any exist
        if (dirtyRepositories.length > 0) {
            for (const repo of dirtyRepositories) {
                const repoShouldProceed = await repo.promptDirtyActions();
                if (!repoShouldProceed) {
                    return;
                }
            }
        }
    }

    async delete(): Promise<void> {
        // Remove worktrees for all repositories
        await Promise.all(this.repositories.map((repo) => repo.remove()));

        if (await pathExists(this.path)) {
            if ((await readdir(this.path)).length !== 0) {
                // Remove feature path if empty
                const confirm = await promptConfirm(`Feature path ${this.path} is not empty. Do you want to remove it?`);
                if (!confirm) {
                    console.log(`Please manually clean up the feature path: ${this.path}`);
                    return;
                }
            }
            await rm(this.path, { recursive: true, force: true });
        }
        this.active = false;
    }

    async archive(): Promise<void> {
        let worktreeRepo: WorktreeRepository;
        if (this.hasRepo(this.mainRepo.name)) {
            // worktree already exists, we can use it to create the feature files without affecting the main branch
            worktreeRepo = this.getRepo(this.mainRepo.name);
        } else {
            worktreeRepo = await this.getTemporaryRepo(this.mainRepo.name, TemporaryFolderType.FEATURE_ARCHIVE);
        }

        // Create archives directory
        await ensureDir(worktreeRepo.specsArchivePath);

        const archivePath = path.join(worktreeRepo.specsArchivePath, this.slug);
        const featurePath = worktreeRepo.getFeaturePath(this.slug);

        // Move feature to archive using git mv
        await runGit(worktreeRepo.path, ['mv', featurePath, archivePath]);

        // Commit the archive
        await worktreeRepo.commit(`docs(${this.slug}): archive feature`, [archivePath]);

        console.log(`✓ Feature \"${this.slug}\" archived successfully.`);
        console.log(
            `  Moved: ${this.context.options.folders.specs}/${this.slug}/ → ${this.context.options.folders.specs}/${this.context.options.folders.archive}/${this.slug}/`,
        );

        // Ask for merge
        const confirmMerge = await promptConfirm(
            'Do you want to merge the archived branch to another branch? (recommended to keep trace in main/dev branch)',
        );
        if (confirmMerge) {
            const targetBranch = await promptForBranch(
                this.context.mainRepo.path,
                'Select target branch to merge archived branch:',
                this.context.options.git.featureBranchPrefix,
                false,
            );
            await worktreeRepo.rootRepository.merge(this.featureBranchName, targetBranch);
        }
    }
}
