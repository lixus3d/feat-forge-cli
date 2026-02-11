import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'os';
import path from 'path';
import { ForgeContext } from '../foundation/ForgeContext';
import { FEAT_FORGE_CONFIG_FOLDER } from './constants';
import { pathExists, readTextFile } from './fs';
import { BranchContext } from '@/foundation/BranchContext';
import { Repository } from '@/foundation/Repository';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SOURCE_TEMPLATE_PATH = path.join(__dirname, '..', 'templates');
export const SOURCE_TEMPLATE_AGENT_PATH = path.join(SOURCE_TEMPLATE_PATH, 'agent');

/**
 * Return the built-in fallback template for a given spec file.
 */
export async function defaultFeatForgeTemplateForSpecFile(templateFileName: string): Promise<string> {
    const templateFilePath = path.join(SOURCE_TEMPLATE_PATH, templateFileName);

    // console.log('Looking for built-in template at', templateFilePath);
    if (await pathExists(templateFilePath)) {
        try {
            return readTextFile(templateFilePath);
        } catch (error) {
            console.error('Could not read template file, using fallback template. Error:', error);
        }
    }
    // Fallback templates if built-in files are not found for some reason... (shouldn't happen in normal usage since templates are bundled, but just in case)
    switch (templateFileName) {
        case 'SPEC.md':
            return `# Specifications for [Feature Title]`;
        case 'TODO.md':
            return '# TODO\n\n* [ ] \n';
        default:
            return `# ${templateFileName}`;
    }
}

export async function defaultFeatForgeTemplateForAgentFile(agentFileName: string): Promise<string> {
    const templateFilePath = path.join(SOURCE_TEMPLATE_AGENT_PATH, agentFileName);

    // console.log('Looking for built-in template at', templateFilePath);
    if (await pathExists(templateFilePath)) {
        try {
            return readTextFile(templateFilePath);
        } catch (error) {
            console.error('Could not read agent template file, using fallback template. Error:', error);
        }
    }
    return `# ${agentFileName}`;
}

/**
 * Resolve a template file from repo or user overrides.
 * Order: repo .features/.template -> ~/.feat-forge/template -> built-in.
 */
export async function resolveSpecFileCustomTemplate(
    forgeContext: ForgeContext,
    repository: Repository,
    fileName: string,
    subdir: string = '',
): Promise<string> {
    // User override in the project .feat-forge/.template/
    const projectTemplate = path.join(forgeContext.rootDir, FEAT_FORGE_CONFIG_FOLDER, '.template', subdir, fileName);
    if (await pathExists(projectTemplate)) {
        return readFile(projectTemplate, 'utf8');
    }

    // Repo override in .specs/.template/ for all developers working on the repo (should be committed to git)
    const repoTemplate = repository.getTemplatePath(subdir, fileName);
    if (await pathExists(repoTemplate)) {
        return readFile(repoTemplate, 'utf8');
    }

    // User override in the home directory ~/.feat-forge/.template/ (not committed, only for the current user)
    // Basically if the user want's to override all FeatForge templates on their machine, they can put the templates in ~/.feat-forge/.template/
    const userTemplate = path.join(os.homedir(), FEAT_FORGE_CONFIG_FOLDER, '.template', subdir, fileName);
    if (await pathExists(userTemplate)) {
        return readFile(userTemplate, 'utf8');
    }

    // Fallback to built-in templates
    return await defaultFeatForgeTemplateForSpecFile(fileName);
}

export async function resolveAgentFileCustomTemplate(
    forgeContext: ForgeContext,
    repository: Repository,
    agentFile: string,
    subdir: string = '',
): Promise<string> {
    // User override in the project .feat-forge/.template/
    const projectTemplate = path.join(forgeContext.rootDir, FEAT_FORGE_CONFIG_FOLDER, '.template', '.forge-agents', subdir, agentFile);
    // console.log('Looking for agent template at', projectTemplate);
    if (await pathExists(projectTemplate)) {
        return readFile(projectTemplate, 'utf8');
    }

    // Repo override in .specs/.template/.forge-agents/ for all developers working on the repo (should be committed to git)
    const repoTemplate = repository.getAgentTemplatePath(subdir, agentFile);
    // console.log('Looking for agent template at', repoTemplate);
    if (await pathExists(repoTemplate)) {
        return readFile(repoTemplate, 'utf8');
    }

    // User override in the home directory ~/.feat-forge/.template/.forge-agents/
    // Basically if the user want's to override all FeatForge templates on their machine, they can put the templates in ~/.feat-forge/.template/
    const userTemplate = path.join(os.homedir(), FEAT_FORGE_CONFIG_FOLDER, '.template', '.forge-agents', subdir, agentFile);
    // console.log('Looking for agent template at', userTemplate);
    if (await pathExists(userTemplate)) {
        return readFile(userTemplate, 'utf8');
    }

    // Fallback to built-in templates
    return await defaultFeatForgeTemplateForAgentFile(agentFile);
}

export function replaceTemplateMarkers(
    templateContent: string,
    forgeContext: ForgeContext,
    branchContext: BranchContext,
    repoContext?: Repository,
): string {
    // replace %%--XXXXXXXXXXX--%% markers in the template with the corresponding content from infos
    const regex = /%%--([A-Z_]+)--%%/g;

    let match;
    let result = templateContent;
    const activeSpecFolder = forgeContext.options.folders.activeSpec;

    while ((match = regex.exec(result)) !== null) {
        const marker = match[1];
        switch (marker) {
            case 'COPILOT_SPEC_FILES':
                // FIXME: path resolution here is hacky
                const relativePath = repoContext ? '../..' : '.';
                const replacement = forgeContext.config.specFiles
                    .map((file) => `#file:${relativePath}/${activeSpecFolder}/${file}`)
                    .join('\n');
                result = result.replace(match[0], replacement);
                break;
        }
    }

    return result;
}
