import { ForgeContext } from '@/foundation/ForgeContext';
import { RootRepository } from '@/foundation/Repository';
import { RepositoryInfos } from '@/foundation/types/RepositoryInfos';

export class RepositoryHelpers {
    constructor(private forgeContext: ForgeContext) {
        this.forgeContext = forgeContext;
    }

    getRootRepository(options: Partial<RepositoryInfos> = {}): RootRepository {
        const name = options.name || 'repo1';
        const path = options.path || '/path/to/' + name;
        const main = options.main || false;
        return new RootRepository(this.forgeContext, {
            name,
            path,
            main,
        });
    }
}
