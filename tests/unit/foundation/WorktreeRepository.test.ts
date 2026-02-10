import { ForgeContext } from '@/foundation/ForgeContext';
import { Repository, RootRepository, WorktreeRepository } from '@/foundation/Repository';
import { TemporaryFolderType } from '@/lib/constants';
import * as fsLib from '@/lib/fs';
import * as gitLib from '@/lib/git';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';

// Mock git and fs operations
vi.mock('@/lib/git');
vi.mock('@/lib/fs');
vi.mock('fs/promises');

import { rm, symlink } from 'fs/promises';

describe('WorktreeRepository', () => {
    let forgeContext: ForgeContext;
    let repositoryHelpers: RepositoryHelpers;
    let rootMainRepository: RootRepository;
    let rootSecondaryRepository: RootRepository;
    let worktreeMainRepository: WorktreeRepository;
    let worktreeSecondaryRepository: WorktreeRepository;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ forgeContext } = ContextHelper.default().extract());
        repositoryHelpers = new RepositoryHelpers(forgeContext);
        rootMainRepository = repositoryHelpers.getRootRepository({ main: true });
        rootSecondaryRepository = repositoryHelpers.getRootRepository({ name: 'repo2', main: false });

        // Create a worktree repository for testing
        worktreeMainRepository = new WorktreeRepository(
            forgeContext,
            { name: rootMainRepository.name, path: rootMainRepository.getWorktreePath('test-feature'), main: rootMainRepository.main },
            rootMainRepository,
            false,
        );
        worktreeSecondaryRepository = new WorktreeRepository(
            forgeContext,
            {
                name: rootSecondaryRepository.name,
                path: rootSecondaryRepository.getWorktreePath('test-feature'),
                main: rootSecondaryRepository.main,
            },
            rootSecondaryRepository,
            false,
        );
    });

    describe('constructor()', () => {
        it('should create a new WorktreeRepository instance', () => {
            const wtPath = rootMainRepository.getWorktreePath('my-feature');
            const wt = new WorktreeRepository(forgeContext, { name: 'repo1', path: wtPath, main: false }, rootMainRepository, false);
            expect(wt).toBeInstanceOf(Repository);
            expect(wt).toBeInstanceOf(WorktreeRepository);
            expect(wt.name).toBe('repo1');
            expect(wt.path).toBe(wtPath);
            expect(wt.rootRepository).toBe(rootMainRepository);
            expect(wt.temporary).toBe(false);
        });

        it('should create a temporary worktree repository', () => {
            const wtPath = rootMainRepository.getTempWorktreePath('my-feature', TemporaryFolderType.FEATURE_INIT);
            const wt = new WorktreeRepository(forgeContext, { name: 'repo1', path: wtPath, main: false }, rootMainRepository, true);
            expect(wt.temporary).toBe(true);
        });

        it('should resolve relative paths to absolute paths', () => {
            const relativePath = '../repo1-wt';
            const wt = new WorktreeRepository(
                forgeContext,
                { name: 'repo1', path: relativePath, main: false },
                rootMainRepository,
                false,
            );
            expect(path.isAbsolute(wt.path)).toBe(true);
        });
    });

    describe('remove()', () => {
        it('should call rootRepository.removeWorktree with itself', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const removeWorktreeSpy = vi.spyOn(rootMainRepository, 'removeWorktree');

            await worktreeMainRepository.remove();

            expect(removeWorktreeSpy).toHaveBeenCalledWith(worktreeMainRepository);
        });

        it('should handle removal errors gracefully', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Removal failed'));

            const removeWorktreeSpy = vi.spyOn(rootMainRepository, 'removeWorktree');

            await expect(worktreeMainRepository.remove()).rejects.toThrow('Removal failed');
            expect(removeWorktreeSpy).toHaveBeenCalled();
        });
    });

    describe('setActiveFeature()', () => {
        it('should set active feature symlink for main repository', async () => {
            const mainWtRepository = new WorktreeRepository(
                forgeContext,
                { name: rootMainRepository.name, path: rootMainRepository.getWorktreePath('test-feature'), main: true },
                rootMainRepository,
                false,
            );

            const featureContext = {
                slug: 'test-feature',
                mainRepo: rootMainRepository,
            } as any;

            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(symlink).mockResolvedValue(undefined);

            await mainWtRepository.setActiveFeature(featureContext);

            const featurePath = mainWtRepository.getFeaturePath('test-feature');
            const mainActivePath = mainWtRepository.activeFeaturePath;
            const expectedRelativePath = path.relative(path.dirname(mainActivePath), featurePath);

            expect(rm).toHaveBeenCalledWith(mainActivePath, { force: true });
            expect(symlink).toHaveBeenCalledWith(expectedRelativePath, mainActivePath);
        });

        it('should remove existing symlink before creating new one', async () => {
            const featureContext = {
                slug: 'test-feature',
                mainRepo: rootMainRepository,
            } as any;

            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(symlink).mockResolvedValue(undefined);

            await worktreeMainRepository.setActiveFeature(featureContext);

            expect(rm).toHaveBeenCalled();
            expect(symlink).toHaveBeenCalled();
            // Verify rm is called before symlink
            const rmCallIndex = vi.mocked(rm).mock.invocationCallOrder[0];
            const symlinkCallIndex = vi.mocked(symlink).mock.invocationCallOrder[0];
            expect(rmCallIndex).toBeLessThan(symlinkCallIndex);
        });

        it('should symlink secondary repository active feature to main repository active feature', async () => {
            const featureContext = {
                slug: 'test-feature',
                mainRepo: worktreeMainRepository,
            } as any;

            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(symlink).mockResolvedValue(undefined);

            await worktreeSecondaryRepository.setActiveFeature(featureContext);

            console.log({
                mainPath: worktreeMainRepository.path,
                secondaryPath: worktreeSecondaryRepository.path,
                mainActivePath: worktreeMainRepository.activeFeaturePath,
                secondaryActivePath: worktreeSecondaryRepository.activeFeaturePath,
            });

            const mainActivePath = worktreeMainRepository.activeFeaturePath;
            const secondaryActivePath = worktreeSecondaryRepository.activeFeaturePath;
            const expectedRelativePath = path.relative(path.dirname(secondaryActivePath), mainActivePath);

            expect(rm).toHaveBeenCalledWith(secondaryActivePath, { force: true });
            expect(symlink).toHaveBeenCalledWith(expectedRelativePath, secondaryActivePath);
        });
    });

    describe('rebase()', () => {
        it('should rebase feature branch onto base branch', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(result.repo).toBe(worktreeMainRepository.name);
            expect(result.success).toBe(true);
            expect(result.hasConflicts).toBe(false);
            expect(gitLib.runGit).toHaveBeenCalledWith(worktreeMainRepository.path, ['rebase', 'main']);
        });

        it('should checkout feature branch if not already on it', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(gitLib.checkoutBranch).toHaveBeenCalledWith(worktreeMainRepository.path, 'feature/test-feature');
            expect(result.success).toBe(true);
        });

        it('should skip checkout if already on feature branch', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(gitLib.checkoutBranch).not.toHaveBeenCalled();
        });

        it('should return error if worktree is dirty', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(false);
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });

        it('should detect rebase conflicts', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Rebase conflict'));

            // Mock getGitStatus to return conflict markers for the conflict check
            let getGitStatusCallCount = 0;
            vi.mocked(gitLib.getGitStatusPorcelain).mockImplementation(async () => {
                getGitStatusCallCount++;
                // First call: clean status before rebase
                // Second call: conflict status after rebase fails
                return getGitStatusCallCount === 1 ? '' : 'UU file.ts\n';
            });

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(true);
        });

        it('should return error on rebase failure without conflicts', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Rebase failed'));

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(false);
        });

        it('should handle different conflict markers (AA, DD)', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Rebase conflict'));

            let getGitStatusCallCount = 0;
            vi.mocked(gitLib.getGitStatusPorcelain).mockImplementation(async () => {
                getGitStatusCallCount++;
                return getGitStatusCallCount === 1 ? '' : 'AA file1.ts\nDD file2.ts\n';
            });

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(result.hasConflicts).toBe(true);
        });

        it('should include repo name in result', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const result = await worktreeMainRepository.rebase('feature/test-feature', 'main');

            expect(result.repo).toBe(worktreeMainRepository.name);
        });
    });
});
