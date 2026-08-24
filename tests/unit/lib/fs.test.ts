import { chmod, mkdtemp, readlink, readdir as readDir, readFile, stat, symlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/validator', () => ({
    validateInput: vi.fn(),
}));

import { validateInput } from '@/lib/validator';
import {
    copyDirectoryContentsRecursively,
    ensureDir,
    ensureLineInFile,
    pathExists,
    readJSONFile,
    readTextFile,
    writeConfigSafely,
    writeTextFile,
} from '@/lib/fs';

class DemoDTO {}

describe('fs helpers', () => {
    let tempDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'feat-forge-fs-'));
    });

    it('should detect existing paths and create directories', async () => {
        const targetDir = path.join(tempDir, 'nested', 'folder');

        expect(await pathExists(targetDir)).toBe(false);

        await ensureDir(targetDir);

        expect(await pathExists(targetDir)).toBe(true);
    });

    it('should write and read text files, creating parent directories by default', async () => {
        const targetFile = path.join(tempDir, 'deep', 'file.txt');

        await writeTextFile(targetFile, 'hello forge');

        expect(await readTextFile(targetFile)).toBe('hello forge');
    });

    it('should read JSON files and delegate validation', async () => {
        const targetFile = path.join(tempDir, 'config.json');
        const payload = { enabled: true };
        const validated = { parsed: true };
        await writeFile(targetFile, JSON.stringify(payload), 'utf8');
        vi.mocked(validateInput).mockResolvedValue(validated as any);

        const result = await readJSONFile(DemoDTO, targetFile);

        expect(validateInput).toHaveBeenCalledWith(DemoDTO, payload);
        expect(result).toBe(validated);
    });

    it('should create a backup and replace config contents atomically', async () => {
        const targetFile = path.join(tempDir, 'settings.json');
        await writeFile(targetFile, 'old-value', 'utf8');

        await writeConfigSafely(targetFile, 'new-value');

        const files = await readDir(tempDir);
        const backupFile = files.find((file) => file.startsWith('settings.json.bak.'));

        expect(await readFile(targetFile, 'utf8')).toBe('new-value');
        expect(backupFile).toBeTruthy();
        expect(await readFile(path.join(tempDir, backupFile!), 'utf8')).toBe('old-value');
    });

    it('should add a missing line once and avoid duplicates', async () => {
        const targetFile = path.join(tempDir, '.gitignore');

        await expect(ensureLineInFile(targetFile, 'dist')).resolves.toBe(1);
        await expect(ensureLineInFile(targetFile, 'dist')).resolves.toBe(0);
        await writeTextFile(targetFile, 'node_modules', false);

        await expect(ensureLineInFile(targetFile, 'dist')).resolves.toBe(1);
        expect(await readFile(targetFile, 'utf8')).toBe('node_modules\ndist\n');
    });

    it('should copy directory contents recursively without changing binary files and preserve file mode', async () => {
        const srcDir = path.join(tempDir, 'src');
        const destDir = path.join(tempDir, 'dest');
        const nestedDir = path.join(srcDir, 'nested');
        const binarySource = path.join(nestedDir, 'asset.bin');
        const binaryPayload = Buffer.from([0x00, 0xff, 0x7f, 0x42]);

        await ensureDir(nestedDir);
        await writeFile(binarySource, binaryPayload);
        await chmod(binarySource, 0o744);

        const copiedFiles = await copyDirectoryContentsRecursively(srcDir, destDir, { dryRun: false });
        const copiedFile = path.join(destDir, 'nested', 'asset.bin');

        expect(copiedFiles).toEqual([copiedFile]);
        expect(await readFile(copiedFile)).toEqual(binaryPayload);
        expect((await stat(copiedFile)).mode & 0o777).toBe(0o744);
    });

    it('should reject symbolic links when symlink support is disabled', async () => {
        const srcDir = path.join(tempDir, 'src');
        const destDir = path.join(tempDir, 'dest');
        const targetFile = path.join(tempDir, 'target.txt');

        await ensureDir(srcDir);
        await writeFile(targetFile, 'secret', 'utf8');
        await symlink(targetFile, path.join(srcDir, 'link.txt'));

        await expect(copyDirectoryContentsRecursively(srcDir, destDir, { dryRun: false, allowSymlinks: false })).rejects.toThrow(
            'Refusing to copy symbolic link',
        );
    });

    it('should recreate in-tree symbolic links when symlink support is enabled', async () => {
        const srcDir = path.join(tempDir, 'src');
        const destDir = path.join(tempDir, 'dest');
        const nestedDir = path.join(srcDir, 'nested');
        const targetFile = path.join(srcDir, 'config.json');
        const sourceLink = path.join(nestedDir, 'config-link.json');
        const copiedLink = path.join(destDir, 'nested', 'config-link.json');

        await ensureDir(nestedDir);
        await writeFile(targetFile, '{"ok":true}', 'utf8');
        await symlink('../config.json', sourceLink);

        await copyDirectoryContentsRecursively(srcDir, destDir, { dryRun: false, allowSymlinks: true });

        expect(await readlink(copiedLink)).toBe('../config.json');
        expect(await readFile(path.join(destDir, 'config.json'), 'utf8')).toBe('{"ok":true}');
    });

    it('should still reject symbolic links that resolve outside the source tree', async () => {
        const srcDir = path.join(tempDir, 'src');
        const destDir = path.join(tempDir, 'dest');
        const externalDir = path.join(tempDir, 'outside');
        const externalTarget = path.join(externalDir, 'secret.txt');

        await ensureDir(srcDir);
        await ensureDir(externalDir);
        await writeFile(externalTarget, 'secret', 'utf8');
        await symlink('../outside/secret.txt', path.join(srcDir, 'link.txt'));

        await expect(copyDirectoryContentsRecursively(srcDir, destDir, { dryRun: false, allowSymlinks: true })).rejects.toThrow(
            'resolves outside the workspace root files source',
        );
    });
});
