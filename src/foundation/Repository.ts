import { rm, symlink } from 'fs/promises';
import path from 'path';
import { ensureDir, pathExists, readTextFile, writeTextFile } from '../lib/fs';
import {
    checkoutBranch,
    createBranch,
    getCurrentBranch,
    getGitStatusPorcelain,
    getGitWorktrees,
    gitBranchExists,
    GitOperationResult,
    runGit,
} from '../lib/git';
import { FeatureContext } from './FeatureContext';
import { ForgeContext } from './ForgeContext';
import { ForgeMode } from './types/ForgeMode';
import { RepositoryInfos } from './types/RepositoryInfos';
import { execa } from 'execa';
import { DirtyAction, promptConfirm, promptDirtyActions, promptText } from '../lib/prompt';
import { TemporaryFolderType } from '../lib/constants';

export type RepositoryStatus = { branch: string | null; dirty: boolean; onFeatureBranch: boolean };

export abstract class Repository {
    public readonly name: string;
    public readonly path: string;
    public readonly main: boolean;
    public readonly rootRepository: RootRepository | null;

    protected context: ForgeContext;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos, rootRepository: RootRepository | null) {
        this.context = context;
        this.name = repoInfos.name;
        this.path = repoInfos.path;
        this.main = repoInfos.main;
        this.rootRepository = rootRepository;
    }

    public isRootRepository(): boolean {
        return this.rootRepository === null;
    }

    public isWorktreeRepository(): boolean {
        return this.rootRepository !== null;
    }

    public isMainRepository(): boolean {
        return this.main;
    }

    public mustBeRootRepository(): this is RootRepository {
        if (!this.isRootRepository()) {
            throw new Error('This operation is only available for the root repository.');
        }
        return true;
    }

    public mustBeWorktreeRepository(): this is WorktreeRepository {
        if (!this.isWorktreeRepository()) {
            throw new Error('This operation is only available for worktree repositories.');
        }
        return true;
    }

    public mustBeMainRepository() {
        if (!this.isMainRepository()) {
            throw new Error('This operation is only available for the main repository.');
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

    get activeFeaturePath(): string {
        if (this.isRootRepository()) throw new Error('Active feature path is not available for the root repository.');

        return path.join(this.path, this.folders.activeFeature);
    }

    get modeFilePath(): string {
        return path.join(this.activeFeaturePath, this.files.forgeMode);
    }

    getFeaturePath(featureSlug: string, ...segments: string[]): string {
        return path.join(this.specsPath, featureSlug, ...segments);
    }

    getAgentPath(featureSlug: string, ...segments: string[]): string {
        return this.getFeaturePath(featureSlug, this.folders.agent, ...segments);
    }

    getTemplatePath(...segments: string[]): string {
        return path.join(this.templatePath, ...segments);
    }

    getAgentTemplatePath(...segments: string[]): string {
        return this.getTemplatePath(this.folders.agent, ...segments);
    }

    async getMode(): Promise<ForgeMode> {
        this.mustBeMainRepository();

        const modeFile = this.modeFilePath;
        if (!(await pathExists(modeFile))) {
            throw new Error(`Mode file not found for active feature in repository ${this.name}. Expected at: ${modeFile}`);
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
        this.mustBeMainRepository();

        const modeFile = this.modeFilePath;
        await writeTextFile(modeFile, `${mode}\n`);
    }

    async hasModeFile(): Promise<boolean> {
        this.mustBeMainRepository();
        return pathExists(this.modeFilePath);
    }

    async hasBranch(branchName: string): Promise<boolean> {
        return gitBranchExists(this.path, branchName);
    }

    async hasFeatureBranch(featureSlug: string): Promise<boolean> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        return this.hasBranch(featureBranchName);
    }

    async createFeatureBranch(featureSlug: string): Promise<number> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        if (!(await this.hasBranch(featureBranchName))) {
            await createBranch(this.path, featureBranchName);
            return 1;
        }
        return 0;
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

    async deleteBranch(branchName: string): Promise<void> {
        await runGit(this.path, ['branch', '-D', branchName]);
    }

    async setActiveFeature(featureContext: FeatureContext): Promise<void> {
        this.mustBeWorktreeRepository();
        if (this.isMainRepository()) {
            const featurePath = this.getFeaturePath(featureContext.slug);
            const mainActivePath = this.activeFeaturePath;
            await rm(mainActivePath, { force: true });
            await symlink(path.relative(path.dirname(mainActivePath), featurePath), mainActivePath);
        } else {
            const mainActivePath = featureContext.mainRepo.activeFeaturePath;
            const secondaryActivePath = this.activeFeaturePath;
            await rm(secondaryActivePath, { force: true });
            // Create relative path from secondary to main's .active-feature
            await symlink(path.relative(path.dirname(secondaryActivePath), mainActivePath), secondaryActivePath);
        }
    }

    async getGitStatus(): Promise<string> {
        return getGitStatusPorcelain(this.path);
    }

    async isDirty(): Promise<boolean> {
        const status = await this.getGitStatus();
        return status.length > 0;
    }

    async getStatus(featureSlug: string): Promise<RepositoryStatus> {
        const branch = await this.getCurrentBranch()!;
        const dirty = await this.isDirty();
        const onFeatureBranch = branch === this.context.getFeatureBranchName(featureSlug);
        return { branch, dirty, onFeatureBranch };
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
            default:
                // Should never reach here due to prompt validation, but return false just in case
                return false;
        }
    }
}

