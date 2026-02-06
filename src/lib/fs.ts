import { access, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure a directory exists (mkdir -p behavior).
 */
export async function ensureDir(targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
}

/**
 * Read a UTF-8 text file.
 */
export async function readTextFile(targetPath: string): Promise<string> {
    return readFile(targetPath, 'utf8');
}

/**
 * Write a UTF-8 text file, replacing any existing content.
 */
export async function writeTextFile(targetPath: string, contents: string, makePath: boolean = true): Promise<void> {
    if (makePath) {
        const dir = path.dirname(targetPath);
        await ensureDir(dir);
    }
    await writeFile(targetPath, contents, 'utf8');
}

/**
 * Ensure a line exists in a file (typically .gitignore).
 * Appends the line if not present, creates the file if it doesn't exist.
 * @returns number of lines added (0 or 1)
 * @throws if the file exists but is not writable
 */
export async function ensureLineInFile(filePath: string, line: string): Promise<number> {
    let content = '';
    if (await pathExists(filePath)) {
        content = await readTextFile(filePath);
    }

    const lines = content.split('\n');
    const trimmedLine = line.trim();

    // Check if line already exists
    if (lines.some((l) => l.trim() === trimmedLine)) {
        return 0;
    }

    // Ensure file ends with newline before adding new line
    const needsNewline = content.length > 0 && !content.endsWith('\n');
    const newContent = needsNewline ? `${content}\n${trimmedLine}\n` : `${content}${trimmedLine}\n`;

    await writeTextFile(filePath, newContent);
    return 1;
}
