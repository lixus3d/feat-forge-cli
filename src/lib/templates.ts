import os from 'os';
import path from 'path';
import { readdir, readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { pathExists } from './fs';

export enum TemplateFile {
    FEATURE = 'FEATURE.md',
    TODO = 'TODO.md',
    CONTEXT_SPEC = 'CONTEXT.spec.md',
    CONTEXT_CODE = 'CONTEXT.code.md',
}

export const TEMPLATE_PATH = path.join(__dirname, '..', 'templates');
export const TEMPLATE_AGENT_PATH = path.join(TEMPLATE_PATH, 'agent');

/**
 * Templates for the main feature directory
 */
export const FEATURE_FILES: TemplateFile[] = [TemplateFile.FEATURE, TemplateFile.TODO];

export function getTemplatePath(templateFileName: TemplateFile): string {
    return path.join(
        [TemplateFile.CONTEXT_SPEC, TemplateFile.CONTEXT_CODE].includes(templateFileName) ? TEMPLATE_AGENT_PATH : TEMPLATE_PATH,
        templateFileName,
    );
}

/**
 * Return the built-in fallback template for a given spec file.
 */
export function templateFor(name: TemplateFile): string {
    try {
        // Templates are copied to dist/templates during build
        const templateFilePath = getTemplatePath(name);
        return readFileSync(templateFilePath, 'utf8');
    } catch (error) {
        // Fallback templates if files are not found for som reason... (shouldn't happen in normal usage since templates are bundled, but just in case)
        switch (name) {
            case TemplateFile.FEATURE:
                return `# Feature: [Feature Title]`;
            case TemplateFile.TODO:
                return '# TODO\n\n* [ ] \n';
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
export async function resolveCustomTemplate(rootDir: string, repoRoot: string, name: TemplateFile): Promise<string | null> {
    const subdir = [TemplateFile.CONTEXT_SPEC, TemplateFile.CONTEXT_CODE].includes(name) ? 'agent' : '';

    const repoTemplate = path.join(repoRoot, '.features', '.template', subdir, name);
    if (await pathExists(repoTemplate)) {
        return readFile(repoTemplate, 'utf8');
    }

    const projectTemplate = path.join(rootDir, '.feat-forge', 'templates', subdir, name);
    if (await pathExists(projectTemplate)) {
        return readFile(projectTemplate, 'utf8');
    }

    const userTemplate = path.join(os.homedir(), '.feat-forge', 'templates', subdir, name);
    if (await pathExists(userTemplate)) {
        return readFile(userTemplate, 'utf8');
    }

    return null;
}

/**
 * Ensure agent context templates exist in .features/.template/agent/ in the main repo, copying from built-in templates if needed.
 * This allows users to customize agent context templates on a per-repo basis by modifying the files in .features/.template/agent/.
 * If overwrite is true, existing templates will be overwritten with the built-in versions. Otherwise, existing files will be preserved.
 */
export async function ensureAgentTemplates(repoRoot: string, overwrite: boolean = false): Promise<void> {
    const { ensureDir, writeTextFile } = await import('./fs');
    const templateAgentDir = path.join(repoRoot, '.features', '.template', 'agent');
    await ensureDir(templateAgentDir);

    // basically copy every files in the TEMPLATE_AGENT_PATH folder (with subdirectories)  to templateAgentDir
    const copyTemplatesRecursively = async (srcDir: string, destDir: string) => {
        const entries = await readdir(srcDir, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                await ensureDir(destPath);
                await copyTemplatesRecursively(srcPath, destPath);
            } else if (entry.isFile()) {
                if (!overwrite && (await pathExists(destPath))) continue; // don't overwrite existing files unless overwrite flag is set
                let content = await readFile(srcPath, 'utf8');
                content = await replaceTemplateMarkers(content, {
                    repoRoot,
                }); // replace markers in the template content
                await writeTextFile(destPath, content);
            }
        }
    };
    await copyTemplatesRecursively(TEMPLATE_AGENT_PATH, templateAgentDir);
}

export async function replaceTemplateMarkers(
    templateContent: string,
    infos: {
        repoRoot: string;
    },
): Promise<string> {
    // replace %%--XXXXXXXXXXX--%% markers in the template with the corresponding content from infos
    const regex = /%%--([A-Z_]+)--%%/g;

    const repoName = path.basename(infos.repoRoot);

    let match;
    let result = templateContent;

    while ((match = regex.exec(templateContent)) !== null) {
        const marker = match[1];
        switch (marker) {
            case 'COPILOT_FILE_MARKER_FEATURE':
                result = result.replace(match[0], `#file:../../${repoName}/.active-feature/FEATURE.md`);
                break;
            case 'COPILOT_FILE_MARKER_TODO':
                result = result.replace(match[0], `#file:../../${repoName}/.active-feature/TODO.md`);
                break;
        }
    }

    return result;
}
