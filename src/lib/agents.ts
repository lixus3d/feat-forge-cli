import path from 'path';
import { rm, symlink } from 'fs/promises';
import { ensureDir, pathExists } from './fs';
import { TemplateFile } from './templates';
import { ForgeMode } from './mode';

export async function refreshAgentAdapters(featurePath: string, adapters: string[], mode: ForgeMode): Promise<void> {
    const agentDir = path.join(featurePath, 'agent');
    await ensureDir(agentDir);

    const contextFile = mode === ForgeMode.SPEC ? TemplateFile.CONTEXT_SPEC : TemplateFile.CONTEXT_CODE;

    // Check if user has a custom override in agent/, otherwise use template
    const localContextPath = path.join(agentDir, contextFile);
    let targetPath: string;

    if (await pathExists(localContextPath)) {
        // User has a local override, use it directly
        targetPath = contextFile;
    } else {
        // Use the template from .features/.template/agent/
        const repoRoot = path.resolve(featurePath, '..', '..');
        const templateContextPath = path.join(repoRoot, '.features', '.template', 'agent', contextFile);

        if (!(await pathExists(templateContextPath))) {
            throw new Error(`Missing ${contextFile} in ${templateContextPath}`);
        }

        // Create relative path from agent dir to template
        targetPath = path.relative(agentDir, templateContextPath);
    }

    // Create/update symlinks for all adapters
    for (const adapter of adapters) {
        if (adapter === contextFile) {
            continue;
        }
        const adapterPath = path.join(agentDir, adapter);
        await rm(adapterPath, { force: true });
        await symlink(targetPath, adapterPath);
    }
}
