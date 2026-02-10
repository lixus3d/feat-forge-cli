import { ForgeExpectMainRepository } from '@/foundation/errors/ForgeExpectMainRepository';
import { ForgeContext } from '@/foundation/ForgeContext';
import { Repository, RootRepository } from '@/foundation/Repository';
import { ForgeMode } from '@/foundation/types/ForgeMode';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock git and fs operations
vi.mock('@/lib/git');
vi.mock('@/lib/fs');

import * as gitLib from '@/lib/git';
import * as fsLib from '@/lib/fs';
import { ForgeConfigFile, ForgeFilesOptions, ForgeFoldersOptions, ForgeGitOptions } from '@/foundation/ForgeConfig';

const customFolders: ForgeFoldersOptions = {
    activeFeature: 'custom-active-feature',
    worktrees: 'custom-worktrees',
    agent: 'custom-agents',
    archive: 'custom-archive',
    specs: 'custom-specs',
    template: 'custom-templates',
};

const customGit: ForgeGitOptions = {
    featureBranchPrefix: 'custom-feature-prefix',
};

const customFiles: ForgeFilesOptions = {
    forgeMode: 'custom-forge-mode',
};

const createCustomRepository = (): RootRepository => {
    const { forgeContext } = ContextHelper.default({
        options: {
            folders: customFolders,
            files: customFiles,
            git: customGit,
        },
    }).extract();
    return new RepositoryHelpers(forgeContext).getRepository({ main: true });
};

