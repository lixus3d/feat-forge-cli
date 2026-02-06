import path from 'path';
import { pathExists, readTextFile, writeTextFile } from '../lib/fs';
import {
    checkoutBranch,
    createBranch,
    getCurrentBranch,
    getGitStatusPorcelain,
    gitBranchExists,
    GitOperationResult,
    runGit,
} from '../lib/git';
import { ForgeContext } from './ForgeContext';
import { ForgeMode } from './types/ForgeMode';
import { RepositoryInfos } from './types/RepositoryInfos';

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

    protected isRootRepository(): boolean {
        return this.rootRepository === null;
    }

    protected isWorktreeRepository(): boolean {
        return this.rootRepository !== null;
    }

    protected isMainRepository(): boolean {
        return this.main;
    }

    protected mustBeRootRepository(): this is RootRepository {
        if (!this.isRootRepository()) {
            throw new Error('This operation is only available for the root repository.');
        }
        return true;
    }

    protected mustBeWorktreeRepository(): this is WorktreeRepository {
        if (!this.isWorktreeRepository()) {
            throw new Error('This operation is only available for worktree repositories.');
        }
        return true;
    }

    protected mustBeMainRepository() {
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

    async createFeatureBranch(featureSlug: string): Promise<void> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        if (!(await this.hasBranch(featureBranchName))) {
            await createBranch(this.path, featureBranchName);
        }
    }

    async getCurrentBranch(): Promise<string | null> {
        return getCurrentBranch(this.path);
    }

    async commit(message: string, files: string[] = ['.']): Promise<void> {
        await runGit(this.path, ['add', ...files]);
        await runGit(this.path, ['commit', '-m', message]);
    }

    async merge(sourceBranch: string, targetBranch: string): Promise<GitOperationResult> {
        this.mustBeRootRepository();

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

    async rebase(featureBranch: string, baseBranch: string): Promise<GitOperationResult> {
        this.mustBeWorktreeRepository();

        try {
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
                const status = await getGitStatusPorcelain(this.path);
                if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
                    console.log(`⚠️  Rebase conflicts detected in ${this.name}`);
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

export class RootRepository extends Repository {
    public override readonly rootRepository!: RootRepository;
    public readonly _rootRepository = true;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos) {
        super(context, repoInfos, null);
    }

    getWorktreePath(featureSlug: string): string {
        return this.context.paths.getPathInFeatureRoot(featureSlug, this.name);
    }

    async addWorktree(featureSlug: string): Promise<WorktreeRepository> {
        const featureBranchName = this.context.getFeatureBranchName(featureSlug);
        const worktreePath = this.getWorktreePath(featureSlug);

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

        return this.getWorktree(featureSlug);
    }

    async hasWorktree(featureSlug: string): Promise<boolean> {
        const worktreePath = this.getWorktreePath(featureSlug);
        return await pathExists(worktreePath);
    }

    async getWorktree(featureSlug: string): Promise<WorktreeRepository> {
        return new WorktreeRepository(this.context, { name: this.name, path: this.getWorktreePath(featureSlug), main: false }, this);
    }
}

export class WorktreeRepository extends Repository {
    public override readonly rootRepository!: RootRepository;
    public readonly _worktreeRepository = true;

    constructor(context: ForgeContext, repoInfos: RepositoryInfos, rootRepository: RootRepository) {
        super(context, repoInfos, rootRepository);
    }
}
