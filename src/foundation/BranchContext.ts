import { readdir, rm, symlink } from 'fs/promises';
import path from 'path';
import { refreshCopilotAgentContextFiles } from '../lib/agents';
import { TemporaryFolderType } from '../lib/constants';
import { ensureDir, pathExists, readTextFile, writeTextFile } from '../lib/fs';
import { getGitStatusPorcelain, runGit } from '../lib/git';
import { createIDEWorkspaces } from '../lib/ide';
import { promptConfirm, promptForBranch } from '../lib/prompt';
import { TemplateFile } from '../lib/templates';
import { ForgeContext } from './ForgeContext';
import { RepositoryStatus, RootRepository, WorktreeRepository } from './Repository';
import { AIAgentName } from './types/AIAgentName';
import { ForgeMode } from './types/ForgeMode';
import { RepoName } from './types/RepositoryInfos';
import { branchNameAsPath } from '@/lib/branch';

export type BranchName = string; // must be sanitized for branch names and file paths

export class BranchContext {
    private context: ForgeContext;
    branchName: BranchName;
    path: string;
    repositories: WorktreeRepository[];
    active: boolean;

    constructor(context: ForgeContext, branchName: BranchName, path: string, repositories: WorktreeRepository[], active: boolean) {
        this.context = context;
        this.branchName = branchName;
        this.path = path;
        this.repositories = repositories;
        this.active = active;
    }

    get branchNameAsPath(): string {
        return branchNameAsPath(this.branchName);
    }

    isRootBranch(): boolean {
        return !this.isFeatureBranch() && !this.isFixBranch() && !this.isReleaseBranch();
    }

    isFeatureBranch(): boolean {
        return this.branchName.startsWith(this.context.options.git.featureBranchPrefix);
    }

    isFixBranch(): boolean {
        return this.branchName.startsWith(this.context.options.git.fixBranchPrefix);
    }

    isReleaseBranch(): boolean {
        return this.branchName.startsWith(this.context.options.git.releaseBranchPrefix);
    }

    static async loadFromPath(context: ForgeContext, branchName: string, branchRootPath: string): Promise<BranchContext> {
        // search folder in the BranchRootPath that matches a context repository name
        if ((await pathExists(branchRootPath)) === false) {
            throw new Error(`Branch root path does not exist: ${branchRootPath}`);
        }
        const repositories = await BranchContext.loadWorktreeRepositories(context, branchRootPath);
        return new BranchContext(context, branchName, branchRootPath, repositories, true);
    }

    static async loadWorktreeRepositories(context: ForgeContext, branchRootPath: string): Promise<WorktreeRepository[]> {
        const items = await readdir(branchRootPath, { withFileTypes: true });
        const repoDirs = items.filter((item) => item.isDirectory() && context.repositories.some((repo) => repo.name === item.name));

        if (repoDirs.length === 0) {
            throw new Error(`No repository folder found in Branch path: ${branchRootPath}`);
        }

        const repositories: WorktreeRepository[] = repoDirs.map((dir) => {
            const rootRepo = context.repositories.find((r) => r.name === dir.name)!;
            return new WorktreeRepository(
                context,
                { name: rootRepo.name, path: path.join(branchRootPath, dir.name), main: rootRepo.main },
                rootRepo,
            );
        });

        return repositories;
    }

    static async findNearestBranchContext(context: ForgeContext, startDir: string = process.cwd()): Promise<BranchContext> {
        const currentDir = path.resolve(startDir);
        const worktreesRoot = path.resolve(context.paths.worktreesRoot);

        const matchingBranch = (await context.mainRepo.getBranches()).find((branchName) => {
            const branchNamePath = branchNameAsPath(branchName);
            const branchWorktreePath = path.join(worktreesRoot, branchNamePath);
            if (currentDir.startsWith(branchWorktreePath)) {
                return true;
            }
            return false;
        });

        if (!matchingBranch) {
            throw new Error(`No active Branch context found for current directory: ${currentDir}`);
        }

        // If we found a matching branch, we can directly load the Branch context from its worktree path
        const branchRootPath = path.join(worktreesRoot, branchNameAsPath(matchingBranch));
        return BranchContext.loadFromPath(context, matchingBranch, branchRootPath);
    }

    protected mustBeActive() {
        if (!this.active) {
            throw new Error('This operation requires an active Branch context.');
        }
    }

    get mainRepo() {
        return this.repositories.find((repo) => repo.main)!;
    }

    get secondaryRepos() {
        return this.repositories.filter((repo) => !repo.main);
    }

    get modeFilePath(): string {
        return path.join(this.path, this.context.options.files.forgeMode);
    }

    getInPath(...segments: string[]): string {
        return this.context.paths.getPathInBranchRoot(this.branchName, ...segments);
    }

    hasRepo(repoName: string): boolean {
        return this.repositories.some((repo) => repo.name === repoName);
    }

    getRepo(repoName: string): WorktreeRepository {
        if (!this.hasRepo(repoName)) throw new Error(`Repository ${repoName} is not part of the Branch context`);
        return this.repositories.find((r) => r.name === repoName)!;
    }

