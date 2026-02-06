import { readdir, readFile, rm, symlink } from 'fs/promises';
import path from 'path';
import { ForgeContext } from './ForgeContext';
import { RootRepository, WorktreeRepository } from './Repository';
import { ensureDir, ensureLineInFile, pathExists, writeTextFile } from '../lib/fs';
import { getGitStatusPorcelain } from '../lib/git';
import { ForgeMode } from './types/ForgeMode';
import { replaceTemplateMarkers, SOURCE_TEMPLATE_AGENT_PATH, TemplateFile } from '../lib/templates';
import { refreshCopilotAgentContextFiles } from '../lib/agents';
import { AIAgentName } from './types/AIAgentName';
import { createIDEWorkspaces } from '../lib/ide';

export type FeatureSlug = string;

export class FeatureContext {
    private context: ForgeContext;
    name: string;
    path: string;
    repositories: WorktreeRepository[];
    active: boolean;

    constructor(context: ForgeContext, slug: FeatureSlug, path: string, repositories: WorktreeRepository[], active: boolean) {
        this.context = context;
        this.name = slug;
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

        return new FeatureContext(context, slug, featureRootPath, repositories, true);
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

    getAgentPath(): string {
        return this.mainRepo.getAgentPath(this.name);
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

    async findDirtyRepositories(): Promise<WorktreeRepository[]> {
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
                this.name,
                this.path,
                this.mainRepo.name,
                this.repositories,
                this.context.ides,
                this.context.agents,
            );
        }
    }

    async ensureWorktrees(): Promise<WorktreeRepository[]> {
        return Promise.all(
            this.context.repositories.map((repo) => {
                return this.ensureWorktreeForRepo(repo);
            }),
        );
    }

    async ensureWorktreeForRepo(repo: RootRepository): Promise<WorktreeRepository> {
        if (await repo.hasWorktree(this.name)) {
            return repo.getWorktree(this.name);
        } else {
            return repo.addWorktree(this.name);
        }
    }

    async setActiveFeature(): Promise<void> {
        // Set .active-feature in main repo pointing to .features/<slug>/
        const featurePath = this.mainRepo.getFeaturePath(this.name);
        const mainActivePath = this.mainRepo.activeFeaturePath;
        await rm(mainActivePath, { force: true });
        await symlink(path.relative(mainActivePath, featurePath), mainActivePath);

        // Set .active-feature in secondary repos pointing to main repo's .active-feature
        for (const secondaryRepo of this.secondaryRepos) {
            const secondaryActivePath = secondaryRepo.activeFeaturePath;
            await rm(secondaryActivePath, { force: true });
            // Create relative path from secondary to main's .active-feature
            await symlink(path.relative(secondaryActivePath, mainActivePath), secondaryActivePath);
        }
    }
}
