import { branchNameAsPath } from '@/lib/branch';
import { executeBootstrapScript } from '@/lib/bootstrap';
import { HookEvent, executeHooksForEvent } from '@/lib/hooks';
import { NpmHelper } from '@/foundation/NpmHelper';
import { DirtyAction, promptConfirm, promptDirtyActions } from '@/lib/prompt';
import { rm, symlink } from 'fs/promises';
import path from 'path';
import { TemporaryFolderType } from '../lib/constants';
import { pathExists } from '../lib/fs';
import {
    checkoutBranch,
    createBranch,
    getBranches,
    getCurrentBranch,
    getGitStatusPorcelain,
    getGitWorktrees,
    gitBranchExists,
    GitOperationResult,
    runGit,
} from '../lib/git';
import { BranchContext } from './BranchContext';
import { ForgeExpectMainRepositoryError } from './errors';
import { ForgeContext } from './ForgeContext';
import { RepositoryInfos } from './types/RepositoryInfos';

export type RepositoryStatus = { branch: string | null; dirty: boolean; onExpectedBranch: boolean };

export abstract class Repository {
    public readonly name: string;
    public readonly path: string;
    public readonly main: boolean;

    protected context: ForgeContext;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos) {
        this.context = context;
        this.name = repoInfos.name;
        this.path = path.resolve(this.context.rootDir, repoInfos.path);
        this.main = repoInfos.main;
    }

    public isMainRepository(): boolean {
        return this.main;
    }

    public mustBeMainRepository() {
        if (!this.isMainRepository()) {
            throw new ForgeExpectMainRepositoryError('This operation is only available for the main repository.');
        }
    }

    protected get folders() {
        return this.context.options.folders;
    }

    protected get files() {
        return this.context.options.files;
    }

    get specsPath(): string {
        return path.join(this.path, this.folders.specs);
    }

    get specsArchivePath(): string {
        return path.join(this.specsPath, this.folders.archive);
    }

    get templatePath(): string {
        return path.join(this.specsPath, this.folders.template);
    }

    get activeSpecPath(): string {
        return path.join(this.path, this.folders.activeSpec);
    }

    get agentsPath(): string {
        return path.join(this.path, this.folders.repoAgents);
    }

    getSpecPath(branchName: string, ...segments: string[]): string {
        return path.join(this.specsPath, branchNameAsPath(branchName), ...segments);
    }

    getAgentPath(...segments: string[]): string {
        return path.join(this.agentsPath, ...segments);
    }

    getTemplatePath(...segments: string[]): string {
        return path.join(this.templatePath, ...segments);
    }

    getAgentTemplatePath(...segments: string[]): string {
        return this.getTemplatePath(this.folders.repoAgents, ...segments);
    }

    async hasBranch(branchName: string): Promise<boolean> {
        return gitBranchExists(this.path, branchName);
    }

    async hasBranchWithPrefix(prefix: string): Promise<boolean> {
        const branches = await getBranches(this.path, prefix);
        return branches.length > 0;
    }

    async hasFeatureBranch(featureSlug: string): Promise<boolean> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        return this.hasBranch(featureBranchName);
    }

    async hasFixBranch(fixSlug: string): Promise<boolean> {
        const fixBranchName = this.context.getFixBranchName(fixSlug);
        return this.hasBranch(fixBranchName);
    }

    async hasReleaseBranch(releaseSlug: string): Promise<boolean> {
        const releaseBranchName = this.context.getReleaseBranchName(releaseSlug);
        return this.hasBranch(releaseBranchName);
    }

    async createBranch(branchName: string, baseBranch?: string): Promise<number> {
        if (!(await this.hasBranch(branchName))) {
            await createBranch(this.path, branchName, baseBranch);
            return 1;
        }
        return 0;
    }

    async createFeatureBranch(featureSlug: string): Promise<number> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        return this.createBranch(featureBranchName);
    }

    async createFixBranch(fixSlug: string): Promise<number> {
        const fixBranchName = this.context.getFixBranchName(fixSlug);
        return this.createBranch(fixBranchName);
    }

    async createReleaseBranch(releaseSlug: string): Promise<number> {
        const releaseBranchName = this.context.getReleaseBranchName(releaseSlug);
        return this.createBranch(releaseBranchName);
    }

    async getCurrentBranch(): Promise<string | null> {
        return getCurrentBranch(this.path);
    }

    async setBranch(branchName: string): Promise<void> {
        await checkoutBranch(this.path, branchName);
    }

    async setFeatureBranch(featureSlug: string): Promise<void> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        await this.setBranch(featureBranchName);
    }

    async setFixBranch(fixSlug: string): Promise<void> {
        const fixBranchName = this.context.getFixBranchName(fixSlug);
        await this.setBranch(fixBranchName);
    }

    async setReleaseBranch(releaseSlug: string): Promise<void> {
        const releaseBranchName = this.context.getReleaseBranchName(releaseSlug);
        await this.setBranch(releaseBranchName);
    }

    async deleteBranch(branchName: string): Promise<void> {
        await runGit(this.path, ['branch', '-D', branchName]);
    }

    async getBranches(): Promise<string[]> {
        return getBranches(this.path);
    }

    async getGitStatus(): Promise<string> {
        return getGitStatusPorcelain(this.path);
    }

    async isDirty(): Promise<boolean> {
        const status = await this.getGitStatus();
        return status.length > 0;
    }

    async getStatus(branchName: string): Promise<RepositoryStatus> {
        const branch = await this.getCurrentBranch()!;
        const dirty = await this.isDirty();
        const onExpectedBranch = branch === branchName;
        return { branch, dirty, onExpectedBranch };
    }

    async commit(message: string, files: string[] = ['.']): Promise<void> {
        await runGit(this.path, ['add', ...files]);
        await runGit(this.path, ['commit', '-m', message]);
    }

    async promptDirtyActions(): Promise<boolean> {
        if (!(await this.isDirty())) {
            return true;
        }
        console.log(`Repository ${this.name} at ${this.path} has uncommitted changes.`);
        // Prompt user for action
        const { action, commitMessage } = await promptDirtyActions();

        switch (action) {
            case DirtyAction.Commit:
                await runGit(this.path, ['add', '-A']);
                await runGit(this.path, ['commit', '-m', commitMessage!]);

                // Verify worktree is now clean
                if (await this.isDirty()) {
                    throw new Error(`Worktree still dirty after commit: ${this.path}`);
                }
                return true;
            case DirtyAction.Cancel:
                return false;
            case DirtyAction.Discard:
                return await promptConfirm('This will discard local changes. Proceed?');
        }
    }

    /**
     * Execute hooks for a specific event type in this repository.
     * Executes both npm scripts (feat-forge:hooks:eventType) and shell scripts (.forge/hooks/eventType.sh).
     * Hooks are discovered and executed in alphabetical order for predictable and consistent execution.
     *
     * Supports:
     * - npm scripts: feat-forge:hooks:postBranchStart, feat-forge:hooks:postBranchStart_01, etc.
     * - shell scripts: .forge/hooks/postBranchStart.sh, postBranchStart_01.sh, etc.
     *
     * @param eventType - Type of event (HookEvent enum value)
     * @param params - Optional parameters to pass to hooks as environment variables (FORGE_HOOK_PARAM_NAME)
     * @returns Array of hook names that were executed (both npm and shell script names)
     * @throws Error if any hook fails
     */
    async executeHook(eventType: HookEvent, params?: Record<string, unknown>): Promise<string[]> {
        const repoConfigFolderPath = this.folders.repoConfig;
        const npmHelper = new NpmHelper(this.context, this);

        const executedHooks: string[] = [];

        // Execute npm scripts for this event
        const npmScripts = await npmHelper.executeNpmScriptsForEvent(eventType, params);
        executedHooks.push(...npmScripts);

        // Execute shell scripts for this event
        const shellScripts = await executeHooksForEvent(this.path, repoConfigFolderPath, eventType, params);
        executedHooks.push(...shellScripts);

        return executedHooks;
    }
}

