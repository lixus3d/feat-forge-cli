import { AbstractCommands } from './AbstractCommands';
import { confirmSlugOrThrow } from '../lib/slug';

export class MaintenanceCommands extends AbstractCommands {
    /**
     * Rewrite agent template files in the .features/.template/agent/ directory of the main repository.
     * This is useful if you have customized templates and want to reset them to the built-in versions, or if you want to get new templates added in a newer version of feat-forge.
     */
    async rewriteAgentFiles(rawSlug: string, options: { dryRun?: boolean; commit?: boolean } = {}): Promise<void> {
        const slug = await confirmSlugOrThrow(rawSlug);
        const branchContext = await this.context.getBranchContext(slug);

        const dryRun = Boolean(options.dryRun);
        const doCommit = Boolean(options.commit);

        console.log(`Rewriting agent templates for feature '${slug}' (dryRun=${dryRun}, commit=${doCommit})...`);

        const changed = await this.context.ensureAgentTemplates(branchContext.mainRepo, true, dryRun, doCommit);

        if (changed.length === 0) {
            console.log('No agent template files were modified.');
            return;
        }

        console.log(`Modified ${changed.length} file(s):`);
        for (const f of changed) {
            console.log(`  - ${f}`);
        }

        if (dryRun) {
            console.log('\nDry run: no files were written.');
        } else if (!doCommit) {
            console.log('\nFiles were written but not committed (use --commit to commit).');
        } else {
            console.log('\nFiles were written and committed.');
        }
    }
}