    async getTemporaryRepo(repoName: string, type: TemporaryFolderType): Promise<WorktreeRepository> {
        const rootRepo = this.context.getRepo(repoName);
        const tempRepo = await rootRepo.getTemporaryWorktree(this.branchName, type);
        this.repositories.push(tempRepo);
        return tempRepo;
    }

    getAgentPath(): string {
        return this.mainRepo.getAgentPath(this.branchName);
    }

    getTemplatePath(...segments: string[]): string {
        return this.mainRepo.getTemplatePath(...segments);
    }

    getAgentTemplatePath(...segments: string[]): string {
        return this.mainRepo.getAgentTemplatePath(...segments);
    }

    async hasModeFile(): Promise<boolean> {
        return pathExists(this.modeFilePath);
    }

    async getMode(): Promise<ForgeMode> {
        const modeFile = this.modeFilePath;
        if (!(await this.hasModeFile())) {
            throw new Error(`Mode file not found for branch ${this.branchName}. Expected at: ${modeFile}`);
        }

        const raw = (await readTextFile(modeFile)).trim().toLowerCase();
        switch (raw) {
            case ForgeMode.SPEC:
                return ForgeMode.SPEC;
            case ForgeMode.CODE:
                return ForgeMode.CODE;
        }
        throw new Error(`Invalid mode value in ${modeFile}: ${raw}`);
    }

    async setMode(mode: ForgeMode): Promise<void> {
        const modeFile = this.modeFilePath;
        await writeTextFile(modeFile, `${mode}\n`);
        await this.refreshAgentContextFiles(mode);
    }

    async initMode(mode: ForgeMode = ForgeMode.SPEC): Promise<void> {
        if (!(await this.hasModeFile())) {
            await this.setMode(mode);
        }
    }

    async deleteBranch(): Promise<void> {
        // do not allow deletion of main,master,etc branches by forge
        if (this.context.options.git.protectedBranches.includes(this.branchName)) {
            throw new Error(`Branch ${this.branchName} is protected and cannot be deleted.`);
        }
        // Must be done on all repositories, not only the one from the Branch
        // It also makes more sense to execute this command on the "root" repositories
        // Note: This will not work if the branch is still used by a worktree
        await Promise.all(this.context.repositories.map((repo) => repo.deleteBranch(this.branchName)));
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
            // User has an override in this Branch, use it directly
            targetPath = agentContextFileName;
        } else {
            // Use the template from .Branchs/.template/agent/
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
        const branchRoot = this.path;
        await ensureDir(branchRoot);

        this.repositories = await this.ensureWorktrees();

        // Set active Branch pointer
        await this.setActiveSpec();

        // Set initial mode to spec if not defined
        await this.initMode(); // default to spec mode on start

        // Create IDE workspaces if configured
        if (this.context.ides.length > 0) {
            await createIDEWorkspaces(
                this.branchName,
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
        if (await repo.hasWorktree(this.branchName)) {
            return repo.getWorktree(this.branchName);
        } else {
            return repo.addWorktree(this.branchName);
        }
    }

    async setActiveSpec(): Promise<void> {
        await Promise.all(this.repositories.map((repo) => repo.setActiveSpec(this)));
    }

    async collectRepositoriesStatus(): Promise<Record<RepoName, RepositoryStatus>> {
        const status: Record<RepoName, RepositoryStatus> = {};
        for (const repo of this.repositories) {
            status[repo.name] = await repo.getStatus(this.branchName);
        }
        return status;
    }

    async stop(): Promise<void> {
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
                // Remove Branch path if empty
                const confirm = await promptConfirm(`Branch path ${this.path} is not empty. Do you want to remove it?`);
                if (!confirm) {
                    console.log(`Please manually clean up the Branch path: ${this.path}`);
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
            // worktree already exists, we can use it to create the Branch files without affecting the main branch
            worktreeRepo = this.getRepo(this.mainRepo.name);
        } else {
            // create a temporary worktree to move the Branch files without affecting the main branch
            worktreeRepo = await this.getTemporaryRepo(this.mainRepo.name, TemporaryFolderType.BRANCH_ARCHIVE);
        }

        // Create archives directory
        await ensureDir(worktreeRepo.specsArchivePath);

        const archivePath = path.join(worktreeRepo.specsArchivePath, this.branchName);
        const branchPath = worktreeRepo.getSpecPath(this.branchName);

        // Move Branch to archive using git mv
        await runGit(worktreeRepo.path, ['mv', branchPath, archivePath]);

        // Commit the archive
        await worktreeRepo.commit(`docs(${this.branchName}): archive Branch`, [archivePath]);

        console.log(`✓ Branch \"${this.branchName}\" archived successfully.`);
        console.log(
            `  Moved: ${this.context.options.folders.specs}/${this.branchName}/ → ${this.context.options.folders.specs}/${this.context.options.folders.archive}/${this.branchName}/`,
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
            await worktreeRepo.rootRepository.merge(this.branchName, targetBranch);
        }
    }
}
