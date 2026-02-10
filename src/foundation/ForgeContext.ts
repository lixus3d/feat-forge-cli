import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { TemporaryFolderType } from '../lib/constants';
import { ensureDir, ensureLineInFile, pathExists, writeTextFile } from '../lib/fs';
import { gitPathExistsInBranch } from '../lib/git';
import { SPEC_FILES, replaceTemplateMarkers, resolveCustomTemplate, SOURCE_TEMPLATE_AGENT_PATH, templateFor } from '../lib/templates';
import { ForgeConfig, ForgeOptions } from './ForgeConfig';
import { PathHelper } from './PathHelper';
import { Repository, RootRepository, WorktreeRepository } from './Repository';
import { AIAgent } from './types/AIAgent';
import { IDE } from './types/IDE';
import { BranchContext, BranchName } from './BranchContext';
import { off } from 'process';

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
    /**
     * Ensure agent context templates exist in .features/.template/agent/ in the main repo, copying from built-in templates if needed.
     * This allows users to customize agent context templates on a per-repo basis by modifying the files in .features/.template/agent/.
     * If overwrite is true, existing templates will be overwritten with the built-in versions. Otherwise, existing files will be preserved.
     */
    async ensureAgentTemplates(
        inRepository: Repository,
        overwrite: boolean = false,
        dryRun: boolean = false,
        doCommit: boolean = true,
    ): Promise<string[]> {
        const templateAgentDir = inRepository.getAgentTemplatePath();
        await ensureDir(templateAgentDir);

        // basically copy every files in the TEMPLATE_AGENT_PATH folder (with subdirectories)  to templateAgentDir
        const copyTemplatesRecursively = async (srcDir: string, destDir: string): Promise<string[]> => {
            let fileChanges: string[] = [];
            const entries = await readdir(srcDir, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(srcDir, entry.name);
                const destPath = path.join(destDir, entry.name);

                if (entry.isDirectory()) {
                    await ensureDir(destPath);
                    fileChanges = [...fileChanges, ...(await copyTemplatesRecursively(srcPath, destPath))];
                } else if (entry.isFile()) {
                    const destExists = await pathExists(destPath);
                    if (!overwrite && destExists) continue; // don't overwrite existing files unless overwrite flag is set

                    if (!dryRun) {
                        let content = await readFile(srcPath, 'utf8');
                        // Read and replace markers
                        content = await replaceTemplateMarkers(content, this);
                        await writeTextFile(destPath, content);
                    }

                    // Record change only if writing or would write
                    fileChanges.push(destPath);
                }
            }
            return fileChanges;
        };
        const fileChanges = await copyTemplatesRecursively(SOURCE_TEMPLATE_AGENT_PATH, templateAgentDir);
        if (fileChanges.length > 0 && !dryRun && doCommit) {
            await inRepository.commit(
                `chore: add feat-forge agent templates ${overwrite ? ' (overwriting existing templates)' : ''}`,
                fileChanges,
            );
        }
        return fileChanges;
    }

    /**
     * Ensure .active-spec (or the cusomized name) is in .gitignore for one or more repo roots.
     */
    async ensureGitIgnore(): Promise<number> {
        let totalChanges = 0;
        for (const repo of this.repositories) {
            const gitignorePath = path.join(repo.path, '.gitignore');
            const changes = await ensureLineInFile(gitignorePath, this.options.folders.activeSpec);
            if (changes > 0) {
                await repo.commit(`chore: add ${this.options.folders.activeSpec} to .gitignore`, [gitignorePath]);
                totalChanges += changes;
            }
        }
        return totalChanges;
    }

    async ensureBranch(branchName: string, baseBranch?: string): Promise<number> {
        let totalChanges = 0;
        for (const repo of this.repositories) {
            totalChanges += await repo.createBranch(branchName, baseBranch);
        }
        return totalChanges;
    }

    async initBranchSpecFiles(branchContext: BranchContext): Promise<number> {
        const mainRepo = this.mainRepo;
        // Look directly in the branch first, to avoid creating a worktree if the files already exist in the branch
        const relativeFeatureSpecPathParts = path
            .relative(mainRepo.path, mainRepo.getSpecPath(branchContext.branchName))
            .split(path.sep);
        const featureSpecFilePaths = SPEC_FILES.map((fileName) => path.posix.join(...relativeFeatureSpecPathParts, fileName));
        const existing = await Promise.all(
            featureSpecFilePaths.map((featureSpecFilePath) =>
                gitPathExistsInBranch(mainRepo.path, branchContext.branchName, featureSpecFilePath),
            ),
        );
        if (existing.every(Boolean)) {
            return 0;
        }

        console.log(`Spec's files missing for branch '${branchContext.branchName}', trying to add them...`);

        let worktreeRepo: WorktreeRepository;
        if (branchContext.hasRepo(mainRepo.name)) {
            // worktree already exists, we can use it to create the spec files without affecting the main branch
            worktreeRepo = branchContext.getRepo(mainRepo.name);
        } else {
            worktreeRepo = await branchContext.getTemporaryRepo(mainRepo.name, TemporaryFolderType.BRANCH_INIT);
        }

        try {
            await this.ensureBranchSpecFiles(worktreeRepo, branchContext.branchName);
            await worktreeRepo.commit(`docs(${branchContext.branchName}): init branch spec files`, [
                path.join(...relativeFeatureSpecPathParts, '*'),
            ]);
        } finally {
            if (worktreeRepo.temporary) {
                await worktreeRepo.remove();
                // Report that we have made changes
                return 1;
            } else {
                // We made changes, but they are visible in the existing worktree, so we don't need to merge them back to the main branch
                return 0;
            }
        }
    }

    /**
     * Ensure the spec files exist for a branch directory without overwriting existing files.
     * Also creates the agent subdirectory (empty, ready for symlinks).
     */
    private async ensureBranchSpecFiles(repo: WorktreeRepository, branchName: string): Promise<void> {
        repo.mustBeMainRepository();

        const branchSpecPath = repo.getSpecPath(branchName);
        await ensureDir(branchSpecPath);

        // Create main spec files
        for (const fileName of SPEC_FILES) {
            const filePath = path.join(branchSpecPath, fileName);
            if (await pathExists(filePath)) {
                continue;
            }
            const resolved = await resolveCustomTemplate(this, this.rootDir, repo.path, fileName);
            await writeTextFile(filePath, resolved ?? templateFor(fileName));
        }

        // Create agent subdirectory (but don't populate with templates)
        // Templates will be accessed via symlinks to .specs/.template/agent/
        // This will be used later by refreshAgentContextFiles to create the agent context files as symlinks to the templates
        const agentDir = repo.getAgentPath(branchName);
        await ensureDir(agentDir);
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
