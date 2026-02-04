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

/**
 * Ensure a line exists in a file (typically .gitignore).
 * Appends the line if not present, creates the file if it doesn't exist.
 */
export async function ensureLineInFile(filePath: string, line: string): Promise<void> {
  let content = "";
  if (await pathExists(filePath)) {
    content = await readTextFile(filePath);
  }
  
  const lines = content.split("\n");
  const trimmedLine = line.trim();
  
  // Check if line already exists
  if (lines.some(l => l.trim() === trimmedLine)) {
    return;
  }
  
  // Ensure file ends with newline before adding new line
  const needsNewline = content.length > 0 && !content.endsWith("\n");
  const newContent = needsNewline ? `${content}\n${trimmedLine}\n` : `${content}${trimmedLine}\n`;
  
  await writeTextFile(filePath, newContent);
}

/**
 * Ensure .active-feature is in .gitignore for one or more repo roots.
 */
export async function ensureGitIgnore(repoRoots: string | string[]): Promise<void> {
  const roots = Array.isArray(repoRoots) ? repoRoots : [repoRoots];
  const path = await import("path");
  
  for (const repoRoot of roots) {
    const gitignorePath = path.join(repoRoot, ".gitignore");
    await ensureLineInFile(gitignorePath, ".active-feature");
  }
}
