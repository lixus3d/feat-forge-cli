import { readdir, rm, symlink } from 'fs/promises';
import path from 'path';
import { FeatureContext } from '../foundation/FeatureContext';
import { AIAgent } from '../foundation/types/AIAgent';
import { AIAgentName } from '../foundation/types/AIAgentName';
import { ForgeMode } from '../foundation/types/ForgeMode';
import { ensureDir, pathExists } from './fs';

export async function refreshCopilotAgentContextFiles(featureContext: FeatureContext, agent: AIAgent, mode: ForgeMode): Promise<void> {
    // Need to create a .github/agents folder in the featureRoot workspace
    const githubAgentsPath = path.join(featureContext.path, '.github', 'agents');
    await ensureDir(githubAgentsPath);

    // For Copilot, we basically create a symlink for each .agent.md file in :
    // - the .features/.template/agent/Copilot/ folder (if user doesn't have custom ones in their feature branch)
    // - the .features/<slug>/agent/Copilot/ folder
    // into the .github/agents folder of the feature workspace, so that they can be picked up by Copilot
    const templateCopilotAgentDir = path.join(featureContext.mainRepo.getAgentTemplatePath(AIAgentName.COPILOT));
    const featureCopilotAgentDir = path.join(featureContext.mainRepo.getAgentPath(AIAgentName.COPILOT));

    let templateAgentFiles: string[] = [];
    let featureAgentFiles: string[] = [];
    let allAgentFiles: Map<string, string> = new Map();

    const matchRegex = /\.agent\.md$/;

    if (await pathExists(templateCopilotAgentDir)) {
        templateAgentFiles = await readdir(templateCopilotAgentDir);
        templateAgentFiles.forEach((file) => {
            if (file.match(matchRegex)) {
                allAgentFiles.set(file, path.join(templateCopilotAgentDir, file));
            }
        });
    }
    if (await pathExists(featureCopilotAgentDir)) {
        featureAgentFiles = await readdir(featureCopilotAgentDir);
        featureAgentFiles.forEach((file) => {
            if (file.match(matchRegex)) {
                allAgentFiles.set(file, path.join(featureCopilotAgentDir, file));
            }
        });
    }

    for (const agentFile of allAgentFiles.keys()) {
        const sourcePath = allAgentFiles.get(agentFile)!;
        const targetPath = path.join(githubAgentsPath, agentFile);

        await rm(targetPath, { force: true });
        await symlink(sourcePath, targetPath);
    }
}
