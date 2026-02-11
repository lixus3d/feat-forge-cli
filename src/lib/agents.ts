import { ForgeContext } from '@/foundation/ForgeContext';
import path from 'path';
import { BranchContext } from '../foundation/BranchContext';
import { AIAgentName } from '../foundation/types/AIAgentName';
import { copyFilesWithTemplateReplacement, ensureDir } from './fs';
import { SOURCE_TEMPLATE_AGENT_PATH } from './templates';

export async function refreshCopilotAgentContextFiles(forgeContext: ForgeContext, branchContext: BranchContext): Promise<void> {
    // Need to create a .github/agents folder in the featureRoot workspace
    const githubAgentsPath = path.join(branchContext.path, '.github', 'agents');
    await ensureDir(githubAgentsPath);

    const copilotSrcPath = path.join(SOURCE_TEMPLATE_AGENT_PATH, AIAgentName.COPILOT);
    await copyFilesWithTemplateReplacement(
        forgeContext,
        branchContext,
        branchContext.mainRepo,
        copilotSrcPath,
        githubAgentsPath,
        {
            overwrite: true,
            dryRun: false,
        },
        SOURCE_TEMPLATE_AGENT_PATH,
    );

    // const copilotFiles = await readdir(path.join(SOURCE_TEMPLATE_AGENT_PATH, AIAgentName.COPILOT));

    // // For Copilot, we basically create a symlink for each .agent.md file in :
    // // - the .features/.template/agent/Copilot/ folder (if user doesn't have custom ones in their feature branch)
    // // - the .features/<slug>/agent/Copilot/ folder
    // // into the .github/agents folder of the feature workspace, so that they can be picked up by Copilot
    // const templateCopilotAgentDir = path.join(branchContext.mainRepo.getAgentTemplatePath(AIAgentName.COPILOT));
    // const branchCopilotAgentDir = path.join(branchContext.mainRepo.getAgentPath(branchContext.branchName, AIAgentName.COPILOT));

    // let templateAgentFiles: string[] = [];
    // let branchAgentFiles: string[] = [];
    // let allAgentFiles: Map<string, string> = new Map();

    // const matchRegex = /\.agent\.md$/;

    // if (await pathExists(templateCopilotAgentDir)) {
    //     templateAgentFiles = await readdir(templateCopilotAgentDir);
    //     templateAgentFiles.forEach((file) => {
    //         if (file.match(matchRegex)) {
    //             allAgentFiles.set(file, path.join(templateCopilotAgentDir, file));
    //         }
    //     });
    // }
    // if (await pathExists(branchCopilotAgentDir)) {
    //     branchAgentFiles = await readdir(branchCopilotAgentDir);
    //     branchAgentFiles.forEach((file) => {
    //         if (file.match(matchRegex)) {
    //             allAgentFiles.set(file, path.join(branchCopilotAgentDir, file));
    //         }
    //     });
    // }

    // for (const agentFile of allAgentFiles.keys()) {
    //     const sourcePath = allAgentFiles.get(agentFile)!;
    //     const targetPath = path.join(githubAgentsPath, agentFile);

    //     await rm(targetPath, { force: true });
    //     await symlink(sourcePath, targetPath);
    // }
}
