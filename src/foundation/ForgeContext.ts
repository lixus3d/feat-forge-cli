import { ensureDir, ensureLineInFile, pathExists, writeTextFile } from '../lib/fs';
import { PathHelper } from './PathHelper';
import { FeatureContext } from './FeatureContext';
import { ForgeConfig, ForgeOptions } from './ForgeConfig';
import { Repository, RootRepository, WorktreeRepository } from './Repository';
import { AIAgent } from './types/AIAgent';
import { IDE } from './types/IDE';
import { readdir, readFile, rm } from 'fs/promises';
import path from 'path';
import {
    FEATURE_FILES,
    replaceTemplateMarkers,
    resolveCustomTemplate,
    SOURCE_TEMPLATE_AGENT_PATH,
    templateFor,
} from '../lib/templates';
import { getGitStatusPorcelain, gitPathExistsInBranch, runGit } from '../lib/git';
import { merge } from '../lib/merger';
import { TemporaryFolderType } from '../lib/constants';

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

    makeFeatureContext(featureSlug: string) {
        const featureRootPath = this.paths.getFeatureRootPath(featureSlug);
        return new FeatureContext(this, featureSlug, featureRootPath, [], false);
    }

    async loadFeatureContext(featureSlug: string): Promise<FeatureContext> {
        const featureRootPath = this.paths.getFeatureRootPath(featureSlug);
        return FeatureContext.loadFromPath(this, featureRootPath);
    }

    async loadFeatureContexts(): Promise<FeatureContext[]> {
        if (!(await pathExists(this.paths.worktreesRoot))) {
            return [];
        }
        const entries = await readdir(this.paths.worktreesRoot, { withFileTypes: true });
        const featureRoots = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

        return Promise.all(featureRoots.map((featureSlug) => this.loadFeatureContext(featureSlug)));
    }

    async isFeatureActive(featureSlug: string): Promise<boolean> {
        return this.featureRootExists(featureSlug);
    }

    async getFeatureContext(featureSlug: string): Promise<FeatureContext> {
        if (!(await this.isFeatureActive(featureSlug))) {
            return this.makeFeatureContext(featureSlug);
        }
        return this.loadFeatureContext(featureSlug);
    }

    async featureRootExists(featureSlug: string): Promise<boolean> {
        const featureRootPath = this.paths.getFeatureRootPath(featureSlug);
        return pathExists(featureRootPath);
    }

    getFeatureBranchName(featureSlug: string): string {
        return `${this.options.git.featureBranchPrefix}${featureSlug}`;
    }

    async hasFeatureBranchOnAllRepositories(featureSlug: string): Promise<boolean> {
        const branchName = this.getFeatureBranchName(featureSlug);
        return Promise.all(this.repositories.map((repo) => repo.hasBranch(branchName))).then((results) => results.every(Boolean));
    }

    async hasFeatureBranch(featureSlug: string): Promise<boolean> {
        // only check on mainRepo
        const branchName = this.getFeatureBranchName(featureSlug);
        return this.mainRepo.hasBranch(branchName);
    }

    /**
     * Ensure agent context templates exist in .features/.template/agent/ in the main repo, copying from built-in templates if needed.
     * This allows users to customize agent context templates on a per-repo basis by modifying the files in .features/.template/agent/.
     * If overwrite is true, existing templates will be overwritten with the built-in versions. Otherwise, existing files will be preserved.
     */
    async ensureAgentTemplates(overwrite: boolean = false): Promise<string[]> {
        const rootMainRepo = this.mainRepo;
        const templateAgentDir = rootMainRepo.getAgentTemplatePath();
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
                    if (!overwrite && (await pathExists(destPath))) continue; // don't overwrite existing files unless overwrite flag is set
                    let content = await readFile(srcPath, 'utf8');
                    content = await replaceTemplateMarkers(content, this); // replace markers in the template content
                    await writeTextFile(destPath, content);
                    fileChanges.push(destPath);
                }
            }
            return fileChanges;
        };
        const fileChanges = await copyTemplatesRecursively(SOURCE_TEMPLATE_AGENT_PATH, templateAgentDir);
        if (fileChanges.length > 0) {
            await rootMainRepo.commit(
                `chore: ensure agent templates ${overwrite ? ' (overwriting existing templates)' : ''}`,
                fileChanges,
            );
        }
        return fileChanges;
    }

    /**
     * Ensure .active-feature is in .gitignore for one or more repo roots.
     */
    async ensureGitIgnore(): Promise<number> {
        let totalChanges = 0;
        for (const repo of this.repositories) {
            const gitignorePath = path.join(repo.path, '.gitignore');
            const changes = await ensureLineInFile(gitignorePath, this.options.folders.activeFeature);
            if (changes > 0) {
                await repo.commit(`chore: add ${this.options.folders.activeFeature} to .gitignore`, [gitignorePath]);
                totalChanges += changes;
            }
        }
        return totalChanges;
    }

    async ensureFeatureBranch(featureSlug: string): Promise<number> {
        let totalChanges = 0;
        for (const repo of this.repositories) {
            totalChanges += await repo.createFeatureBranch(featureSlug);
        }
        return totalChanges;
    }

    async initFeatureSpecFiles(featureContext: FeatureContext): Promise<number> {
        const slug = featureContext.slug;
        const mainRepo = this.mainRepo;
        const branchName = this.getFeatureBranchName(slug);
        // Look directly in the branch first, to avoid creating a worktree if the files already exist in the branch
        const relativeFeatureSpecPathParts = path.relative(mainRepo.path, mainRepo.getFeaturePath(slug)).split(path.sep);
        const featureSpecFilePaths = FEATURE_FILES.map((fileName) => path.posix.join(...relativeFeatureSpecPathParts, fileName));
        const existing = await Promise.all(
            featureSpecFilePaths.map((featureSpecFilePath) => gitPathExistsInBranch(mainRepo.path, branchName, featureSpecFilePath)),
        );
        if (existing.every(Boolean)) {
            return 0;
        }

        console.log(`Feature spec files missing for feature '${slug}', trying to add them...`);

        let worktreeRepo: WorktreeRepository;
        if (featureContext.hasRepo(mainRepo.name)) {
            // worktree already exists, we can use it to create the feature files without affecting the main branch
            worktreeRepo = featureContext.getRepo(mainRepo.name);
        } else {
            worktreeRepo = await featureContext.getTemporaryRepo(mainRepo.name, TemporaryFolderType.FEATURE_INIT);
        }

        try {
            await this.ensureFeatureFiles(worktreeRepo, slug);
            await worktreeRepo.commit(`docs(${slug}): init feature spec`, [path.join(...relativeFeatureSpecPathParts, '*')]);
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
     * Ensure the spec files exist for a feature directory without overwriting existing files.
     * Also creates the agent subdirectory (empty, ready for symlinks).
     */
    private async ensureFeatureFiles(repo: WorktreeRepository, slug: string): Promise<void> {
        repo.mustBeMainRepository();

        const featureSpecsPath = repo.getFeaturePath(slug);
        await ensureDir(featureSpecsPath);

        // Create main feature files
        for (const fileName of FEATURE_FILES) {
            const filePath = path.join(featureSpecsPath, fileName);
            if (await pathExists(filePath)) {
                continue;
            }
            const resolved = await resolveCustomTemplate(this.rootDir, repo.path, fileName);
            await writeTextFile(filePath, resolved ?? templateFor(fileName));
        }

        // Create agent subdirectory (but don't populate with templates)
        // Templates will be accessed via symlinks to .features/.template/agent/
        // This will be used later by refreshAgentContextFiles to create the agent context files as symlinks to the templates
        const agentDir = repo.getAgentPath(slug);
        await ensureDir(agentDir);
    }
}
