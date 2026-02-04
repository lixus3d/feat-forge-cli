import os from "os";
import path from "path";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { pathExists } from "./fs";

export type FeatureFileName = "FEATURE.md" | "TODO.md" | "DECISIONS.md" | "NOTES.md";

export const FEATURE_FILES: FeatureFileName[] = [
  "FEATURE.md",
  "TODO.md",
  "DECISIONS.md",
  "NOTES.md",
];

/**
 * Return the built-in fallback template for a given spec file.
 */
export function templateFor(name: FeatureFileName): string {
  try {
    // Templates are copied to dist/templates during build
    const templatePath = path.join(__dirname, "..", "templates", name);
    return readFileSync(templatePath, "utf8");
  } catch (error) {
    // Fallback templates if files are not found
    switch (name) {
      case "FEATURE.md":
        return `# Feature: [Feature Title]`;
      case "TODO.md":
        return "# TODO\n\n* [ ] \n";
      case "DECISIONS.md":
        return "# Decisions\n\n* \n";
      case "NOTES.md":
        return "# Notes\n\n";
      default:
        return "";
    }
  }
}

/**
 * Resolve a template file from repo or user overrides.
 * Order: repo .features/.template -> ~/.feat-forge/template -> built-in.
 */
export async function resolveTemplate(
  repoRoot: string,
  name: FeatureFileName,
): Promise<string | null> {
  const repoTemplate = path.join(repoRoot, ".features", ".template", name);
  if (await pathExists(repoTemplate)) {
    return readFile(repoTemplate, "utf8");
  }

  const userTemplate = path.join(os.homedir(), ".feat-forge", "templates", name);
  if (await pathExists(userTemplate)) {
    return readFile(userTemplate, "utf8");
  }

  return null;
}
