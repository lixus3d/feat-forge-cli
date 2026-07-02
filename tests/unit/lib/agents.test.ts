import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/fs', () => ({
    copyFilesWithTemplateReplacement: vi.fn(),
    ensureDir: vi.fn(),
}));

import { refreshCopilotAgentContextFiles } from '@/lib/agents';
import { AIAgentName } from '@/foundation/types/AIAgentName';
import { copyFilesWithTemplateReplacement, ensureDir } from '@/lib/fs';
import { SOURCE_TEMPLATE_AGENT_PATH } from '@/lib/templates';

describe('agents helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create the GitHub agents directory and copy Copilot templates with overwrite enabled', async () => {
        const forgeContext = { id: 'forge' } as any;
        const branchContext = {
            path: '/workspace/feature/test',
            mainRepo: { name: 'repo1' },
        } as any;

        await refreshCopilotAgentContextFiles(forgeContext, branchContext);

        expect(ensureDir).toHaveBeenCalledWith('/workspace/feature/test/.github/agents');
        expect(copyFilesWithTemplateReplacement).toHaveBeenCalledWith(
            forgeContext,
            branchContext,
            branchContext.mainRepo,
            `${SOURCE_TEMPLATE_AGENT_PATH}/${AIAgentName.COPILOT}`,
            '/workspace/feature/test/.github/agents',
            {
                overwrite: true,
                dryRun: false,
            },
            SOURCE_TEMPLATE_AGENT_PATH,
        );
    });
});
