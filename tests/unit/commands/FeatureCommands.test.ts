import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchCommands } from '@/commands/BranchCommands';
import { FeatureCommands } from '@/commands/FeatureCommands';
import { ContextHelper } from '../../helpers/ContextHelper';

describe('FeatureCommands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should prefix the branch name for pull()', async () => {
        const { forgeContext } = ContextHelper.default().extract();
        const handlers = new FeatureCommands(forgeContext);
        const pullSpy = vi.spyOn(BranchCommands.prototype, 'pull').mockResolvedValue(undefined);

        await handlers.pull('demo');

        expect(pullSpy).toHaveBeenCalledWith('feature/demo');
    });
});
