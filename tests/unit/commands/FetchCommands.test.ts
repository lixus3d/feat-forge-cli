import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchCommands } from '@/commands/FetchCommands';
import * as gitLib from '@/lib/git';
import { ContextHelper } from '../../helpers/ContextHelper';

vi.mock('@/lib/git');

describe('FetchCommands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.exitCode = undefined;
    });

    it('should fetch all configured repositories', async () => {
        const { forgeContext } = ContextHelper.default().extract();
        const handlers = new FetchCommands(forgeContext);
        vi.mocked(gitLib.fetchAllRemotes).mockResolvedValue(undefined);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await handlers.fetch();

        expect(gitLib.fetchAllRemotes).toHaveBeenCalledTimes(2);
        expect(gitLib.fetchAllRemotes).toHaveBeenCalledWith(forgeContext.repositories[0].path);
        expect(gitLib.fetchAllRemotes).toHaveBeenCalledWith(forgeContext.repositories[1].path);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Fetching remotes for 2 configured repositories'));
        expect(process.exitCode).toBeUndefined();
        logSpy.mockRestore();
    });

    it('should keep going when one repository fetch fails', async () => {
        const { forgeContext } = ContextHelper.default().extract();
        const handlers = new FetchCommands(forgeContext);
        vi.mocked(gitLib.fetchAllRemotes).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fetch failed'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await handlers.fetch();

        expect(gitLib.fetchAllRemotes).toHaveBeenCalledTimes(2);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Fetch completed with 1 error'));
        expect(process.exitCode).toBe(1);
        errorSpy.mockRestore();
        logSpy.mockRestore();
    });
});
