import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchCommands } from '@/commands/BranchCommands';
import { BranchContext } from '@/foundation/BranchContext';
import { ForgeContext } from '@/foundation/ForgeContext';
import { WorktreeRepository } from '@/foundation/Repository';
import * as fsLib from '@/lib/fs';
import * as gitLib from '@/lib/git';
import { promptChoice, promptConfirm } from '@/lib/prompt';
import { ForgeNotInActiveBranchError } from '@/foundation/errors';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';

vi.mock('@/lib/fs');
vi.mock('@/lib/git');
vi.mock('@/lib/prompt');

describe('BranchCommands pull', () => {
    let forgeContext: ForgeContext;
    let repositoryHelpers: RepositoryHelpers;
    let rootMainRepository: ReturnType<RepositoryHelpers['getRootRepository']>;
    let rootSecondaryRepository: ReturnType<RepositoryHelpers['getRootRepository']>;
    let worktreeMainRepository: WorktreeRepository;
    let worktreeSecondaryRepository: WorktreeRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ forgeContext } = ContextHelper.default().extract());
        repositoryHelpers = new RepositoryHelpers(forgeContext);
        rootMainRepository = repositoryHelpers.getRootRepository({ main: true });
        rootSecondaryRepository = repositoryHelpers.getRootRepository({ name: 'repo2', main: false });
        worktreeMainRepository = new WorktreeRepository(
            forgeContext,
            { name: rootMainRepository.name, path: rootMainRepository.getWorktreePath('feature/test'), main: rootMainRepository.main },
            rootMainRepository,
            false,
        );
        worktreeSecondaryRepository = new WorktreeRepository(
            forgeContext,
            {
                name: rootSecondaryRepository.name,
                path: rootSecondaryRepository.getWorktreePath('feature/test'),
                main: rootSecondaryRepository.main,
            },
            rootSecondaryRepository,
            false,
        );
    });

    it('should pull all repos in the active branch and initialize missing repos', async () => {
        const branchContext = new BranchContext(
            forgeContext,
            'feature/test',
            forgeContext.paths.getBranchRootPath('feature/test'),
            [worktreeMainRepository, worktreeSecondaryRepository],
            true,
        );
        const handlers = new BranchCommands(forgeContext);

        vi.spyOn(forgeContext, 'isBranchActive').mockResolvedValue(true);
        vi.spyOn(forgeContext, 'loadBranchContext').mockResolvedValue(branchContext);
        vi.spyOn(branchContext, 'getDirtyRepositories').mockResolvedValue([]);
        vi.spyOn(worktreeMainRepository, 'pull').mockResolvedValue({
            repo: worktreeMainRepository.name,
            success: true,
            hasConflicts: false,
        });
        vi.spyOn(worktreeSecondaryRepository, 'pull').mockResolvedValue({
            repo: worktreeSecondaryRepository.name,
            success: true,
            hasConflicts: false,
        });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await handlers.pull('feature/test');

        expect(worktreeMainRepository.pull).toHaveBeenCalledWith('feature/test');
        expect(worktreeSecondaryRepository.pull).toHaveBeenCalledWith('feature/test');
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Pulling branch: feature/test'));
        logSpy.mockRestore();
    });

    it('should pull the nearest branch when no slug is given', async () => {
        const branchContext = new BranchContext(
            forgeContext,
            'feature/test',
            forgeContext.paths.getBranchRootPath('feature/test'),
            [worktreeMainRepository],
            true,
        );
        const handlers = new BranchCommands(forgeContext);

        forgeContext.repositories.splice(1);
        vi.spyOn(BranchContext, 'findNearestBranchContext').mockResolvedValue(branchContext);
        vi.spyOn(forgeContext, 'isBranchActive').mockResolvedValue(true);
        vi.spyOn(forgeContext, 'loadBranchContext').mockResolvedValue(branchContext);
        vi.spyOn(branchContext, 'getDirtyRepositories').mockResolvedValue([]);
        vi.spyOn(worktreeMainRepository, 'pull').mockResolvedValue({
            repo: worktreeMainRepository.name,
            success: true,
            hasConflicts: false,
        });
        vi.spyOn(worktreeMainRepository, 'setActiveSpec').mockResolvedValue(undefined);
        vi.mocked(fsLib.ensureDir).mockResolvedValue(undefined);

        await handlers.pull();

        expect(BranchContext.findNearestBranchContext).toHaveBeenCalledWith(forgeContext);
        expect(worktreeMainRepository.pull).toHaveBeenCalledWith('feature/test');
    });

    it('should prompt among active branches when run from the project root', async () => {
        const branchContext = new BranchContext(
            forgeContext,
            'feature/test',
            forgeContext.paths.getBranchRootPath('feature/test'),
            [worktreeMainRepository],
            true,
        );
        const handlers = new BranchCommands(forgeContext);

        vi.spyOn(BranchContext, 'findNearestBranchContext').mockRejectedValue(new ForgeNotInActiveBranchError());
        vi.spyOn(forgeContext, 'loadActiveBranchesContexts').mockResolvedValue([branchContext]);
        vi.mocked(promptChoice).mockResolvedValue('feature/test');
        vi.spyOn(forgeContext, 'isBranchActive').mockResolvedValue(true);
        vi.spyOn(forgeContext, 'loadBranchContext').mockResolvedValue(branchContext);
        vi.spyOn(branchContext, 'getDirtyRepositories').mockResolvedValue([]);
        vi.spyOn(worktreeMainRepository, 'pull').mockResolvedValue({
            repo: worktreeMainRepository.name,
            success: true,
            hasConflicts: false,
        });

        await handlers.pull();

        expect(promptChoice).toHaveBeenCalledWith(expect.any(String), [{ name: 'feature/test', value: 'feature/test' }]);
        expect(worktreeMainRepository.pull).toHaveBeenCalledWith('feature/test');
    });

    it('should exit gracefully when run from the project root without active branch', async () => {
        const handlers = new BranchCommands(forgeContext);
        vi.spyOn(BranchContext, 'findNearestBranchContext').mockRejectedValue(new ForgeNotInActiveBranchError());
        vi.spyOn(forgeContext, 'loadActiveBranchesContexts').mockResolvedValue([]);
        const pullSpy = vi.spyOn(worktreeMainRepository, 'pull');
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await handlers.pull();

        expect(promptChoice).not.toHaveBeenCalled();
        expect(pullSpy).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No active branch found'));
        logSpy.mockRestore();
    });
});