export class RootRepository extends Repository {
    constructor(context: ForgeContext, repoInfos: RepositoryInfos) {
        super(context, repoInfos);
    }

    getWorktreePath(branchName: string, temporary?: TemporaryFolderType): string {
        return temporary
            ? this.getTempWorktreePath(branchName, temporary)
            : this.context.paths.getPathInBranchRoot(branchName, this.name);
    }

    getTempWorktreePath(branchName: string, type: TemporaryFolderType): string {
        return this.context.paths.getTempWorktreePathForRepo(type, branchName, this.name);
    }

    async hasWorktree(branchName: string, temporary?: TemporaryFolderType): Promise<boolean> {
        const worktreePath = temporary ? this.getTempWorktreePath(branchName, temporary) : this.getWorktreePath(branchName);
        return await pathExists(worktreePath);
    }

    async addWorktree(branchName: string, temporary?: TemporaryFolderType): Promise<WorktreeRepository> {
        const worktreePath: string = temporary ? this.getTempWorktreePath(branchName, temporary) : this.getWorktreePath(branchName);

        // Check if worktree unexpectedly exists
        if (await pathExists(worktreePath)) {
            throw new Error(
                `Worktree already exists at ${worktreePath}.\\n` +
                    `If you have manually deleted worktree folders, run 'forge feature stop ${branchName}' to clean up.`,
            );
        }

        if (await this.hasBranch(branchName)) {
            await runGit(this.path, ['worktree', 'add', worktreePath, branchName]);
        } else {
            await runGit(this.path, ['worktree', 'add', '-b', branchName, worktreePath]);
        }

        return this.getWorktree(branchName, temporary);
    }

