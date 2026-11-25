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
import { BranchContext } from '@/foundation/BranchContext';

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
            const wtPath = rootMainRepository.getTempWorktreePath('my-feature', TemporaryFolderType.BRANCH_INIT);
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
            const branchContext = new BranchContext(forgeContext, 'test-feature', '', [worktreeMainRepository], true);

            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(symlink).mockResolvedValue(undefined);

            await worktreeMainRepository.setActiveSpec(branchContext);

            const featurePath = worktreeMainRepository.getSpecPath('test-feature');
            const mainActivePath = worktreeMainRepository.activeSpecPath;
            const expectedRelativePath = path.relative(path.dirname(mainActivePath), featurePath);

            expect(rm).toHaveBeenCalledWith(mainActivePath, { force: true });
            expect(symlink).toHaveBeenCalledWith(expectedRelativePath, mainActivePath);
        });

        it('should remove existing symlink before creating new one', async () => {
            const branchContext = new BranchContext(forgeContext, 'test-feature', '', [worktreeMainRepository], true);

            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(symlink).mockResolvedValue(undefined);

            await worktreeMainRepository.setActiveSpec(branchContext);

            expect(rm).toHaveBeenCalled();
            expect(symlink).toHaveBeenCalled();
            // Verify rm is called before symlink
            const rmCallIndex = vi.mocked(rm).mock.invocationCallOrder[0];
            const symlinkCallIndex = vi.mocked(symlink).mock.invocationCallOrder[0];
            expect(rmCallIndex).toBeLessThan(symlinkCallIndex);
        });

        it('should symlink secondary repository active feature to main repository active feature', async () => {
            const branchContext = new BranchContext(
                forgeContext,
                'test-feature',
                '',
                [worktreeMainRepository, worktreeSecondaryRepository],
                true,
            );

            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(symlink).mockResolvedValue(undefined);

            await worktreeSecondaryRepository.setActiveSpec(branchContext);

            const mainActivePath = worktreeMainRepository.activeSpecPath;
            const secondaryActivePath = worktreeSecondaryRepository.activeSpecPath;
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

    describe('pull()', () => {
        it('should pull feature branch', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const result = await worktreeMainRepository.pull('feature/test-feature');

            expect(result.repo).toBe(worktreeMainRepository.name);
            expect(result.success).toBe(true);
            expect(result.hasConflicts).toBe(false);
            expect(gitLib.runGit).toHaveBeenCalledWith(worktreeMainRepository.path, ['pull']);
        });

        it('should checkout feature branch if not already on it before pulling', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');
            vi.mocked(gitLib.checkoutBranch).mockResolvedValue(undefined);
            vi.mocked(gitLib.runGit).mockResolvedValue({ stdout: '', stderr: '' } as any);

            const result = await worktreeMainRepository.pull('feature/test-feature');

            expect(gitLib.checkoutBranch).toHaveBeenCalledWith(worktreeMainRepository.path, 'feature/test-feature');
            expect(result.success).toBe(true);
        });

        it('should return error if worktree is dirty', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('M file.ts\n');

            const result = await worktreeMainRepository.pull('feature/test-feature');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(false);
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });

        it('should detect pull conflicts', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('feature/test-feature');
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('Pull conflict'));

            let getGitStatusCallCount = 0;
            vi.mocked(gitLib.getGitStatusPorcelain).mockImplementation(async () => {
                getGitStatusCallCount++;
                return getGitStatusCallCount === 1 ? '' : 'UU file.ts\n';
            });

            const result = await worktreeMainRepository.pull('feature/test-feature');

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(true);
        });
    });

    describe('push()', () => {
        const branch = 'feature/test-feature';

        it('should push when upstream exists and branch is ahead', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(`origin/${branch}`);
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 2, behind: 0 });
            vi.mocked(gitLib.runGit).mockResolvedValue(undefined);

            const result = await worktreeMainRepository.push(branch);

            expect(gitLib.runGit).toHaveBeenCalledWith(worktreeMainRepository.path, ['push']);
            expect(result).toEqual({ repo: worktreeMainRepository.name, success: true, hasConflicts: false, note: undefined });
        });

        it('should not require a clean worktree', async () => {
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue(' M file.ts');
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(`origin/${branch}`);
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 1, behind: 0 });
            vi.mocked(gitLib.runGit).mockResolvedValue(undefined);

            const result = await worktreeMainRepository.push(branch);

            expect(result.success).toBe(true);
            expect(gitLib.runGit).toHaveBeenCalledWith(worktreeMainRepository.path, ['push']);
        });

        it('should create the upstream with -u origin on first push', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(null);
            vi.mocked(gitLib.hasRemote).mockResolvedValue(true);
            vi.mocked(gitLib.runGit).mockResolvedValue(undefined);

            const result = await worktreeMainRepository.push(branch);

            expect(gitLib.hasRemote).toHaveBeenCalledWith(worktreeMainRepository.path, 'origin');
            expect(gitLib.runGit).toHaveBeenCalledWith(worktreeMainRepository.path, ['push', '-u', 'origin', branch]);
            expect(result.success).toBe(true);
            expect(result.note).toBe('remote branch created');
        });

        it('should fail when there is no upstream and no origin remote', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(null);
            vi.mocked(gitLib.hasRemote).mockResolvedValue(false);

            const result = await worktreeMainRepository.push(branch);

            expect(result.success).toBe(false);
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });

        it('should report up to date without pushing when nothing is ahead', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(`origin/${branch}`);
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 0, behind: 3 });

            const result = await worktreeMainRepository.push(branch);

            expect(gitLib.runGit).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.note).toBe('up to date');
        });

        it('should fail without checkout when the worktree is on another branch', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue('main');

            const result = await worktreeMainRepository.push(branch);

            expect(result.success).toBe(false);
            expect(result.note).toBe('wrong branch');
            expect(gitLib.checkoutBranch).not.toHaveBeenCalled();
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });

        it('should use --force-with-lease when force is requested', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(`origin/${branch}`);
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 2, behind: 2 });
            vi.mocked(gitLib.runGit).mockResolvedValue(undefined);

            const result = await worktreeMainRepository.push(branch, { force: true });

            expect(gitLib.runGit).toHaveBeenCalledWith(worktreeMainRepository.path, ['push', '--force-with-lease']);
            expect(gitLib.runGit).not.toHaveBeenCalledWith(worktreeMainRepository.path, expect.arrayContaining(['--force']));
            expect(result.success).toBe(true);
        });

        it('should return a failure when git push is rejected', async () => {
            vi.mocked(gitLib.getCurrentBranch).mockResolvedValue(branch);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue(`origin/${branch}`);
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 1, behind: 1 });
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('rejected (non-fast-forward)'));
            vi.spyOn(console, 'error').mockImplementation(() => undefined);

            const result = await worktreeMainRepository.push(branch);

            expect(result.success).toBe(false);
            expect(result.hasConflicts).toBe(false);
        });
    });
});
