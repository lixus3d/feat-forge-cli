import os from 'os';
import path from 'path';
import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { pathExists } from './fs';

export enum TemplateFile {
    FEATURE = 'FEATURE.md',
    TODO = 'TODO.md',
    DECISIONS = 'DECISIONS.md',
    NOTES = 'NOTES.md',
    CONTEXT_SPEC = 'CONTEXT.spec.md',
    CONTEXT_CODE = 'CONTEXT.code.md',
}

/**
 * Templates for the main feature directory
 */
export const FEATURE_FILES: TemplateFile[] = [TemplateFile.FEATURE, TemplateFile.TODO, TemplateFile.DECISIONS, TemplateFile.NOTES];

/**
 * Templates for the agent subdirectory
 */
export const AGENT_FILES: TemplateFile[] = [TemplateFile.CONTEXT_SPEC, TemplateFile.CONTEXT_CODE];

/**
 * Return the built-in fallback template for a given spec file.
 */
export function templateFor(name: TemplateFile): string {
    try {
        // Templates are copied to dist/templates during build
        const templatePath = path.join(__dirname, '..', 'templates', name);
        return readFileSync(templatePath, 'utf8');
    } catch (error) {
        // Fallback templates if files are not found
        switch (name) {
            case TemplateFile.FEATURE:
                return `# Feature: [Feature Title]`;
            case TemplateFile.TODO:
                return '# TODO\n\n* [ ] \n';
            case TemplateFile.DECISIONS:
                return '# Decisions\n\n* \n';
            case TemplateFile.NOTES:
                return '# Notes\n\n';
            case TemplateFile.CONTEXT_SPEC:
                return '# AGENT_CONTEXT - SPEC MODE\n\nThis is the spec mode context for the agent.\n';
            case TemplateFile.CONTEXT_CODE:
                return '# AGENT_CONTEXT - CODE MODE\n\nThis is the code mode context for the agent.\n';
            default:
                return '';
        }
    }
}

/**
 * Resolve a template file from repo or user overrides.
 * Order: repo .features/.template -> ~/.feat-forge/template -> built-in.
 */
export async function resolveTemplate(repoRoot: string, name: TemplateFile): Promise<string | null> {
    const repoTemplate = path.join(repoRoot, '.features', '.template', name);
    if (await pathExists(repoTemplate)) {
        return readFile(repoTemplate, 'utf8');
    }

    const userTemplate = path.join(os.homedir(), '.feat-forge', 'templates', name);
    if (await pathExists(userTemplate)) {
        return readFile(userTemplate, 'utf8');
    }

    return null;
}

/**
 * Ensure agent context templates exist in .features/.template/agent/
 */
export async function ensureAgentTemplates(repoRoot: string): Promise<void> {
    const { ensureDir, writeTextFile } = await import('./fs');
    const templateAgentDir = path.join(repoRoot, '.features', '.template', 'agent');
    await ensureDir(templateAgentDir);

    for (const fileName of AGENT_FILES) {
        const filePath = path.join(templateAgentDir, fileName);
        if (await pathExists(filePath)) {
            continue;
        }
        // Use built-in templates for agent files
        await writeTextFile(filePath, templateFor(fileName));
    }
}
