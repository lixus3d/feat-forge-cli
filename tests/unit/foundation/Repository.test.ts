import { ForgeExpectMainRepository } from '@/foundation/errors/ForgeExpectMainRepository';
import { ForgeConfig } from '@/foundation/ForgeConfig';
import { ForgeContext } from '@/foundation/ForgeContext';
import { Repository, RootRepository } from '@/foundation/Repository';
import { RepositoryInfos } from '@/foundation/types/RepositoryInfos';
import { ContextHelper } from '../../helpers/ContextHelper';
import { RepositoryHelpers } from '../../helpers/RepositoryHelpers';

describe('RootRepository', () => {
    let forgeConfig: ForgeConfig;
    let forgeContext: ForgeContext;
    let repositoryHelpers: RepositoryHelpers;

    beforeEach(() => {
        ({ forgeConfig, forgeContext } = ContextHelper.default().extract());
        repositoryHelpers = new RepositoryHelpers(forgeContext);
    });

    describe('constructor', () => {
        it('should create a new Repository instance', () => {
            const repository = new RootRepository(forgeContext, {
                name: 'repo1',
                path: '/path/to/repo1',
                main: false,
            });
            expect(repository).toBeInstanceOf(Repository);
            expect(repository).toBeInstanceOf(RootRepository);
            expect(repository.name).toBe('repo1');
            expect(repository.path).toBe('/path/to/repo1');
            expect(repository.main).toBe(false);
        });
    });

    describe('isMainRepository/mustBeMainRepository', () => {
        it('should return true if the repository is the main repository', () => {
            const repository = repositoryHelpers.getRepository({ main: true });
            expect(repository.isMainRepository()).toBe(true);
        });

        it('should return false if the repository is not the main repository', () => {
            const repository = repositoryHelpers.getRepository({ main: false });
            expect(repository.isMainRepository()).toBe(false);
        });

        it('mustBeMainRepository should not throw if the repository is the main repository', () => {
            const repository = repositoryHelpers.getRepository({ main: true });
            expect(() => repository.mustBeMainRepository()).not.toThrow();
        });

        it('mustBeMainRepository should throw if the repository is not the main repository', () => {
            const repository = repositoryHelpers.getRepository({ main: false });
            expect(() => repository.mustBeMainRepository()).toThrow(ForgeExpectMainRepository);
        });
    });

    describe('get specsPath', () => {
        it('should return an absolute path', () => {
            const repository = repositoryHelpers.getRepository();
            const expectedPath = '/path/to/repo1/test-specs';
            expect(repository.specsPath).toBe(expectedPath);
        });
    });
});