export class RootRepository extends Repository {
    public override readonly rootRepository!: RootRepository;
    public readonly _rootRepository = true;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos) {
        super(context, repoInfos, null);
    }

    getWorktreePath(featureSlug: string, temporary?: TemporaryFolderType): string {
        return temporary
            ? this.getTempWorktreePath(featureSlug, temporary)
            : this.context.paths.getPathInFeatureRoot(featureSlug, this.name);
    }

    getTempWorktreePath(featureSlug: string, type: TemporaryFolderType): string {
        return this.context.paths.getTempWorktreePathForRepo(type, featureSlug, this.name);
    }

    async hasWorktree(featureSlug: string, temporary?: TemporaryFolderType): Promise<boolean> {
        const worktreePath = temporary ? this.getTempWorktreePath(featureSlug, temporary) : this.getWorktreePath(featureSlug);
        return await pathExists(worktreePath);
    }

    async addWorktree(featureSlug: string, temporary?: TemporaryFolderType): Promise<WorktreeRepository> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        const worktreePath: string = temporary ? this.getTempWorktreePath(featureSlug, temporary) : this.getWorktreePath(featureSlug);

        // Check if worktree unexpectedly exists
        if (await pathExists(worktreePath)) {
            throw new Error(
                `Worktree already exists at ${worktreePath}.\\n` +
                    `If you have manually deleted worktree folders, run 'forge feature stop ${featureSlug}' to clean up.`,
            );
        }

        if (await this.hasBranch(featureBranchName)) {
            await runGit(this.path, ['worktree', 'add', worktreePath, featureBranchName]);
        } else {
            await runGit(this.path, ['worktree', 'add', '-b', featureBranchName, worktreePath]);
        }

        return this.getWorktree(featureSlug, temporary);
    }

    async getTemporaryWorktree(featureSlug: string, type: TemporaryFolderType): Promise<WorktreeRepository> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        if (!(await this.hasBranch(featureBranchName))) {
            throw new Error(`Feature branch ${featureBranchName} does not exist in repository ${this.name}`);
        }
        return this.addWorktree(featureSlug, type);
    }

    async getWorktree(featureSlug: string, temporary?: TemporaryFolderType): Promise<WorktreeRepository> {
        if (!(await this.hasWorktree(featureSlug, temporary))) {
            throw new Error(`Worktree for feature ${featureSlug} does not exist in repository ${this.name}`);
        }
        return new WorktreeRepository(
            this.context,
            { name: this.name, path: this.getWorktreePath(featureSlug, temporary), main: this.main },
            this,
            !!temporary,
        );
    }

    async removeWorktree(worktreeRepository: WorktreeRepository): Promise<void> {
        const worktreePath = worktreeRepository.path;
        if (await pathExists(worktreePath)) {
            await runGit(this.path, ['worktree', 'remove', '--force', worktreePath]);
            await rm(worktreePath, { recursive: true, force: true });
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

    async cleanOrphanedWorktree(featureSlug: string): Promise<void> {
        const repoAllWorktrees = await this.listGitWorktrees();
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        for (const wt of repoAllWorktrees) {
            if (!(await pathExists(wt.path))) {
                if ((await wt.getCurrentBranch()) === featureBranchName) {
                    console.log(`Try cleaning up orphaned worktree at ${wt.path} for feature ${featureSlug}`);
                    try {
                        await execa('git', ['worktree', 'remove', '--force', wt.path], { cwd: this.path });
                    } catch (error) {
                        console.log(`  Warning: Could not remove orphaned worktree: ${error}`);
                    }
                } else {
                    console.log(
                        `  Skipping orphaned worktree at ${wt.path} since it's not on the feature branch ${featureBranchName}`,
                    );
                }
            }
        }
    }

    async merge(sourceBranch: string, targetBranch: string): Promise<GitOperationResult> {
        this.mustBeRootRepository(); // FIXME: should be allowed on any repository

        console.log(`\n=== Merging "${sourceBranch}" into "${targetBranch}" on repo "${this.name}" ===`);

        try {
            // Checkout target branch
            console.log(`Checking out "${targetBranch}"...`);
            await checkoutBranch(this.path, targetBranch);

            // Perform merge with --no-ff to preserve feature branch history
            try {
                console.log(`Merging "${sourceBranch}"...`);
                await runGit(this.path, ['merge', '--no-ff', sourceBranch]);
                console.log(`✅ Merge successful for repo: ${this.name}`);
                return { repo: this.name, success: true, hasConflicts: false };
            } catch (error) {
                // Check if it's a merge conflict (detected by special status indicators)
                const status = await getGitStatusPorcelain(this.path);
                if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
                    console.log(`⚠️  Merge conflicts detected in ${this.name}`);
                    console.log(`Please resolve conflicts manually in: ${this.path}`);
                    return { repo: this.name, success: false, hasConflicts: true };
                } else {
                    // Re-throw if it's not a merge conflict
                    throw error;
                }
            }
        } catch (error) {
            console.error(`❌ Error merging ${this.name}:`, error instanceof Error ? error.message : error);
            return { repo: this.name, success: false, hasConflicts: false };
        }
    }
}

