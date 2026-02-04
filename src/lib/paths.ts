import path from "path";

export function featuresRoot(repoRoot: string): string {
  return path.join(repoRoot, ".features");
}

/**
 * Path to a specific feature directory.
 */
export function featureDir(repoRoot: string, slug: string): string {
  return path.join(featuresRoot(repoRoot), slug);
}

/**
 * Path to the active feature pointer file.
 */
export function activeFeatureFile(repoRoot: string): string {
  return path.join(repoRoot, ".active-feature");
}