    async getTemporaryWorktree(branchName: string, type: TemporaryFolderType): Promise<WorktreeRepository> {
        if (!(await this.hasBranch(branchName))) {
            throw new Error(`Feature branch ${branchName} does not exist in repository ${this.name}`);
        }
        return this.addWorktree(branchName, type);
    }

    async getWorktree(branchName: string, temporary?: TemporaryFolderType): Promise<WorktreeRepository> {
        if (!(await this.hasWorktree(branchName, temporary))) {
            throw new Error(`Worktree for feature ${branchName} does not exist in repository ${this.name}`);
        }
        return new WorktreeRepository(
            this.context,
            { name: this.name, path: this.getWorktreePath(branchName, temporary), main: this.main },
            this,
            !!temporary,
        );
    }

    async removeWorktree(worktreeRepository: WorktreeRepository, options?: { forceOnEmpty?: boolean }): Promise<void> {
        const worktreePath = worktreeRepository.path;
        const worktreePathExists = await pathExists(worktreePath);
        if (worktreePathExists || options?.forceOnEmpty) {
            await runGit(this.path, ['worktree', 'remove', '--force', worktreePath]);
            if (worktreePathExists) await rm(worktreePath, { recursive: true, force: true });
        } else {
            console.log(`Worktree path does not exist, skipping removal: ${worktreePath}`);
        }
    }

    async listGitWorktrees(): Promise<WorktreeRepository[]> {
        const rawWorktrees = await getGitWorktrees(this.path);
        const worktrees: WorktreeRepository[] = [];
        for (const wt of rawWorktrees) {
            const isTemporary = wt.path.startsWith(this.context.paths.tempFolderRoot);
            const wtRepo = new WorktreeRepository(
                this.context,
                { name: this.name, path: wt.path, main: this.main },
                this,
                isTemporary,
            );
            worktrees.push(wtRepo);
        }
        return worktrees;
    }

    async cleanOrphanedWorktree(branchName: string): Promise<void> {
        const repoAllWorktrees = await this.listGitWorktrees();
        for (const wt of repoAllWorktrees) {
            if (!(await pathExists(wt.path))) {
                if ((await wt.getCurrentBranch()) === branchName) {
                    console.log(`Try cleaning up orphaned worktree at ${wt.path} for branch ${branchName}`);
                    try {
                        await this.removeWorktree(wt, { forceOnEmpty: true });
                    } catch (error) {
                        console.warn(`  Could not remove orphaned worktree: ${error}`);
                    }
                } else {
                    console.log(`  Skipping orphaned worktree at ${wt.path} since it's not on the feature branch ${branchName}`);
                }
            }
        }
    }

    async merge(sourceBranch: string, targetBranch: string): Promise<GitOperationResult> {
        console.log(`\n=== Merging "${sourceBranch}" into "${targetBranch}" on repo "${this.name}" ===`);

        try {
            await this.executeHook(HookEvent.PRE_MERGE, { sourceBranch, targetBranch });
            // check if target branch is opened as a worktree - if so we must use the worktreeRepository to merge
            let mergeRepoPath = this.path;
            let mergeRepo: Repository = this;
            const repoAllWorktrees = await this.listGitWorktrees();
            const targetWorktree = repoAllWorktrees.find((wt) => wt.path === this.getWorktreePath(targetBranch));
            if (targetWorktree) {
                console.log(
                    `Target branch "${targetBranch}" is currently checked out in worktree at ${targetWorktree.path}. Merging there.`,
                );
                mergeRepoPath = targetWorktree.path;
                mergeRepo = targetWorktree;
            } else {
                if ((await this.getCurrentBranch()) !== targetBranch) {
                    // Checkout target branch
                    console.log(`RootRepo not on target branch. Checking out "${targetBranch}"...`);
                    await checkoutBranch(mergeRepoPath, targetBranch);
                }
            }

            // Perform merge with --no-ff to preserve feature branch history
            try {
                console.log(`Merging "${sourceBranch}"...`);
                await runGit(mergeRepoPath, ['merge', '--no-ff', sourceBranch]);
                console.log(`✅ Merge successful for repo: ${this.name}`);
                await mergeRepo.executeHook(HookEvent.POST_MERGE, { sourceBranch, targetBranch });
                return { repo: this.name, success: true, hasConflicts: false };
            } catch (error) {
                // Check if it's a merge conflict (detected by special status indicators)
                const status = await getGitStatusPorcelain(mergeRepoPath);
                if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
                    console.log(`⚠️  Merge conflicts detected in ${this.name}`);
                    console.log(`Please resolve conflicts manually in: ${mergeRepoPath}`);
                    return { repo: this.name, success: false, hasConflicts: true };
                } else {
                    // Re-throw if it's not a merge conflict
                    throw error;
                }
            }
        } catch (error) {
            console.error(`❌ Error merging ${this.name}:`, error);
            return { repo: this.name, success: false, hasConflicts: false };
        }
    }
}