export class WorktreeRepository extends Repository {
    public override readonly rootRepository!: RootRepository;
    public readonly _worktreeRepository = true;
    public readonly temporary: boolean;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos, rootRepository: RootRepository, temporary = false) {
        super(context, repoInfos, rootRepository);
        this.temporary = temporary;
    }

    remove() {
        return this.rootRepository.removeWorktree(this);
    }

    async rebase(featureBranch: string, baseBranch: string): Promise<GitOperationResult> {
        this.mustBeWorktreeRepository(); // FIXME: should be allowed on any repository

        try {
            if (await this.isDirty()) {
                console.log(
                    `⚠️  Worktree repository ${this.name} has uncommitted changes. Please commit or stash them before rebasing.`,
                );
                return { repo: this.name, success: false, hasConflicts: false };
            }
            // Make sure we're on the feature branch in the worktree
            const currentBranch = await this.getCurrentBranch();
            if (currentBranch !== featureBranch) {
                console.log(`Checking out ${featureBranch}...`);
                await checkoutBranch(this.path, featureBranch);
            }

            // Perform rebase
            console.log(`Rebasing ${featureBranch} onto ${baseBranch}...`);
            try {
                await runGit(this.path, ['rebase', baseBranch]);
                console.log(`✅ Rebase successful for ${this.name}`);
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
            console.error(`❌ Error rebasing ${this.name}:`, error instanceof Error ? error.message : error);
            return { repo: this.name, success: false, hasConflicts: false };
        }
    }
}
