import { branchNameAsPath } from '@/lib/branch';
import { HookEvent } from '@/lib/hooks';
import { replaceTemplateMarkers, resolveAgentFileCustomTemplate, resolveSpecFileCustomTemplate } from '@/lib/templates';
import { readdir, rm, symlink } from 'fs/promises';
import path from 'path';
import { refreshCopilotAgentContextFiles } from '../lib/agents';
import { TemporaryFolderType } from '../lib/constants';
import { ensureDir, ensureLineInFile, pathExists, readTextFile, writeTextFile } from '../lib/fs';
import { getGitStatusPorcelain, runGit } from '../lib/git';
import { createIDEWorkspaces } from '../lib/ide';
import { promptConfirm, promptForBranch } from '../lib/prompt';
import { ForgeContext } from './ForgeContext';
import { Repository, RepositoryStatus, RootRepository, WorktreeRepository } from './Repository';
import { AIAgentName } from './types/AIAgentName';
import { ModeConfig } from './types/ModeConfig';
import { RepoName } from './types/RepositoryInfos';

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

    protected get folders() {
        return this.context.options.folders;
    }

    protected get files() {
        return this.context.options.files;
    }

    get branchNameAsPath(): string {
        return branchNameAsPath(this.branchName);
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

    get activeSpecPath(): string {
        return path.join(this.path, this.folders.activeSpec);
    }

    getInPath(...segments: string[]): string {
        return path.join(this.path, ...segments);
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

    getTemplatePath(...segments: string[]): string {
        return this.mainRepo.getTemplatePath(...segments);
    }

    getAgentTemplatePath(...segments: string[]): string {
        return this.mainRepo.getAgentTemplatePath(...segments);
    }

    async hasModeFile(): Promise<boolean> {
        return pathExists(this.modeFilePath);
    }

    async getMode(): Promise<ModeConfig> {
        const modeFile = this.modeFilePath;
        if (!(await this.hasModeFile())) {
            throw new Error(`Mode file not found for branch ${this.branchName}. Expected at: ${modeFile}`);
        }

        const raw = (await readTextFile(modeFile)).trim().toLowerCase();
        return this.context.getMode(raw);
    }

    async setMode(mode: string): Promise<void> {
        this.context.modeExistsOrThrow(mode); // will throw if mode does not exist in config
        const modeFile = this.modeFilePath;
        await writeTextFile(modeFile, `${mode}\n`);
    }

    async initMode(mode?: string): Promise<void> {
        if (!(await this.hasModeFile())) {
            mode = mode ?? this.context.getDefaultMode().name;
            this.context.modeExistsOrThrow(mode); // will throw if mode does not exist in config
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

    async refreshAgentContextFiles(mode?: string): Promise<void> {
        const { agents } = this.context;
        const modeConfig = mode ? this.context.getMode(mode) : await this.getMode();

        // Create the root [AGENTNAME].md files in the Branch's
        await Promise.all(
            agents.map(async (agent) => {
                const targetFile = this.getInPath(agent.agentFile);
                let content = await resolveAgentFileCustomTemplate(this.context, this.mainRepo, modeConfig.agentFile);
                content = replaceTemplateMarkers(content, this.context, this);
                console.log('Refreshing agent context file for agent', agent.name, 'at', targetFile);
                return writeTextFile(targetFile, content);
            }),
        );

        // Create the agent context files specific to one agent
        await Promise.all(
            agents.map(async (agent) => {
                switch (agent.name) {
                    case AIAgentName.COPILOT:
                        // Copilot specific a .github/agents/xxxxxx.agent.md
                        await refreshCopilotAgentContextFiles(this.context, this);
                        break;
                }
            }),
        );

        // If agentsInEachRepo is true
        // also create the [AGENTNAME].md files in each repository .forge-agents/ folder, so that they can be run locally to the branch
        // Note: The idea of the .forge-agents/ folder is to not mess up with repository root [AGENTNAME].md files that might be used for other purposes
        if (this.context.options.process.agentsInEachRepo) {
            await Promise.all(
                this.repositories.map(async (repo) => {
                    return Promise.all(
                        agents.map(async (agent) => {
                            const targetFile = repo.getAgentPath(agent.agentFile);
                            let content = await resolveAgentFileCustomTemplate(this.context, this.mainRepo, modeConfig.agentFile);
                            content = replaceTemplateMarkers(content, this.context, this, repo);
                            console.log('Refreshing agent context file for agent', agent.name, 'at', targetFile);
                            return writeTextFile(targetFile, content);
                        }),
                    );
                }),
            );
        }
    }

    /**
     * Ensure :
     * - .active-spec (or the cusomized name) is in .gitignore for one or more repo roots.
     * - .forge-agents/* is in .gitignore for one or more repo roots.
     */
    async ensureGitIgnore(repository: Repository): Promise<number> {
        let changes = 0;
        const gitignorePath = path.join(repository.path, '.gitignore');
        changes += await ensureLineInFile(gitignorePath, this.folders.activeSpec);
        changes += await ensureLineInFile(gitignorePath, this.folders.repoAgents);
        if (changes > 0) {
            await repository.commit(`chore: add forge specific files to .gitignore`, [gitignorePath]);
        }
        return changes;
    }

    async initBranch(): Promise<number> {
        let hiddenChanges = 0; // Changes were made on temporary worktrees

        for (const rootRepo of this.context.repositories) {
            let worktreeRepo: WorktreeRepository;
            if (this.hasRepo(rootRepo.name)) {
                // worktree already exists, we can use it to check for spec files without affecting the main branch
                worktreeRepo = this.getRepo(rootRepo.name);
            } else {
                worktreeRepo = await this.getTemporaryRepo(rootRepo.name, TemporaryFolderType.BRANCH_INIT);
            }
            // Check for spec files in the main repository
            if (worktreeRepo.isMainRepository()) {
                const fileChanges = await this.ensureBranchSpecFiles(worktreeRepo, this.branchName);
                if (fileChanges.length) {
                    await worktreeRepo.commit(`docs(${this.branchName}): init branch spec files`, fileChanges);
                    if (worktreeRepo.temporary) {
                        hiddenChanges += fileChanges.length;
                    }
                }
            }
            if (this.context.options.process.manageGitIgnore) {
                const gitIgnoreChanges = await this.ensureGitIgnore(worktreeRepo);
                if (gitIgnoreChanges > 0 && worktreeRepo.temporary) {
                    hiddenChanges += gitIgnoreChanges;
                }
            }
            if (worktreeRepo.temporary) {
                await worktreeRepo.remove();
            }
        }

        return hiddenChanges;
    }

    /**
     * Ensure the spec files exist for a branch directory without overwriting existing files.
     * Also creates the agent subdirectory (empty, ready for symlinks).
     */
    private async ensureBranchSpecFiles(repo: WorktreeRepository, branchName: string): Promise<string[]> {
        repo.mustBeMainRepository();

        let fileChanges: string[] = [];
        const branchSpecPath = repo.getSpecPath(branchName);
        await ensureDir(branchSpecPath);

        // Create main spec files
        for (const fileName of this.context.config.specFiles) {
            const filePath = path.join(branchSpecPath, fileName);
            if (await pathExists(filePath)) {
                continue;
            }
            const content = await resolveSpecFileCustomTemplate(this.context, repo, fileName);
            await writeTextFile(filePath, content);
            fileChanges.push(filePath);
        }

        return fileChanges;
    }

    async start(): Promise<void> {
        const branchRoot = this.path;
        await ensureDir(branchRoot);

        this.repositories = await this.ensureWorktrees();

        // Set active Branch pointer
        await this.setActiveSpec();

        // Set initial mode to spec if not defined
        await this.initMode(); // default to spec mode on start

        // Refresh agent context files based on mode (will create symlinks to template files or user overrides)
        await this.refreshAgentContextFiles();

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

        // Execute bootstrap scripts in each repository
        for (const repository of this.repositories) {
            try {
                await repository.executeBootstrapScript();
            } catch (error) {
                // Soft error here, so that the Branch can still be started even if a bootstrap script fails, which can be useful for debugging or if the bootstrap script is not critical
                console.error(`❌ Failed to execute bootstrap script in ${repository.name}`, error);
            }
        }

        // Execute postBranchStart hooks in each repository
        await this.executeHook(HookEvent.POST_BRANCH_START, { branch: this.branchName });

        this.active = true;
    }

    /**
     * Execute hooks for a specific event across all repositories in this branch.
     * Soft errors are used so that the branch operation can continue even if a hook fails.
     *
     * Hook parameters are passed to scripts as environment variables with FORGE_HOOK_ prefix.
     * Example: params { sourceBranch: 'feature/xyz' } becomes FORGE_HOOK_SOURCEBRANCH
     *
     * @param eventType - Type of hook event to execute
     * @param params - Optional parameters to pass to hooks as environment variables
     */
    private async executeHook(eventType: HookEvent, params?: Record<string, unknown>): Promise<void> {
        for (const repository of this.repositories) {
            try {
                const executedHooks = await repository.executeHooksForEvent(eventType, params);
                if (executedHooks.length > 0) {
                    console.log(`📌 Executed ${executedHooks.length} ${eventType} hook(s) in ${repository.name}: ${executedHooks.join(', ')}`);
                }
            } catch (error) {
                // Soft error: allow the branch operation to continue even if a hook fails
                console.error(`❌ Failed to execute ${eventType} hooks in ${repository.name}`, error);
            }
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
        if (await repo.hasWorktree(this.branchName)) {
            return repo.getWorktree(this.branchName);
        } else {
            return repo.addWorktree(this.branchName);
        }
    }

    async setActiveSpec(): Promise<void> {
        // Create .active-spec symlink in the Branch root pointing to the current spec file in the main repository worktree
        const specRealPath = this.mainRepo.getSpecPath(this.branchName);
        const activeSpecPath = this.activeSpecPath;
        await rm(activeSpecPath, { force: true });
        await symlink(path.relative(path.dirname(activeSpecPath), specRealPath), activeSpecPath);

        // If activeSpecInEachRepo is true, also create/update .active-spec symlink in each repository worktree pointing to the same spec file in the main repository worktree
        if (this.context.options.process.activeSpecInEachRepo) {
            await Promise.all(this.repositories.map((repo) => repo.setActiveSpec(this)));
        }
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
