import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises', () => ({
    readdir: vi.fn(),
}));

vi.mock('@/lib/fs', () => ({
    pathExists: vi.fn(),
}));

vi.mock('@/lib/platform', () => ({
    getScriptExtension: vi.fn(),
}));

vi.mock('@/lib/bootstrap', () => ({
    executeScript: vi.fn(),
}));

import { readdir } from 'fs/promises';
import { executeScript } from '@/lib/bootstrap';
import { pathExists } from '@/lib/fs';
import { getScriptExtension } from '@/lib/platform';
import { discoverHooksForEvent, executeHooksForEvent, HookEvent } from '@/lib/hooks';

describe('hooks helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getScriptExtension).mockReturnValue('.sh');
    });

    describe('discoverHooksForEvent()', () => {
        it('should return an empty array when hooks directory does not exist', async () => {
            vi.mocked(pathExists).mockResolvedValue(false);

            const hooks = await discoverHooksForEvent('/repo', '.forge', HookEvent.POST_START);

            expect(hooks).toEqual([]);
            expect(readdir).not.toHaveBeenCalled();
        });

        it('should return matching hooks sorted alphabetically', async () => {
            vi.mocked(pathExists).mockResolvedValue(true);
            vi.mocked(readdir).mockResolvedValue([
                'postStart_02.sh',
                'preMerge.sh',
                'postStart.sh',
                'postStart_01.sh',
                'postStart.txt',
            ] as any);

            const hooks = await discoverHooksForEvent('/repo', '.forge', HookEvent.POST_START);

            expect(hooks).toEqual(['postStart', 'postStart_01', 'postStart_02']);
        });

        it('should return an empty array when directory listing fails', async () => {
            vi.mocked(pathExists).mockResolvedValue(true);
            vi.mocked(readdir).mockRejectedValue(new Error('boom'));

            const hooks = await discoverHooksForEvent('/repo', '.forge', HookEvent.POST_START);

            expect(hooks).toEqual([]);
        });
    });

    describe('executeHooksForEvent()', () => {
        it('should return an empty array when no hooks are found', async () => {
            vi.mocked(pathExists).mockResolvedValue(false);

            const executed = await executeHooksForEvent('/repo', '.forge', HookEvent.POST_START);

            expect(executed).toEqual([]);
            expect(executeScript).not.toHaveBeenCalled();
        });

        it('should execute hooks in alphabetical order and return their names', async () => {
            vi.mocked(pathExists).mockResolvedValue(true);
            vi.mocked(readdir).mockResolvedValue(['postStart_02.sh', 'postStart.sh', 'postStart_01.sh'] as any);
            vi.mocked(executeScript).mockResolvedValue(true);

            const executed = await executeHooksForEvent('/repo', '.forge', HookEvent.POST_START, { branch: 'feature/test' });

            expect(executed).toEqual(['postStart', 'postStart_01', 'postStart_02']);
            expect(executeScript).toHaveBeenNthCalledWith(
                1,
                '/repo/.forge/hooks/postStart.sh',
                '/repo',
                'hook: postStart',
                { branch: 'feature/test' },
                {},
            );
            expect(executeScript).toHaveBeenNthCalledWith(
                2,
                '/repo/.forge/hooks/postStart_01.sh',
                '/repo',
                'hook: postStart_01',
                { branch: 'feature/test' },
                {},
            );
            expect(executeScript).toHaveBeenNthCalledWith(
                3,
                '/repo/.forge/hooks/postStart_02.sh',
                '/repo',
                'hook: postStart_02',
                { branch: 'feature/test' },
                {},
            );
        });

        it('should throw a hook-specific error when execution fails', async () => {
            vi.mocked(pathExists).mockResolvedValue(true);
            vi.mocked(readdir).mockResolvedValue(['postStart.sh'] as any);
            vi.mocked(executeScript).mockRejectedValue(new Error('bad hook'));

            await expect(executeHooksForEvent('/repo', '.forge', HookEvent.POST_START)).rejects.toThrow(
                'Hook postStart failed in /repo',
            );
        });
    });
});
