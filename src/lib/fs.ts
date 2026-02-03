import { access, mkdir, readFile, writeFile } from "fs/promises";

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
  return readFile(targetPath, "utf8");
}

/**
 * Write a UTF-8 text file, replacing any existing content.
 */
export async function writeTextFile(targetPath: string, contents: string): Promise<void> {
  await writeFile(targetPath, contents, "utf8");
}
