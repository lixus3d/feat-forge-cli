import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBranch, getAheadBehind, getUpstreamBranch, gitBranchExists, gitRemoteBranchRef, hasRemote } from '@/lib/git';

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

    describe('getUpstreamBranch()', () => {
        it('should return the upstream ref', async () => {
            vi.mocked(execa).mockResolvedValueOnce({ stdout: 'origin/feature/test\n' } as any);

            expect(await getUpstreamBranch('/repo')).toBe('origin/feature/test');
            expect(execa).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: '/repo' });
        });

        it('should return null when no upstream is configured', async () => {
            vi.mocked(execa).mockRejectedValueOnce(new Error('no upstream'));

            expect(await getUpstreamBranch('/repo')).toBeNull();
        });
    });

    describe('getAheadBehind()', () => {
        it('should parse ahead and behind counts', async () => {
            vi.mocked(execa).mockResolvedValueOnce({ stdout: '3\t1' } as any);

            expect(await getAheadBehind('/repo')).toEqual({ ahead: 3, behind: 1 });
            expect(execa).toHaveBeenCalledWith('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { cwd: '/repo' });
        });
    });

    describe('hasRemote()', () => {
        it('should detect a configured remote', async () => {
            vi.mocked(execa).mockResolvedValueOnce({ stdout: 'origin\nupstream' } as any);

            expect(await hasRemote('/repo', 'origin')).toBe(true);
        });

        it('should return false for a missing remote', async () => {
            vi.mocked(execa).mockResolvedValueOnce({ stdout: 'upstream' } as any);

            expect(await hasRemote('/repo', 'origin')).toBe(false);
        });
    });
});