describe('RootRepository', () => {
    let forgeContext: ForgeContext;
    let repositoryHelpers: RepositoryHelpers;
    let mainRepository: RootRepository;
    let secondaryRepository: RootRepository;
    let customRepository: RootRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ forgeContext } = ContextHelper.default().extract());
        repositoryHelpers = new RepositoryHelpers(forgeContext);
        mainRepository = repositoryHelpers.getRepository({ main: true });
        secondaryRepository = repositoryHelpers.getRepository({ main: false });
        customRepository = createCustomRepository();
    });

    describe('constructor', () => {
        it('should create a new Repository instance', () => {
            const repository = new RootRepository(forgeContext, {
                name: 'repo1',
                path: '/path/to/repo1',
                main: false,
            });
            expect(repository).toBeInstanceOf(Repository);
            expect(repository).toBeInstanceOf(RootRepository);
            expect(repository.name).toBe('repo1');
            expect(repository.path).toBe('/path/to/repo1');
            expect(repository.main).toBe(false);
        });

        it('should resolve relative paths to absolute paths', () => {
            const relativePath = '../repo1';
            const repository = new RootRepository(forgeContext, {
                name: 'repo1',
                path: relativePath,
                main: false,
            });
            expect(path.isAbsolute(repository.path)).toBe(true);
        });
    });

    describe('isMainRepository/mustBeMainRepository', () => {
        it('should return true if the repository is the main repository', () => {
            expect(mainRepository.isMainRepository()).toBe(true);
        });

        it('should return false if the repository is not the main repository', () => {
            expect(secondaryRepository.isMainRepository()).toBe(false);
        });

        it('mustBeMainRepository should not throw if the repository is the main repository', () => {
            expect(() => mainRepository.mustBeMainRepository()).not.toThrow();
        });

        it('mustBeMainRepository should throw if the repository is not the main repository', () => {
            expect(() => secondaryRepository.mustBeMainRepository()).toThrow(ForgeExpectMainRepository);
        });
    });

    describe('path getters', () => {
        it('should return specsPath', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs);
            expect(customRepository.specsPath).toBe(expectedPath);
        });

        it('should return specsArchivePath', () => {
            const expectedPath = path.join(customRepository.specsPath, customFolders.archive);
            expect(customRepository.specsArchivePath).toBe(expectedPath);
        });

        it('should return templatePath', () => {
            const expectedPath = path.join(customRepository.specsPath, customFolders.template);
            expect(customRepository.templatePath).toBe(expectedPath);
        });

        it('should return activeFeaturePath for main repository', () => {
            const expectedPath = path.join(customRepository.path, customFolders.activeFeature);
            expect(customRepository.activeFeaturePath).toBe(expectedPath);
        });

        it('should throw when accessing activeFeaturePath on non-main repository', () => {
            expect(() => secondaryRepository.activeFeaturePath).toThrow(ForgeExpectMainRepository);
        });

        it('should return modeFilePath for main repository', () => {
            const expectedPath = path.join(customRepository.activeFeaturePath, customFiles.forgeMode);
            expect(customRepository.modeFilePath).toBe(expectedPath);
        });

        it('should throw when accessing modeFilePath on non-main repository', () => {
            expect(() => secondaryRepository.modeFilePath).toThrow(ForgeExpectMainRepository);
        });
    });

    describe('path helper methods', () => {
        it('should return feature path with feature slug', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'my-feature');
            expect(customRepository.getFeaturePath('my-feature')).toBe(expectedPath);
        });

        it('should return feature path with segments', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'my-feature', 'docs', 'spec.md');
            expect(customRepository.getFeaturePath('my-feature', 'docs', 'spec.md')).toBe(expectedPath);
        });

        it('should return agent path', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'my-feature', customFolders.agent);
            expect(customRepository.getAgentPath('my-feature')).toBe(expectedPath);
        });

        it('should return agent path with segments', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'my-feature', customFolders.agent, 'notes.md');
            expect(customRepository.getAgentPath('my-feature', 'notes.md')).toBe(expectedPath);
        });

        it('should return template path', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, customFolders.template);
            expect(customRepository.getTemplatePath()).toBe(expectedPath);
        });

        it('should return template path with segments', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, customFolders.template, 'spec.md');
            expect(customRepository.getTemplatePath('spec.md')).toBe(expectedPath);
        });

        it('should return agent template path', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, customFolders.template, customFolders.agent);
            expect(customRepository.getAgentTemplatePath()).toBe(expectedPath);
        });

        it('should return agent template path with segments', () => {
            const expectedPath = path.join(
                customRepository.path,
                customFolders.specs,
                customFolders.template,
                customFolders.agent,
                'context.md',
            );
            expect(customRepository.getAgentTemplatePath('context.md')).toBe(expectedPath);
        });
    });

    describe('mode operations', () => {
        it('should get mode from file (SPEC)', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue('spec\n');

            const mode = await mainRepository.getMode();
            expect(mode).toBe(ForgeMode.SPEC);
            expect(fsLib.pathExists).toHaveBeenCalledWith(mainRepository.modeFilePath);
        });

        it('should get mode from file (CODE)', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue('code\n');

            const mode = await mainRepository.getMode();
            expect(mode).toBe(ForgeMode.CODE);
            expect(fsLib.pathExists).toHaveBeenCalledWith(mainRepository.modeFilePath);
        });

        it('should throw if mode file does not exist', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            await expect(mainRepository.getMode()).rejects.toThrow('Mode file not found');
        });

        it('should throw if mode file contains invalid content', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue('invalid-mode\n');
            await expect(mainRepository.getMode()).rejects.toThrow();
        });

        it('should set mode to file', async () => {
            await mainRepository.setMode(ForgeMode.CODE);
            expect(fsLib.writeTextFile).toHaveBeenCalledWith(mainRepository.modeFilePath, 'code\n');
        });

        it('should check if mode file exists', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const exists = await mainRepository.hasModeFile();
            expect(exists).toBe(true);
        });

        it('should throw when getting mode on non-main repository', async () => {
            await expect(secondaryRepository.getMode()).rejects.toThrow(ForgeExpectMainRepository);
        });

        it('should throw when setting mode on non-main repository', async () => {
            await expect(secondaryRepository.setMode(ForgeMode.CODE)).rejects.toThrow(ForgeExpectMainRepository);
        });
    });

    describe('branch operations', () => {
        it('should check if branch exists', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
            const exists = await mainRepository.hasBranch('main');
            expect(exists).toBe(true);
            expect(gitLib.gitBranchExists).toHaveBeenCalledWith(mainRepository.path, 'main');
        });

        it('should check if feature branch exists', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
            const exists = await customRepository.hasFeatureBranch('my-feature');
            expect(exists).toBe(true);
            expect(gitLib.gitBranchExists).toHaveBeenCalledWith(
                customRepository.path,
                `${customGit.featureBranchPrefix}${'my-feature'}`,
            );
        });

        it('should create feature branch if it does not exist', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(false);
            vi.mocked(gitLib.createBranch).mockResolvedValue(undefined);

            const created = await customRepository.createFeatureBranch('my-feature');
            expect(created).toBe(1);
            expect(gitLib.createBranch).toHaveBeenCalledWith(customRepository.path, `${customGit.featureBranchPrefix}my-feature`);
        });

        it('should not create feature branch if it already exists', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);

            const created = await mainRepository.createFeatureBranch('my-feature');
            expect(created).toBe(0);
            expect(gitLib.createBranch).not.toHaveBeenCalled();
        });

        it('should get current branch', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');
            const branch = await mainRepository.getCurrentBranch();
            expect(branch).toBe('main');
            expect(gitLib.getCurrentBranch).toHaveBeenCalledWith(mainRepository.path);
        });

        it('should set branch', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            await mainRepository.setBranch('develop');
            expect(gitLib.checkoutBranch).toHaveBeenCalledWith(mainRepository.path, 'develop');
        });

        it('should set feature branch', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            await mainRepository.setFeatureBranch('my-feature');
            expect(gitLib.checkoutBranch).toHaveBeenCalled();
        });

        it('should delete branch', async () => {
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);
            await mainRepository.deleteBranch('feature-branch');
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['branch', '-D', 'feature-branch']);
        });
    });

    describe('git status operations', () => {
        it('should get git status', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');
            const status = await mainRepository.getGitStatus();
            expect(status).toBe('M file.ts\n');
            expect(gitLib.getGitStatusPorcelain).toHaveBeenCalledWith(mainRepository.path);
        });

        it('should detect dirty repository', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');
            const isDirty = await mainRepository.isDirty();
            expect(isDirty).toBe(true);
        });

        it('should detect clean repository', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            const isDirty = await mainRepository.isDirty();
            expect(isDirty).toBe(false);
        });

        it('should get repository status', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/my-feature');
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const status = await mainRepository.getStatus('my-feature');
            expect(status.branch).toBe('feature/my-feature');
            expect(status.dirty).toBe(false);
            expect(status.onFeatureBranch).toBe(true);
        });

        it('should detect when not on feature branch', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const status = await mainRepository.getStatus('my-feature');
            expect(status.onFeatureBranch).toBe(false);
        });
    });

    describe('commit operations', () => {
        it('should commit with default files', async () => {
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            await mainRepository.commit('Initial commit');

            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['add', '.']);
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['commit', '-m', 'Initial commit']);
        });

        it('should commit with specific files', async () => {
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            await mainRepository.commit('Fix bug', ['src/file.ts', 'tests/file.test.ts']);

            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['add', 'src/file.ts', 'tests/file.test.ts']);
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['commit', '-m', 'Fix bug']);
        });
    });
});
