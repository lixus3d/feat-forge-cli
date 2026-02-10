import { ForgeContext } from '@/foundation/ForgeContext';
import { RootRepository } from '@/foundation/Repository';
import { RepositoryInfos } from '@/foundation/types/RepositoryInfos';

export class RepositoryHelpers {
    constructor(private forgeContext: ForgeContext) {
        this.forgeContext = forgeContext;
    }

    getRepository(options: Partial<RepositoryInfos> = {}): RootRepository {
        return new RootRepository(this.forgeContext, {
            name: options.name || 'repo1',
            path: options.path || '/path/to/repo1',
            main: options.main || false,
        });
    }
}
