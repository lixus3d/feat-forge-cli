import { fetchAllRemotes } from '@/lib/git';
import { AbstractCommands } from './AbstractCommands';

export class FetchCommands extends AbstractCommands {
    async fetch(): Promise<void> {
        const repositories = this.context.repositories;

        if (repositories.length === 0) {
            console.log('No repositories configured. Nothing to fetch.');
            return;
        }

        console.log(`Fetching remotes for ${repositories.length} configured ${repositories.length > 1 ? 'repositories' : 'repository'}...`);

        const results = await Promise.allSettled(
            repositories.map(async (repository) => {
                console.log(`  ↻ ${repository.name}: fetch`);
                await fetchAllRemotes(repository.path);
                console.log(`  ✓ ${repository.name}: done`);
            }),
        );

        const failed = results
            .map((result, index) => ({ result, repository: repositories[index] }))
            .filter(({ result }) => result.status === 'rejected');

        if (failed.length > 0) {
            console.error(`\n⚠ Fetch completed with ${failed.length} error${failed.length > 1 ? 's' : ''}.`);
            for (const { repository, result } of failed) {
                console.error(`  ✗ ${repository.name}: ${(result as PromiseRejectedResult).reason}`);
            }
            process.exitCode = 1;
            return;
        }

        console.log('\n✓ Fetch completed successfully.');
    }
}
