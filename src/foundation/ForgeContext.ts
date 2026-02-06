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

    makeFeatureContext(featureSlug: string) {
        const featureRootPath = this.paths.getFeatureRootPath(featureSlug);
        return new FeatureContext(this, featureSlug, featureRootPath, [], false);
    }

    async loadFeatureContext(featureSlug: string): Promise<FeatureContext> {
        const featureRootPath = this.paths.getFeatureRootPath(featureSlug);
        return FeatureContext.loadFromPath(this, featureRootPath);
    }

    async isFeatureActive(featureSlug: string): Promise<boolean> {
        return this.featureRootExists(featureSlug);
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
    async ensureGitIgnore(): Promise<void> {
        for (const repo of this.repositories) {
            const gitignorePath = path.join(repo.path, '.gitignore');
            const changes = await ensureLineInFile(gitignorePath, this.options.folders.activeFeature);
            if (changes > 0) {
                await repo.commit(`chore: add ${this.options.folders.activeFeature} to .gitignore`);
            }
        }
    }

    async ensureFeatureBranch(featureSlug: string): Promise<void> {
        for (const repo of this.repositories) {
            await repo.createFeatureBranch(featureSlug);
        }
    }

    async initFeatureSpecFiles(slug: string, mergeToRoot: boolean = false): Promise<void> {
        const mainRepo = this.mainRepo;
        const branchName = this.getFeatureBranchName(slug);
        // Look directly in the branch first, to avoid creating a worktree if the files already exist in the branch
        const relativeFeatureSpecPath = path.relative(mainRepo.path, mainRepo.getFeaturePath(slug)).split(path.sep);
        const featureSpecFilePaths = FEATURE_FILES.map((fileName) => path.posix.join(...relativeFeatureSpecPath, fileName));
        const existing = await Promise.all(
            featureSpecFilePaths.map((featureSpecFilePath) => gitPathExistsInBranch(mainRepo.path, branchName, featureSpecFilePath)),
        );
        if (existing.every(Boolean)) {
            return;
        }

        const tempWorktree = this.paths.getTempFeatureWorktreePathForRepo(slug, mainRepo.name);
        await ensureDir(path.dirname(tempWorktree));
        if (await pathExists(tempWorktree)) {
            throw new Error(`Temp worktree already exists at ${tempWorktree}`);
        }

        await runGit(mainRepo.path, ['worktree', 'add', tempWorktree, branchName]);
        const worktreeRepo = new WorktreeRepository(this, { name: mainRepo.name, path: tempWorktree, main: true }, mainRepo);
        try {
            await this.ensureFeatureFiles(worktreeRepo, slug);
            await worktreeRepo.commit(`docs(${slug}): init feature spec`, [path.join(...relativeFeatureSpecPath, '*')]);
        } finally {
            await runGit(mainRepo.path, ['worktree', 'remove', '--force', tempWorktree]);
            // Cleanup temp directory
            await rm(tempWorktree, { recursive: true, force: true });
        }
        if (mergeToRoot) {
            // If the feature files were initialized in a worktree, we need to merge them back to the main branch to ensure they are available in the main repo for the feature context and for users who don't use worktrees
            await mainRepo.merge(branchName, (await mainRepo.getCurrentBranch())!);
        }
    }

    /**
     * Ensure the spec files exist for a feature directory without overwriting existing files.
     * Also creates the agent subdirectory (empty, ready for symlinks).
     */
    private async ensureFeatureFiles(repo: WorktreeRepository, slug: string): Promise<void> {
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