describe('BranchCommands push', () => {
    let forgeContext: ForgeContext;
    let worktreeMainRepository: WorktreeRepository;
    let worktreeSecondaryRepository: WorktreeRepository;
    let branchContext: BranchContext;
    let handlers: BranchCommands;
    const ok = (repo: WorktreeRepository) => ({ repo: repo.name, success: true, hasConflicts: false });

    beforeEach(() => {
        vi.clearAllMocks();
        process.exitCode = undefined;
        ({ forgeContext } = ContextHelper.default().extract());
        const repositoryHelpers = new RepositoryHelpers(forgeContext);
        const rootMain = repositoryHelpers.getRootRepository({ main: true });
        const rootSecondary = repositoryHelpers.getRootRepository({ name: 'repo2', main: false });
        worktreeMainRepository = new WorktreeRepository(
            forgeContext,
            { name: rootMain.name, path: rootMain.getWorktreePath('feature/test'), main: rootMain.main },
            rootMain,
            false,
        );
        worktreeSecondaryRepository = new WorktreeRepository(
            forgeContext,
            { name: rootSecondary.name, path: rootSecondary.getWorktreePath('feature/test'), main: rootSecondary.main },
            rootSecondary,
            false,
        );
        branchContext = new BranchContext(
            forgeContext,
            'feature/test',
            forgeContext.paths.getBranchRootPath('feature/test'),
            [worktreeMainRepository, worktreeSecondaryRepository],
            true,
        );
        handlers = new BranchCommands(forgeContext);

        vi.spyOn(forgeContext, 'isBranchActive').mockResolvedValue(true);
        vi.spyOn(forgeContext, 'loadBranchContext').mockResolvedValue(branchContext);
        vi.spyOn(branchContext, 'getDirtyRepositories').mockResolvedValue([]);
        vi.spyOn(worktreeMainRepository, 'push').mockResolvedValue(ok(worktreeMainRepository));
        vi.spyOn(worktreeSecondaryRepository, 'push').mockResolvedValue(ok(worktreeSecondaryRepository));
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('should push all repos of the given branch without confirmation when clean', async () => {
        await handlers.push('feature/test');

        expect(worktreeMainRepository.push).toHaveBeenCalledWith('feature/test', { force: false });
        expect(worktreeSecondaryRepository.push).toHaveBeenCalledWith('feature/test', { force: false });
        expect(promptConfirm).not.toHaveBeenCalled();
        expect(gitLib.displayOperationSummary).toHaveBeenCalledWith(expect.any(Array), gitLib.GitOperation.Push);
        expect(process.exitCode).toBeUndefined();
    });

    it('should detect the branch from the current workspace', async () => {
        vi.spyOn(BranchContext, 'findNearestBranchContext').mockResolvedValue(branchContext);

        await handlers.push();

        expect(promptChoice).not.toHaveBeenCalled();
        expect(worktreeMainRepository.push).toHaveBeenCalledWith('feature/test', { force: false });
    });

    it('should prompt among active branches when run from the project root', async () => {
        vi.spyOn(BranchContext, 'findNearestBranchContext').mockRejectedValue(new ForgeNotInActiveBranchError());
        vi.spyOn(forgeContext, 'loadActiveBranchesContexts').mockResolvedValue([branchContext]);
        vi.mocked(promptChoice).mockResolvedValue('feature/test');

        await handlers.push();

        expect(promptChoice).toHaveBeenCalledWith(expect.any(String), [{ name: 'feature/test', value: 'feature/test' }]);
        expect(worktreeSecondaryRepository.push).toHaveBeenCalledWith('feature/test', { force: false });
    });

    it('should do nothing when run from the project root without active branch', async () => {
        vi.spyOn(BranchContext, 'findNearestBranchContext').mockRejectedValue(new ForgeNotInActiveBranchError());
        vi.spyOn(forgeContext, 'loadActiveBranchesContexts').mockResolvedValue([]);

        await handlers.push();

        expect(worktreeMainRepository.push).not.toHaveBeenCalled();
    });

    it('should refuse to push a non active branch', async () => {
        vi.spyOn(forgeContext, 'isBranchActive').mockResolvedValue(false);

        await expect(handlers.push('feature/test')).rejects.toThrow(/not active/);
        expect(worktreeMainRepository.push).not.toHaveBeenCalled();
    });

    it('should abort when dirty repositories are not confirmed', async () => {
        vi.spyOn(branchContext, 'getDirtyRepositories').mockResolvedValue([worktreeSecondaryRepository]);
        vi.spyOn(worktreeSecondaryRepository, 'getGitStatus').mockResolvedValue(' M a.ts\n?? b.ts');
        vi.mocked(promptConfirm).mockResolvedValue(false);

        await handlers.push('feature/test');

        expect(promptConfirm).toHaveBeenCalledWith('Push anyway?', false);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('repo2: 1 modified, 1 untracked'));
        expect(worktreeMainRepository.push).not.toHaveBeenCalled();
        expect(worktreeSecondaryRepository.push).not.toHaveBeenCalled();
    });

    it('should push when dirty repositories are confirmed', async () => {
        vi.spyOn(branchContext, 'getDirtyRepositories').mockResolvedValue([worktreeSecondaryRepository]);
        vi.spyOn(worktreeSecondaryRepository, 'getGitStatus').mockResolvedValue(' M a.ts');
        vi.mocked(promptConfirm).mockResolvedValue(true);

        await handlers.push('feature/test');

        expect(promptConfirm).toHaveBeenCalledTimes(1);
        expect(worktreeMainRepository.push).toHaveBeenCalled();
        expect(worktreeSecondaryRepository.push).toHaveBeenCalled();
    });

    it('should ask confirmation before a force push', async () => {
        vi.mocked(promptConfirm).mockResolvedValue(true);

        await handlers.push('feature/test', { force: true });

        expect(promptConfirm).toHaveBeenCalledWith(expect.stringContaining('--force-with-lease'), false);
        expect(worktreeMainRepository.push).toHaveBeenCalledWith('feature/test', { force: true });
    });

    it('should not force push when confirmation is refused', async () => {
        vi.mocked(promptConfirm).mockResolvedValue(false);

        await handlers.push('feature/test', { force: true });

        expect(worktreeMainRepository.push).not.toHaveBeenCalled();
    });

    it('should continue with other repos and set exit code on failure', async () => {
        vi.spyOn(worktreeMainRepository, 'push').mockResolvedValue({
            repo: worktreeMainRepository.name,
            success: false,
            hasConflicts: false,
        });

        await handlers.push('feature/test');

        expect(worktreeSecondaryRepository.push).toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });
});
