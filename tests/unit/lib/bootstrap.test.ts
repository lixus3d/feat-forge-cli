import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({
    execa: vi.fn(),
}));

vi.mock('@/lib/fs', () => ({
    pathExists: vi.fn(),
}));

vi.mock('@/lib/platform', () => ({
    getScriptExtension: vi.fn(),
    isWindows: vi.fn(),
}));

import { execa } from 'execa';
import { pathExists } from '@/lib/fs';
import { getScriptExtension, isWindows } from '@/lib/platform';
import { executeBootstrapScript, executeScript } from '@/lib/bootstrap';

describe('bootstrap helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getScriptExtension).mockReturnValue('.sh');
        vi.mocked(isWindows).mockReturnValue(false);
        process.env.NVM_DIR = '/custom/.nvm';
    });

    it('should execute the script directly when useNvmrc is disabled', async () => {
        vi.mocked(pathExists).mockResolvedValue(true);

        await executeScript('/repo/.forge/bootstrap.sh', '/repo', 'bootstrap');

        expect(execa).toHaveBeenCalledWith('/repo/.forge/bootstrap.sh', [], {
            cwd: '/repo',
            stdio: 'inherit',
            env: expect.objectContaining(process.env),
        });
    });

    it('should execute through bash and nvm use when enabled and a .nvmrc is found', async () => {
        vi.mocked(pathExists).mockImplementation(async (candidate) => {
            return candidate === '/repo/.forge/bootstrap.sh' || candidate === '/repo/.nvmrc' || candidate === '/custom/.nvm/nvm.sh';
        });

        await executeScript('/repo/.forge/bootstrap.sh', '/repo', 'bootstrap', undefined, { useNvmrc: true });

        expect(execa).toHaveBeenCalledWith(
            'bash',
            ['-lc', 'source "$1" && shift && nvm use && exec "$@"', 'bash', '/custom/.nvm/nvm.sh', '/repo/.forge/bootstrap.sh'],
            {
                cwd: '/repo',
                stdio: 'inherit',
                env: expect.objectContaining(process.env),
            },
        );
    });

    it('should fall back to direct execution when useNvmrc is enabled but no .nvmrc exists', async () => {
        vi.mocked(pathExists).mockImplementation(async (candidate) => candidate === '/repo/.forge/bootstrap.sh');

        await executeBootstrapScript('/repo', '.forge', 'bootstrap', { useNvmrc: true });

        expect(execa).toHaveBeenCalledWith('/repo/.forge/bootstrap.sh', [], {
            cwd: '/repo',
            stdio: 'inherit',
            env: expect.objectContaining(process.env),
        });
    });
});
