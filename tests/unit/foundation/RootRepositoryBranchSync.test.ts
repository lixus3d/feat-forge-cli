import { RootRepository } from '@/foundation/Repository';
import * as fsLib from '@/lib/fs';
import * as gitLib from '@/lib/git';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';

vi.mock('@/lib/git');
vi.mock('@/lib/fs');

describe('RootRepository branch sync without workspace', () => {
    let repo: RootRepository;

    beforeEach(() => {
        vi.resetAllMocks();
        const { forgeContext } = ContextHelper.default().extract();
        repo = new RepositoryHelpers(forgeContext).getRootRepository({ main: true });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.mocked(gitLib.gitBranchExists).mockResolvedValue(true);
        vi.mocked(gitLib.runGit).mockResolvedValue(undefined);
    });

    describe('pushBranch()', () => {
        it('should push the branch by name to its upstream, without checkout', async () => {
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue({ remote: 'origin', mergeRef: 'refs/heads/main' });
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 2, behind: 0 });

            const result = await repo.pushBranch('main');

            expect(gitLib.getAheadBehind).toHaveBeenCalledWith(repo.path, 'main');
            expect(gitLib.runGit).toHaveBeenCalledWith(repo.path, ['push', 'origin', 'refs/heads/main:refs/heads/main']);
            expect(gitLib.checkoutBranch).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use --force-with-lease when forced', async () => {
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue({ remote: 'origin', mergeRef: 'refs/heads/main' });
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 1, behind: 1 });

            await repo.pushBranch('main', { force: true });

            expect(gitLib.runGit).toHaveBeenCalledWith(repo.path, [
                'push',
                '--force-with-lease',
                'origin',
                'refs/heads/main:refs/heads/main',
            ]);
        });

        it('should report up to date without pushing', async () => {
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue({ remote: 'origin', mergeRef: 'refs/heads/main' });
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 0, behind: 4 });

            const result = await repo.pushBranch('main');

            expect(gitLib.runGit).not.toHaveBeenCalled();
            expect(result.note).toBe('up to date');
        });

        it('should create the upstream on first push', async () => {
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue(null);
            vi.mocked(gitLib.hasRemote).mockResolvedValue(true);

            const result = await repo.pushBranch('dev');

            expect(gitLib.runGit).toHaveBeenCalledWith(repo.path, ['push', '-u', 'origin', 'dev']);
            expect(result.note).toBe('remote branch created');
        });

        it('should fail when there is no upstream and no origin remote', async () => {
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue(null);
            vi.mocked(gitLib.hasRemote).mockResolvedValue(false);

            const result = await repo.pushBranch('dev');

            expect(gitLib.runGit).not.toHaveBeenCalled();
            expect(result).toMatchObject({ success: false, note: 'no origin remote' });
        });

        it('should return a failure when git push is rejected', async () => {
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue({ remote: 'origin', mergeRef: 'refs/heads/main' });
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 1, behind: 1 });
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('rejected (non-fast-forward)'));

            const result = await repo.pushBranch('main');

            expect(result).toMatchObject({ success: false, hasConflicts: false });
        });

        it('should skip repositories without the local branch', async () => {
            vi.mocked(gitLib.gitBranchExists).mockResolvedValue(false);

            const result = await repo.pushBranch('dev');

            expect(gitLib.runGit).not.toHaveBeenCalled();
            expect(result).toMatchObject({ success: true, note: 'no local branch, skipped' });
        });
    });

    describe('pullBranch()', () => {
        it('should git pull where the branch is checked out (root repository)', async () => {
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(repo.path);
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const result = await repo.pullBranch('main');

            expect(gitLib.runGit).toHaveBeenCalledWith(repo.path, ['pull']);
            expect(gitLib.checkoutBranch).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should refuse to pull in a dirty checkout', async () => {
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(repo.path);
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue(' M a.ts');

            const result = await repo.pullBranch('main');

            expect(gitLib.runGit).not.toHaveBeenCalled();
            expect(result).toMatchObject({ success: false, note: 'dirty' });
        });

        it('should detect pull conflicts', async () => {
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(repo.path);
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValueOnce('').mockResolvedValueOnce('UU a.ts');
            vi.mocked(gitLib.runGit).mockRejectedValue(new Error('conflict'));

            const result = await repo.pullBranch('main');

            expect(result).toMatchObject({ success: false, hasConflicts: true });
        });

        it('should fetch and fast-forward the ref when the branch is checked out nowhere', async () => {
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(null);
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue({ remote: 'origin', mergeRef: 'refs/heads/main' });
            vi.mocked(gitLib.fastForwardBranchRef).mockResolvedValue('updated');

            const result = await repo.pullBranch('main');

            expect(gitLib.runGit).toHaveBeenCalledWith(repo.path, ['fetch', 'origin']);
            expect(gitLib.fastForwardBranchRef).toHaveBeenCalledWith(repo.path, 'main');
            expect(result).toMatchObject({ success: true, note: 'fast-forwarded' });
        });

        it('should fail when the not checked out branch has diverged', async () => {
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(null);
            vi.mocked(gitLib.getBranchUpstreamConfig).mockResolvedValue({ remote: 'origin', mergeRef: 'refs/heads/main' });
            vi.mocked(gitLib.fastForwardBranchRef).mockResolvedValue('diverged');

            const result = await repo.pullBranch('main');

            expect(result).toMatchObject({ success: false, note: 'diverged' });
        });
    });

    describe('fastForwardProtectedBranches()', () => {
        it('should fast-forward refs not checked out, and clean checkouts with --ff-only', async () => {
            vi.mocked(gitLib.gitBranchExists).mockImplementation(async (_path, branch) => branch === 'main' || branch === 'dev');
            vi.mocked(gitLib.getBranchCheckoutPath).mockImplementation(async (_path, branch) =>
                branch === 'main' ? repo.path : null,
            );
            vi.mocked(gitLib.fastForwardBranchRef).mockResolvedValue('updated');
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue('origin/main');
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 0, behind: 3 });
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue('');

            const results = await repo.fastForwardProtectedBranches();

            expect(results).toEqual([
                { branch: 'main', status: 'updated' },
                { branch: 'dev', status: 'updated' },
            ]);
            expect(gitLib.runGit).toHaveBeenCalledWith(repo.path, ['merge', '--ff-only', '--quiet', 'main@{u}']);
            expect(gitLib.fastForwardBranchRef).toHaveBeenCalledWith(repo.path, 'dev');
            expect(gitLib.fastForwardBranchRef).not.toHaveBeenCalledWith(repo.path, 'main');
        });

        it('should not touch a dirty or diverged checkout', async () => {
            vi.mocked(gitLib.gitBranchExists).mockImplementation(async (_path, branch) => branch === 'main');
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(repo.path);
            vi.mocked(gitLib.getUpstreamBranch).mockResolvedValue('origin/main');
            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 0, behind: 1 });
            vi.mocked(gitLib.getGitStatusPorcelain).mockResolvedValue(' M a.ts');

            expect(await repo.fastForwardProtectedBranches()).toEqual([{ branch: 'main', status: 'dirty' }]);

            vi.mocked(gitLib.getAheadBehind).mockResolvedValue({ ahead: 1, behind: 1 });
            expect(await repo.fastForwardProtectedBranches()).toEqual([{ branch: 'main', status: 'diverged' }]);
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });
    });

    describe('addWorktree()', () => {
        it('should explain how to proceed when the branch is already checked out elsewhere', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            vi.mocked(gitLib.getBranchCheckoutPath).mockResolvedValue(repo.path);

            await expect(repo.addWorktree('main')).rejects.toThrow(/already checked out.*forge pull main/s);
            expect(gitLib.runGit).not.toHaveBeenCalled();
        });
    });
});
