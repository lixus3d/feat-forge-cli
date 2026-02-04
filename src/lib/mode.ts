import path from "path";
import { pathExists, readTextFile, writeTextFile } from "./fs";

export enum ForgeMode {
  SPEC = "spec",
  CODE = "code",
}

export function getModePath(featurePath: string): string {
  return path.join(featurePath, ".forge-mode");
}

export async function writeModeFile(featurePath: string, mode: ForgeMode): Promise<void> {
  await writeTextFile(getModePath(featurePath), `${mode}\n`);
}

export async function readModeFile(featurePath: string): Promise<ForgeMode> {
  const modePath = getModePath(featurePath);
  if (!(await pathExists(modePath))) {
    throw new Error("No mode set for this feature. Run 'forge mode spec' or 'forge mode code' first.");
  }

  const raw = await readTextFile(modePath);
  const normalized = raw.trim().toLowerCase();

  if (normalized === ForgeMode.SPEC) {
    return ForgeMode.SPEC;
  }

  if (normalized === ForgeMode.CODE) {
    return ForgeMode.CODE;
  }

  throw new Error(`Invalid .forge-mode value: ${raw.trim()}`);
}
