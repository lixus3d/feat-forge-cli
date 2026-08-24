import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextHelper } from 'tests/helpers/ContextHelper';
import { RepositoryHelpers } from 'tests/helpers/RepositoryHelpers';
import { NpmHelper } from '@/foundation/NpmHelper';

vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
}));

vi.mock('@/lib/fs', () => ({
    pathExists: vi.fn(),
}));

vi.mock('@/lib/bootstrap', () => ({
    executeCommand: vi.fn(),
}));

import { readFile } from 'fs/promises';
import { pathExists } from '@/lib/fs';
import { executeCommand } from '@/lib/bootstrap';

describe('NpmHelper', () => {
    const previousVitestEnv = process.env.VITEST;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.VITEST;
    });

    it('should pass process.useNvmrc to npm script execution', async () => {
        const { forgeContext } = ContextHelper.default({
            options: {
                process: {
                    useNvmrc: true,
                },
            },
        }).extract();
        const repository = new RepositoryHelpers(forgeContext).getRootRepository({ main: true, path: '/repo' });
        const npmHelper = new NpmHelper(forgeContext, repository);

        vi.mocked(pathExists).mockImplementation(async (candidate) => candidate === '/repo/package.json');
        vi.mocked(readFile).mockResolvedValue(
            JSON.stringify({
                scripts: {
                    'feat-forge:bootstrap': 'node bootstrap.js',
                },
            }) as any,
        );

        await npmHelper.executeNpmBootstrapScript();

        expect(executeCommand).toHaveBeenCalledWith('npm', ['run', 'feat-forge:bootstrap'], '/repo', 'npm script feat-forge:bootstrap', undefined, {
            useNvmrc: true,
        });
    });

    afterEach(() => {
        if (previousVitestEnv === undefined) {
            delete process.env.VITEST;
        } else {
            process.env.VITEST = previousVitestEnv;
        }
    });
});
