import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchCommands } from '@/commands/BranchCommands';
import { BranchContext } from '@/foundation/BranchContext';
import { ForgeContext } from '@/foundation/ForgeContext';
import { WorktreeRepository } from '@/foundation/Repository';
import * as fsLib from '@/lib/fs';
import * as gitLib from '@/lib/git';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';

vi.mock('@/lib/fs');
vi.mock('@/lib/git');

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
});