export class WorktreeRepository extends Repository {
    public readonly rootRepository!: RootRepository;
    public readonly temporary: boolean;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos, rootRepository: RootRepository, temporary = false) {
        super(context, repoInfos);
        this.rootRepository = rootRepository;
        this.temporary = temporary;
    }

    remove() {
        return this.rootRepository.removeWorktree(this);
    }

    async setActiveSpec(branchContext: BranchContext): Promise<void> {
        if (this.isMainRepository()) {
            const specPath = this.getSpecPath(branchContext.branchName);
            const mainActivePath = this.activeSpecPath;
            await rm(mainActivePath, { force: true });
            await symlink(path.relative(path.dirname(mainActivePath), specPath), mainActivePath);
        } else {
            const mainActivePath = branchContext.mainRepo.activeSpecPath;
            const secondaryActivePath = this.activeSpecPath;
            await rm(secondaryActivePath, { force: true });
            // Create relative path from secondary to main's .active-spec
            await symlink(path.relative(path.dirname(secondaryActivePath), mainActivePath), secondaryActivePath);
        }
        await this.executeHook(HookEvent.POST_SET_ACTIVE_SPECS, { branch: branchContext.branchName });
    }

    /**
     * Rebase the worktree's current branch (which should be the feature branch) onto the specified base branch.
     */
    async rebase(specsBranch: string, baseBranch: string): Promise<GitOperationResult> {
        try {
            await this.executeHook(HookEvent.PRE_REBASE, { branch: specsBranch, baseBranch });

            if (await this.isDirty()) {
                console.log(
                    `⚠️  Worktree repository ${this.name} has uncommitted changes. Please commit or stash them before rebasing.`,
                );
                return { repo: this.name, success: false, hasConflicts: false };
            }
            // Make sure we're on the feature branch in the worktree
            const currentBranch = await this.getCurrentBranch();
            if (currentBranch !== specsBranch) {
                console.log(`Checking out ${specsBranch}...`);
                await checkoutBranch(this.path, specsBranch);
            }

            // Perform rebase
            console.log(`Rebasing ${specsBranch} onto ${baseBranch}...`);
            try {
                await runGit(this.path, ['rebase', baseBranch]);
                console.log(`✅ Rebase successful for ${this.name}`);
                await this.executeHook(HookEvent.POST_REBASE, { branch: specsBranch, baseBranch });
                return { repo: this.name, success: true, hasConflicts: false };
            } catch (error) {
                // Check if it's a rebase conflict
                const status = await this.getGitStatus();
                if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
                    console.log(`⚠️  Rebase conflicts detected in worktree repository: ${this.name}`);
                    console.log(`Please resolve conflicts manually in: ${this.path}`);
                    console.log(`After resolving, run: git rebase --continue`);
                    console.log(`To abort, run: git rebase --abort`);
                    return { repo: this.name, success: false, hasConflicts: true };
                } else {
                    // Re-throw if it's not a rebase conflict
                    throw error;
                }
            }
        } catch (error) {
            console.error(`❌ Error rebasing ${this.name}:`, error);
            return { repo: this.name, success: false, hasConflicts: false };
        }
    }

    /**
     * Execute the bootstrap script in this repository.
     * Executes both npm script (feat-forge:bootstrap) and shell script (bootstrap.sh/.bat).
     *
     * @throws Error if any bootstrap script fails
     */
    async executeBootstrapScript(): Promise<void> {
        const repoConfigFolderPath = this.folders.repoConfig;
        const npmHelper = new NpmHelper(this.context, this);

        // Try npm bootstrap script first
        await npmHelper.executeNpmBootstrapScript();

        // Try shell bootstrap script after npm
        await executeBootstrapScript(this.path, repoConfigFolderPath);
    }
}
