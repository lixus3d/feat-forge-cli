import { AbstractCommands } from './AbstractCommands';
import { confirmSlugOrThrow } from '../lib/slug';
import { promptConfirm } from '@/lib/prompt';
import { BranchContext } from '@/foundation/BranchContext';

export class MaintenanceCommands extends AbstractCommands {
    /**
     * (Re)Write agent template files in the .specs/.template/.forge-agents/ directory of the main repository.
     * This is useful if you want to fix the agent's files in the project.
     */
    async installAgentTemplateLocally(
        options: { deleteExisting?: boolean; dryRun?: boolean; commit?: boolean; overwrite?: boolean } = {},
    ): Promise<void> {
        const deleteExisting = Boolean(options.deleteExisting);
        const dryRun = Boolean(options.dryRun);
        const commit = options.commit === undefined ? undefined : Boolean(options.commit);
        const overwrite = Boolean(options.overwrite);

        console.log(
            `Install agent templates locally (deleteExisting=${deleteExisting}, dryRun=${dryRun}, commit=${commit}, overwrite=${overwrite})...`,
        );

        const changed = await this.context.installAgentTemplateLocally(this.context.mainRepo, { deleteExisting, dryRun, overwrite });

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
        } else {
            const doCommit =
                commit === undefined ? await promptConfirm('Do you want to commit the changes to the repository?') : commit;
            if (doCommit) {
                if (changed.length > 0 && !dryRun && doCommit) {
                    await this.context.mainRepo.commit(
                        `chore: add feat-forge agent templates ${overwrite ? ' (overwriting existing templates)' : ''}`,
                        changed,
                    );
                }
                console.log('\nFiles were written and committed.');
            } else {
                console.log('\nFiles were written but not committed (use --commit to commit).');
            }
        }
    }
}
