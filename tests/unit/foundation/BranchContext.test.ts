import { BranchContext } from '@/foundation/BranchContext';
import { ForgeContext } from '@/foundation/ForgeContext';
import { RootRepository, WorktreeRepository } from '@/foundation/Repository';
import { ForgeMode } from '@/foundation/types/ForgeMode';
import { ContextHelper } from 'tests/helpers/ContextHelper';
import { RepositoryHelpers } from 'tests/helpers/RepositoryHelpers';

import * as fsLib from '@/lib/fs';
import { ForgeExpectMainRepositoryError } from '@/foundation/errors';
import path from 'path';

// Mock git and fs operations
// vi.mock('@/lib/git');
vi.mock('@/lib/fs');
// vi.mock('@/lib/prompt');

describe('BranchContext', () => {
    let branchContext: BranchContext;
    let forgeContext: ForgeContext;
    let repositoryHelpers: RepositoryHelpers;
    let rootMainRepository: RootRepository;
    let rootSecondaryRepository: RootRepository;
    let worktreeMainRepository: WorktreeRepository;
    let worktreeSecondaryRepository: WorktreeRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ forgeContext } = ContextHelper.default().extract());
        repositoryHelpers = new RepositoryHelpers(forgeContext);
        rootMainRepository = repositoryHelpers.getRootRepository({ main: true });
        rootSecondaryRepository = repositoryHelpers.getRootRepository({ main: false });
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
        branchContext = new BranchContext(
            forgeContext,
            'test/branch',
            '/test/branch/path',
            [worktreeMainRepository, worktreeSecondaryRepository],
            true,
        );
    });

    describe('constructor', () => {
        it('should initialize properties correctly', () => {
            expect(branchContext.branchName).toBe('test/branch');
            expect(branchContext.path).toBe('/test/branch/path');
            expect(branchContext.repositories).toEqual([worktreeMainRepository, worktreeSecondaryRepository]);
            expect(branchContext.active).toBe(true);
        });
    });

    describe('modeFilePath', () => {
        it('should return modeFilePath for main repository', () => {
            const expectedPath = path.join(branchContext.path, forgeContext.options.files.forgeMode);
            expect(branchContext.modeFilePath).toBe(expectedPath);
        });
    });

    describe('setMode()', () => {
        it('should set mode to file', async () => {
            await branchContext.setMode(ForgeMode.CODE);
            expect(fsLib.writeTextFile).toHaveBeenCalledWith(branchContext.modeFilePath, 'code\n');
        });
    });

    describe('hasModeFile()', () => {
        it('should check if mode file exists', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const exists = await branchContext.hasModeFile();
            expect(exists).toBe(true);
        });
    });

    describe('getMode()', () => {
        it('should get mode from file (SPEC)', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue('spec\n');

            const mode = await branchContext.getMode();
            expect(mode).toBe(ForgeMode.SPEC);
            expect(fsLib.pathExists).toHaveBeenCalledWith(branchContext.modeFilePath);
        });

        it('should get mode from file (CODE)', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue('code\n');

            const mode = await branchContext.getMode();
            expect(mode).toBe(ForgeMode.CODE);
            expect(fsLib.pathExists).toHaveBeenCalledWith(branchContext.modeFilePath);
        });

        it('should throw if mode file does not exist', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(false);
            await expect(branchContext.getMode()).rejects.toThrow('Mode file not found');
        });

        it('should throw if mode file contains invalid content', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue('invalid-mode\n');
            await expect(branchContext.getMode()).rejects.toThrow();
        });
    });
});
