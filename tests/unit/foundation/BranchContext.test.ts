import { BranchContext } from '@/foundation/BranchContext';
import { ForgeContext } from '@/foundation/ForgeContext';
import { RootRepository, WorktreeRepository } from '@/foundation/Repository';
import { ContextHelper } from 'tests/helpers/ContextHelper';
import { RepositoryHelpers } from 'tests/helpers/RepositoryHelpers';

import * as fsLib from '@/lib/fs';
import path from 'path';
import { DEFAULT_MODES } from '@/foundation/ForgeConfig';

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

    let testModeConfig = DEFAULT_MODES[0]!;
    let testModeName = testModeConfig.name!;

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
            await branchContext.setMode(testModeName);
            expect(fsLib.writeTextFile).toHaveBeenCalledWith(branchContext.modeFilePath, `${testModeName}\n`);
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
        it('should get mode from file', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            vi.mocked(fsLib.readTextFile).mockResolvedValue(`${testModeName}\n`);

            const mode = await branchContext.getMode();
            expect(mode).toEqual({ ...testModeConfig, default: false });
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

    describe('copyWorkspaceRootFiles()', () => {
        it('should copy configured workspace root files into the branch root', async () => {
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const sourcePath = path.join(forgeContext.paths.featForgeConfigRoot, 'workspace-root-files');

            await branchContext.copyWorkspaceRootFiles();

            expect(fsLib.pathExists).toHaveBeenCalledWith(sourcePath);
            expect(fsLib.copyDirectoryContentsRecursively).toHaveBeenCalledWith(sourcePath, branchContext.path, {
                dryRun: false,
                allowSymlinks: false,
            });
        });

        it('should skip copy when the feature is disabled', async () => {
            ({ forgeContext } = ContextHelper.default({
                options: {
                    folders: {
                        workspaceRootFiles: false,
                    },
                },
            }).extract());
            branchContext = new BranchContext(forgeContext, 'test/branch', '/test/branch/path', [], false);

            await branchContext.copyWorkspaceRootFiles();

            expect(fsLib.pathExists).not.toHaveBeenCalled();
            expect(fsLib.copyDirectoryContentsRecursively).not.toHaveBeenCalled();
        });

        it('should pass through the symlink option when enabled', async () => {
            ({ forgeContext } = ContextHelper.default({
                options: {
                    workspace: {
                        rootFiles: {
                            allowSymlinks: true,
                        },
                    },
                },
            }).extract());
            branchContext = new BranchContext(forgeContext, 'test/branch', '/test/branch/path', [], false);
            vi.mocked(fsLib.pathExists).mockResolvedValue(true);
            const sourcePath = path.join(forgeContext.paths.featForgeConfigRoot, 'workspace-root-files');

            await branchContext.copyWorkspaceRootFiles();

            expect(fsLib.copyDirectoryContentsRecursively).toHaveBeenCalledWith(sourcePath, branchContext.path, {
                dryRun: false,
                allowSymlinks: true,
            });
        });
    });
});
