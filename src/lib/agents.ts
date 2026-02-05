import path from 'path';
import { readdir, rm, symlink } from 'fs/promises';
import { ensureDir, pathExists } from './fs';
import { TemplateFile } from './templates';
import { ForgeMode } from './mode';
import { Agent, AgentName } from './config';

export async function refreshAgentContextFiles(featureRoot: string, featurePath: string, agents: Agent[], mode: ForgeMode): Promise<void> {
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

    // Create/update symlinks for all context files
    // Multiple can point to the same context file, so we keep track of which ones we've already created to avoid redundant work
    const createdAgentFiles = new Set<string>();

    for (const agent of agents) {
        if (agent.agentFile === contextFile) {
            continue;
        }


        let useDefaultSymlinkLogic = true;

        switch (agent.name) {
            case AgentName.COPILOT:
                await refreshCopilotAgentContextFiles(featureRoot, featurePath, agent, mode);
                break;
        }

        if (useDefaultSymlinkLogic) {
            if (createdAgentFiles.has(path.join(agentDir, agent.agentFile)))
                continue; // already created symlink for this agent file

            const contextFilePath = path.join(agentDir, agent.agentFile);
            await rm(contextFilePath, { force: true });
            await symlink(targetPath, contextFilePath);
            createdAgentFiles.add(contextFilePath);
        }
    }
}

async function refreshCopilotAgentContextFiles(featureRoot: string, featurePath: string, agent: Agent, mode: ForgeMode): Promise<void> {

    // Need to create a .github/agents folder in the featureRoot workspace
    const githubAgentsPath = path.join(featureRoot, '.github', 'agents');
    await ensureDir(githubAgentsPath);

    // For Copilot, we basically create a symlink for each .agent.md file in the .features/<slug>/agent/Copilot/ folder in the .github/agents folder of the feature workspace, so that they can be picked up by Copilot
    const copilotAgentDir = path.join(featurePath, 'agent', 'Copilot');
    const agentFiles = await readdir(copilotAgentDir);

    for (const agentFile of agentFiles) {
        if (!agentFile.match(/\.agent\.md$/))
            continue;

        const sourcePath = path.join(copilotAgentDir, agentFile);
        const targetPath = path.join(githubAgentsPath, agentFile);

        await rm(targetPath, { force: true });
        await symlink(sourcePath, targetPath);
    }


}

