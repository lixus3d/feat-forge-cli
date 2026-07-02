import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBranch, gitBranchExists, gitRemoteBranchRef } from '@/lib/git';

vi.mock('execa', () => ({
    execa: vi.fn(),
}));

describe('git helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('gitBranchExists()', () => {
        it('should check local branches only', async () => {
            vi.mocked(execa).mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

            const exists = await gitBranchExists('/repo', 'feature/test');

            expect(execa).toHaveBeenCalledWith('git', ['rev-parse', '--verify', 'refs/heads/feature/test'], { cwd: '/repo' });
            expect(exists).toBe(true);
        });

        it('should return false when the local branch is missing', async () => {
            vi.mocked(execa).mockRejectedValueOnce(new Error('missing'));

            const exists = await gitBranchExists('/repo', 'feature/test');

            expect(exists).toBe(false);
        });
    });

    describe('gitRemoteBranchRef()', () => {
        it('should fetch remotes and resolve a remote tracking ref', async () => {
            vi.mocked(execa)
                .mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
                .mockResolvedValueOnce({ stdout: 'origin/main\norigin/feature/test\norigin/HEAD', stderr: '' } as any);

            const ref = await gitRemoteBranchRef('/repo', 'feature/test');

            expect(execa).toHaveBeenNthCalledWith(1, 'git', ['fetch', '--all', '--prune', '--quiet'], {
                cwd: '/repo',
                stdio: 'inherit',
            });
            expect(execa).toHaveBeenNthCalledWith(2, 'git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], {
                cwd: '/repo',
            });
            expect(ref).toBe('origin/feature/test');
        });

        it('should return null when the remote branch does not exist', async () => {
            vi.mocked(execa)
                .mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
                .mockResolvedValueOnce({ stdout: 'origin/main\norigin/other', stderr: '' } as any);

            const ref = await gitRemoteBranchRef('/repo', 'feature/test');

            expect(ref).toBeNull();
        });
    });

    describe('createBranch()', () => {
        it('should use a remote tracking ref when the branch exists remotely', async () => {
            vi.mocked(execa)
                .mockRejectedValueOnce(new Error('missing'))
                .mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
                .mockResolvedValueOnce({ stdout: 'origin/feature/test', stderr: '' } as any)
                .mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

            await createBranch('/repo', 'feature/test', 'main');

            expect(execa).toHaveBeenNthCalledWith(4, 'git', ['branch', '--track', 'feature/test', 'origin/feature/test'], {
                cwd: '/repo',
                stdio: 'inherit',
            });
        });

        it('should fall back to the provided base branch when no remote branch exists', async () => {
            vi.mocked(execa)
                .mockRejectedValueOnce(new Error('missing'))
                .mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
                .mockResolvedValueOnce({ stdout: 'origin/main\norigin/other', stderr: '' } as any)
                .mockResolvedValueOnce({ stdout: '', stderr: '' } as any);

            await createBranch('/repo', 'feature/test', 'main');

            expect(execa).toHaveBeenNthCalledWith(4, 'git', ['branch', 'feature/test', 'main'], {
                cwd: '/repo',
                stdio: 'inherit',
            });
        });
    });
});
