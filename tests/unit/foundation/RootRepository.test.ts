import { ForgeContext } from '@/foundation/ForgeContext';
import { Repository, RootRepository, WorktreeRepository } from '@/foundation/Repository';
import { ForgeMode } from '@/foundation/types/ForgeMode';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';

// Mock git and fs operations
vi.mock('@/lib/git');
vi.mock('@/lib/fs');
vi.mock('@/lib/prompt');

import { ForgeExpectMainRepositoryError } from '@/foundation/errors';
import { ForgeFilesOptions, ForgeFoldersOptions, ForgeGitOptions } from '@/foundation/ForgeConfig';
import { TemporaryFolderType } from '@/lib/constants';
import * as fsLib from '@/lib/fs';
import * as gitLib from '@/lib/git';
import { DirtyAction, promptDirtyActions, promptConfirm } from '@/lib/prompt';

const customFolders: ForgeFoldersOptions = {
    activeSpec: 'custom-active-feature',
    worktrees: 'custom-worktrees',
    agent: 'custom-agents',
    archive: 'custom-archive',
    specs: 'custom-specs',
    template: 'custom-templates',
};

const customGit: ForgeGitOptions = {
    featureBranchPrefix: 'custom-feature-prefix',
    fixBranchPrefix: 'custom-fix-prefix',
    releaseBranchPrefix: 'custom-release-prefix',
    protectedBranches: ['custom-main', 'custom-develop'],
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
    return new RepositoryHelpers(forgeContext).getRootRepository({ main: true });
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
        mainRepository = repositoryHelpers.getRootRepository({ main: true });
        secondaryRepository = repositoryHelpers.getRootRepository({ main: false });
        customRepository = createCustomRepository();
    });

    describe('constructor()', () => {
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

    describe('isMainRepository()', () => {
        it('should return true if the repository is the main repository', () => {
            expect(mainRepository.isMainRepository()).toBe(true);
        });

        it('should return false if the repository is not the main repository', () => {
            expect(secondaryRepository.isMainRepository()).toBe(false);
        });
    });

    describe('mustBeMainRepository()', () => {
        it('should not throw if the repository is the main repository', () => {
            expect(() => mainRepository.mustBeMainRepository()).not.toThrow();
        });

        it('should throw if the repository is not the main repository', () => {
            expect(() => secondaryRepository.mustBeMainRepository()).toThrow(ForgeExpectMainRepositoryError);
        });
    });

    describe('specsPath', () => {
        it('should return specsPath', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs);
            expect(customRepository.specsPath).toBe(expectedPath);
        });
    });

    describe('specsArchivePath', () => {
        it('should return specsArchivePath', () => {
            const expectedPath = path.join(customRepository.specsPath, customFolders.archive);
            expect(customRepository.specsArchivePath).toBe(expectedPath);
        });
    });

    describe('templatePath', () => {
        it('should return templatePath', () => {
            const expectedPath = path.join(customRepository.specsPath, customFolders.template);
            expect(customRepository.templatePath).toBe(expectedPath);
        });
    });

    describe('activeFeaturePath', () => {
        it('should return activeFeaturePath for main repository', () => {
            const expectedPath = path.join(customRepository.path, customFolders.activeSpec);
            expect(customRepository.activeSpecPath).toBe(expectedPath);
        });
    });

    describe('modeFilePath', () => {
        it('should return modeFilePath for main repository', () => {
            const expectedPath = path.join(customRepository.activeSpecPath, customFiles.forgeMode);
            expect(customRepository.modeFilePath).toBe(expectedPath);
        });

        it('should throw when accessing modeFilePath on non-main repository', () => {
            expect(() => secondaryRepository.modeFilePath).toThrow(ForgeExpectMainRepositoryError);
        });
    });

    describe('getFeaturePath()', () => {
        it('should return feature path with feature slug', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'test/branch');
            expect(customRepository.getSpecPath('test/branch')).toBe(expectedPath);
        });

        it('should return feature path with segments', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'test/branch', 'docs', 'spec.md');
            expect(customRepository.getSpecPath('test/branch', 'docs', 'spec.md')).toBe(expectedPath);
        });
    });

    describe('getAgentPath()', () => {
        it('should return agent path', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'test/branch', customFolders.agent);
            expect(customRepository.getAgentPath('test/branch')).toBe(expectedPath);
        });

        it('should return agent path with segments', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, 'test/branch', customFolders.agent, 'notes.md');
            expect(customRepository.getAgentPath('test/branch', 'notes.md')).toBe(expectedPath);
        });
    });

    describe('getTemplatePath()', () => {
        it('should return template path', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, customFolders.template);
            expect(customRepository.getTemplatePath()).toBe(expectedPath);
        });

        it('should return template path with segments', () => {
            const expectedPath = path.join(customRepository.path, customFolders.specs, customFolders.template, 'spec.md');
            expect(customRepository.getTemplatePath('spec.md')).toBe(expectedPath);
        });
    });

    describe('getAgentTemplatePath()', () => {
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

    describe('getMode()', () => {
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

        it('should throw when getting mode on non-main repository', async () => {
            await expect(secondaryRepository.getMode()).rejects.toThrow(ForgeExpectMainRepositoryError);
        });
    });

    describe('setMode()', () => {
        it('should set mode to file', async () => {
            await mainRepository.setMode(ForgeMode.CODE);
            expect(fsLib.writeTextFile).toHaveBeenCalledWith(mainRepository.modeFilePath, 'code\n');
        });

        it('should throw when setting mode on non-main repository', async () => {
            await expect(secondaryRepository.setMode(ForgeMode.CODE)).rejects.toThrow(ForgeExpectMainRepositoryError);
        });
    });

    describe('hasModeFile()', () => {
        it('should check if mode file exists', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const exists = await mainRepository.hasModeFile();
            expect(exists).toBe(true);
        });
    });

    describe('hasBranch()', () => {
        it('should check if branch exists', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
            const exists = await mainRepository.hasBranch('main');
            expect(exists).toBe(true);
            expect(gitLib.gitBranchExists).toHaveBeenCalledWith(mainRepository.path, 'main');
        });
    });

    describe('hasFeatureBranch()', () => {
        it('should check if feature branch exists', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
            const exists = await customRepository.hasFeatureBranch('test/branch');
            expect(exists).toBe(true);
            expect(gitLib.gitBranchExists).toHaveBeenCalledWith(
                customRepository.path,
                `${customGit.featureBranchPrefix}${'test/branch'}`,
            );
        });
    });

    describe('createFeatureBranch()', () => {
        (it('should create feature branch if it does not exist', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(false);
            vi.mocked(gitLib.createBranch).mockResolvedValue(undefined);

            const created = await customRepository.createFeatureBranch('test-feature');
            expect(created).toBe(1);
            expect(gitLib.createBranch).toHaveBeenCalledWith(
                customRepository.path,
                `${customGit.featureBranchPrefix}test-feature`,
                undefined,
            );
        }),
            undefined);

        it('should not create feature branch if it already exists', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);

            const created = await mainRepository.createFeatureBranch('test/branch');
            expect(created).toBe(0);
            expect(gitLib.createBranch).not.toHaveBeenCalled();
        });
    });

    describe('getCurrentBranch()', () => {
        it('should get current branch', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');
            const branch = await mainRepository.getCurrentBranch();
            expect(branch).toBe('main');
            expect(gitLib.getCurrentBranch).toHaveBeenCalledWith(mainRepository.path);
        });
    });

    describe('setBranch()', () => {
        it('should set branch', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            await mainRepository.setBranch('develop');
            expect(gitLib.checkoutBranch).toHaveBeenCalledWith(mainRepository.path, 'develop');
        });
    });

    describe('setFeatureBranch()', () => {
        it('should set feature branch', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            await mainRepository.setFeatureBranch('test/branch');
            expect(gitLib.checkoutBranch).toHaveBeenCalled();
        });
    });

    describe('deleteBranch()', () => {
        it('should delete branch', async () => {
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);
            await mainRepository.deleteBranch('feature-branch');
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['branch', '-D', 'feature-branch']);
        });
    });

    describe('getGitStatus()', () => {
        it('should get git status', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');
            const status = await mainRepository.getGitStatus();
            expect(status).toBe('M file.ts\n');
            expect(gitLib.getGitStatusPorcelain).toHaveBeenCalledWith(mainRepository.path);
        });
    });

    describe('isDirty()', () => {
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
    });

    describe('getStatus()', () => {
        it('should get repository status', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('test/branch');
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const status = await mainRepository.getStatus('test/branch');
            expect(status.branch).toBe('test/branch');
            expect(status.dirty).toBe(false);
            expect(status.onExpectedBranch).toBe(true);
        });

        it('should detect when not on feature branch', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const status = await mainRepository.getStatus('test/branch');
            expect(status.onExpectedBranch).toBe(false);
        });
    });

    describe('commit()', () => {
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

    describe('getWorktreePath()', () => {
        it('should get worktree path without temporary flag', () => {
            const worktreePath = mainRepository.getWorktreePath('test/branch');
            expect(worktreePath).toBe(forgeContext.paths.getPathInBranchRoot('test/branch', mainRepository.name));
        });

        it('should get worktree path with temporary flag', () => {
            const tempPath = mainRepository.getWorktreePath('test/branch', TemporaryFolderType.BRANCH_INIT);
            expect(tempPath).toBe(
                forgeContext.paths.getTempWorktreePathForRepo(TemporaryFolderType.BRANCH_INIT, 'test/branch', mainRepository.name),
            );
        });
    });

    describe('getTempWorktreePath()', () => {
        it('should get temporary worktree path', () => {
            const tempPath = mainRepository.getTempWorktreePath('test/branch', TemporaryFolderType.BRANCH_ARCHIVE);
            expect(tempPath).toBe(
                forgeContext.paths.getTempWorktreePathForRepo(TemporaryFolderType.BRANCH_ARCHIVE, 'test/branch', mainRepository.name),
            );
        });
    });

    describe('hasWorktree()', () => {
        it('should check if worktree exists', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const exists = await mainRepository.hasWorktree('test/branch');
            expect(exists).toBe(true);
        });

        it('should check if temporary worktree exists', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const exists = await mainRepository.hasWorktree('test/branch', TemporaryFolderType.BRANCH_INIT);
            expect(exists).toBe(true);
        });
    });

    describe('addWorktree()', () => {
        it('should add worktree with existing feature branch', async () => {
            let callCount = 0;
            vi.mocked(fsLib.pathExists).mockImplementation(async () => {
                callCount++;
                // First call checks if worktree already exists (should be false)
                // Second call in getWorktree checks if it exists (should be true)
                return callCount > 1;
            });
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const worktreeRepository = await mainRepository.addWorktree('test/branch');

            expect(gitLib.gitBranchExists).toHaveBeenCalled();
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, [
                'worktree',
                'add',
                worktreeRepository.path,
                `test/branch`,
            ]);
            expect(worktreeRepository).toBeInstanceOf(WorktreeRepository);
        });

        it('should add worktree and create new branch if feature branch does not exist', async () => {
            let callCount = 0;
            vi.mocked(fsLib.pathExists).mockImplementation(async () => {
                callCount++;
                // First call checks if worktree already exists (should be false)
                // Second call in getWorktree checks if it exists (should be true)
                return callCount > 1;
            });
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(false);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const worktreeRepository = await mainRepository.addWorktree('test/branch');

            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, [
                'worktree',
                'add',
                '-b',
                `test/branch`,
                worktreeRepository.path,
            ]);
        });

        it('should throw error if worktree already exists', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);

            await expect(mainRepository.addWorktree('test/branch')).rejects.toThrow('Worktree already exists');
        });

        it('should add temporary worktree', async () => {
            let callCount = 0;
            vi.mocked(fsLib.pathExists).mockImplementation(async () => {
                callCount++;
                return callCount > 1;
            });
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(false);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const tempWorktreeRepository = await mainRepository.addWorktree('test/branch', TemporaryFolderType.BRANCH_INIT);

            expect(gitLib.runGit).toHaveBeenCalled();
            expect(tempWorktreeRepository).toBeInstanceOf(WorktreeRepository);
            expect(tempWorktreeRepository.temporary).toBe(true);
        });
    });

    describe('getTemporaryWorktree()', () => {
        it('should get temporary worktree', async () => {
            let callCount = 0;
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
            vi.mocked(fsLib.pathExists).mockImplementation(async () => {
                callCount++;
                return callCount > 1;
            });
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const tempWorktreeRepository = await mainRepository.getTemporaryWorktree('test/branch', TemporaryFolderType.BRANCH_INIT);

            expect(gitLib.gitBranchExists).toHaveBeenCalled();
            expect(tempWorktreeRepository).toBeInstanceOf(WorktreeRepository);
            expect(tempWorktreeRepository.temporary).toBe(true);
        });

        it('should throw error when getting temporary worktree if branch does not exist', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(false);

            await expect(mainRepository.getTemporaryWorktree('test/branch', TemporaryFolderType.BRANCH_INIT)).rejects.toThrow(
                'Feature branch',
            );
        });
    });

    describe('getWorktree()', () => {
        it('should get existing worktree', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);

            const worktreeRepository = await mainRepository.getWorktree('test/branch');

            expect(fsLib.pathExists).toHaveBeenCalled();
            expect(worktreeRepository).toBeInstanceOf(WorktreeRepository);
        });

        it('should throw error when getting non-existent worktree', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);

            await expect(mainRepository.getWorktree('test/branch')).rejects.toThrow('Worktree for feature');
        });
    });

    describe('removeWorktree()', () => {
        it('should remove worktree', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const wtPath = mainRepository.getWorktreePath('test/branch');
            const wtRepo = new WorktreeRepository(
                forgeContext,
                { name: mainRepository.name, path: wtPath, main: mainRepository.main },
                mainRepository,
                false,
            );
            await mainRepository.removeWorktree(wtRepo);

            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['worktree', 'remove', '--force', expect.any(String)]);
        });

        it('should skip worktree removal if path does not exist', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const wtPath = mainRepository.getWorktreePath('test/branch');
            const wtRepo = new WorktreeRepository(
                forgeContext,
                { name: mainRepository.name, path: wtPath, main: mainRepository.main },
                mainRepository,
                false,
            );
            await mainRepository.removeWorktree(wtRepo);

            expect(gitLib.runGit).not.toHaveBeenCalled();
        });
    });

    describe('listGitWorktrees()', () => {
        it('should list git worktrees', async () => {
            const mockWorktrees: gitLib.GitWorktreeInfo[] = [
                { path: '/path/to/worktree1', branch: 'feature/test1' },
                { path: '/path/to/worktree2', branch: 'feature/test2' },
            ];
            vi.mocked(gitLib.getGitWorktrees).mockResolvedValue(mockWorktrees as any);

            const worktrees = await mainRepository.listGitWorktrees();

            expect(worktrees).toHaveLength(2);
            expect(gitLib.getGitWorktrees).toHaveBeenCalledWith(mainRepository.path);
        });

        it('should identify temporary worktrees in list', async () => {
            const tempRoot = forgeContext.paths.tempFolderRoot;
            const mockWorktrees: gitLib.GitWorktreeInfo[] = [
                { path: `${tempRoot}/wt1`, branch: 'feature/test1' },
                { path: '/other/path/wt2', branch: 'feature/test2' },
            ];
            vi.mocked(gitLib.getGitWorktrees).mockResolvedValue(mockWorktrees as any);

            const worktrees = await mainRepository.listGitWorktrees();

            expect(worktrees[0].temporary).toBe(true);
            expect(worktrees[1].temporary).toBe(false);
        });
    });

    describe('cleanOrphanedWorktree()', () => {
        it('should clean orphaned worktree on feature branch', async () => {
            const mockWorktrees: gitLib.GitWorktreeInfo[] = [
                { path: '/orphaned/path', branch: `${forgeContext.options.git.featureBranchPrefix}test/branch` },
            ];
            vi.mocked(gitLib.getGitWorktrees).mockResolvedValue(mockWorktrees as any);
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(`${forgeContext.options.git.featureBranchPrefix}test/branch`);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const consoleLogSpy = vi.spyOn(console, 'log');
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            const removeWorktreeSpy = vi.spyOn(mainRepository, 'removeWorktree');

            await mainRepository.cleanOrphanedWorktree(`${forgeContext.options.git.featureBranchPrefix}test/branch`);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Try cleaning up orphaned worktree'));
            expect(removeWorktreeSpy).toHaveBeenCalledWith(expect.anything(), { forceOnEmpty: true });
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Skipping orphaned worktree'));
            expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Could not remove orphaned'));
        });

        it('should skip orphaned worktree on different feature branch', async () => {
            const mockWorktrees: gitLib.GitWorktreeInfo[] = [
                { path: '/orphaned/path', branch: `${forgeContext.options.git.featureBranchPrefix}other-feature` },
            ];
            vi.mocked(gitLib.getGitWorktrees).mockResolvedValue(mockWorktrees as any);
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(`${forgeContext.options.git.featureBranchPrefix}other-feature`);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const consoleLogSpy = vi.spyOn(console, 'log');

            await mainRepository.cleanOrphanedWorktree(`${forgeContext.options.git.featureBranchPrefix}test/branch`);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping orphaned worktree'));
        });

        it('should not process existing worktree paths', async () => {
            const mockWorktrees = [{ path: '/existing/path', branch: 'main' }];
            vi.mocked(gitLib.getGitWorktrees).mockResolvedValue(mockWorktrees as any);
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            await mainRepository.cleanOrphanedWorktree(`${forgeContext.options.git.featureBranchPrefix}test/branch`);
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });

        it('should not throw, just warn if removing orphaned worktree fails', async () => {
            const mockWorktrees: gitLib.GitWorktreeInfo[] = [
                { path: '/orphaned/path', branch: `${forgeContext.options.git.featureBranchPrefix}test/branch` },
            ];
            vi.mocked(gitLib.getGitWorktrees).mockResolvedValue(mockWorktrees as any);
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(`${forgeContext.options.git.featureBranchPrefix}test/branch`);
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Failed to remove worktree'));

            const consoleLogSpy = vi.spyOn(console, 'log');
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            const removeWorktreeSpy = vi.spyOn(mainRepository, 'removeWorktree');

            await mainRepository.cleanOrphanedWorktree(`${forgeContext.options.git.featureBranchPrefix}test/branch`);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Try cleaning up orphaned worktree'));
            expect(removeWorktreeSpy).toHaveBeenCalledWith(expect.anything(), { forceOnEmpty: true });
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Skipping orphaned worktree'));
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not remove orphaned'));
        });
    });

    describe('merge()', () => {
        it('should merge branches successfully', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const result = await mainRepository.merge('develop', 'main');

            expect(result.success).toBe(true);
            expect(result.hasConflicts).toBe(false);
            expect(gitLib.checkoutBranch).toHaveBeenCalledWith(mainRepository.path, 'main');
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['merge', '--no-ff', 'develop']);
        });

        it('should detect merge conflicts', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Merge conflict'));
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('UU file.ts\n');

            const result = await mainRepository.merge('develop', 'main');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(true);
        });

        it('should return error on merge failure', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Merge failed'));
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const result = await mainRepository.merge('develop', 'main');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(false);
        });

        it('should include repo name in merge result', async () => {
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const result = await mainRepository.merge('develop', 'main');

            expect(result.repo).toBe(mainRepository.name);
        });
    });

    describe('promptDirtyActions()', () => {
        it('should return true if repository is clean', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const result = await mainRepository.promptDirtyActions();

            expect(result).toBe(true);
            expect(promptDirtyActions).not.toHaveBeenCalled();
        });

        it('should commit changes when DirtyAction.Commit is selected', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain)
                .mockResolvedValueOnce('M file.ts\n') // First call detects dirty
                .mockResolvedValueOnce(''); // Second call after commit returns clean
            vi.mocked(promptDirtyActions).mockResolvedValue({ action: DirtyAction.Commit, commitMessage: 'Fix something' });
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await mainRepository.promptDirtyActions();

            expect(result).toBe(true);
            expect(promptDirtyActions).toHaveBeenCalled();
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['add', '-A']);
            expect(gitLib.runGit).toHaveBeenCalledWith(mainRepository.path, ['commit', '-m', 'Fix something']);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('has uncommitted changes'));
            consoleSpy.mockRestore();
        });

        it('should throw if repository is still dirty after commit', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain)
                .mockResolvedValueOnce('M file.ts\n') // First call detects dirty
                .mockResolvedValueOnce('M file.ts\n'); // Second call still shows dirty
            vi.mocked(promptDirtyActions).mockResolvedValue({ action: DirtyAction.Commit, commitMessage: 'Fix something' });
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await expect(mainRepository.promptDirtyActions()).rejects.toThrow('Worktree still dirty after commit');

            consoleSpy.mockRestore();
        });

        it('should return false when DirtyAction.Cancel is selected', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');
            vi.mocked(promptDirtyActions).mockResolvedValue({ action: DirtyAction.Cancel });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await mainRepository.promptDirtyActions();

            expect(result).toBe(false);
            expect(gitLib.runGit).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should return true when DirtyAction.Discard is selected and user confirms', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');
            vi.mocked(promptDirtyActions).mockResolvedValue({ action: DirtyAction.Discard });
            vi.mocked(promptConfirm).mockResolvedValue(true);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await mainRepository.promptDirtyActions();

            expect(result).toBe(true);
            expect(promptConfirm).toHaveBeenCalledWith('This will discard local changes. Proceed?');
            consoleSpy.mockRestore();
        });

        it('should return false when DirtyAction.Discard is selected but user does not confirm', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');
            vi.mocked(promptDirtyActions).mockResolvedValue({ action: DirtyAction.Discard });
            vi.mocked(promptConfirm).mockResolvedValue(false);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await mainRepository.promptDirtyActions();

            expect(result).toBe(false);
            expect(promptConfirm).toHaveBeenCalledWith('This will discard local changes. Proceed?');
            consoleSpy.mockRestore();
        });
    });
});
