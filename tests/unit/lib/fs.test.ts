import { mkdtemp, readdir as readDir, readFile, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/validator', () => ({
    validateInput: vi.fn(),
}));

import { validateInput } from '@/lib/validator';
import { ensureDir, ensureLineInFile, pathExists, readJSONFile, readTextFile, writeConfigSafely, writeTextFile } from '@/lib/fs';

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
});
