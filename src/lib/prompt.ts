import readline from 'readline/promises';
import { getBranches } from './git';

type PromptChoice = {
    key: string;
    label: string;
};

/**
 * Prompt the user to pick a single choice by key.
 */
export async function promptChoice(prompt: string, choices: PromptChoice[]): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const optionText = choices.map((choice) => `${choice.key}. ${choice.label}`).join('\n');
        const answer = await rl.question(`${prompt}\n${optionText}\n> `);
        return answer.trim();
    } finally {
        rl.close();
    }
}

/**
 * Prompt the user for free-form input.
 */
export async function promptText(prompt: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question(`${prompt}\n> `);
        return answer.trim();
    } finally {
        rl.close();
    }
}

/**
 * Prompt the user for a yes/no confirmation.
 */
export async function promptConfirm(prompt: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question(`${prompt} (yes/no)\n> `);
        const normalized = answer.trim().toLowerCase();
        return normalized === 'y' || normalized === 'yes';
    } finally {
        rl.close();
    }
}

/**
 * Prompt user to select a branch from available local branches.
 *
 * Displays common branches (main, master, dev, develop, trunk) first,
 * followed by feature branches (optional) and other branches,
 * and allows manual entry via "Other" option.
 *
 * @param repoRoot - The repository root to query for branches
 * @param promptMessage - Custom message for the prompt
 * @param includeFeatureBranches - Whether to include feature/ branches in the list
 * @returns The selected branch name
 * @throws Error if branch name is empty or selection is invalid
 */
export async function promptForBranch(
    repoRoot: string,
    promptMessage: string,
    featureBranchPrefix: string,
    includeFeatureBranches: boolean = false,
): Promise<string> {
    // Get all local branches
    const allBranches = await getBranches(repoRoot);

    // Common branches to prioritize in the selection menu
    const commonBranches = ['main', 'master', 'dev', 'develop', 'trunk'];

    // Separate branches by type
    const priorityBranches = commonBranches.filter((b: string) => allBranches.includes(b));
    const featureBranches = allBranches.filter((b: string) => b.startsWith(featureBranchPrefix));
    const otherBranches = allBranches.filter((b: string) => !commonBranches.includes(b) && !b.startsWith(featureBranchPrefix));

    // Build choices menu
    const choices: Array<{ key: string; label: string }> = [];
    let keyIndex = 1;

    // Add priority branches first
    for (const branch of priorityBranches) {
        choices.push({ key: String(keyIndex++), label: branch });
    }

    // Add feature branches if requested
    if (includeFeatureBranches && featureBranches.length > 0) {
        for (const branch of featureBranches) {
            choices.push({ key: String(keyIndex++), label: branch });
        }
    }

    // Add other branches
    for (const branch of otherBranches) {
        choices.push({ key: String(keyIndex++), label: branch });
    }

    // Add manual entry option
    choices.push({ key: 'x', label: 'Other (enter branch name)' });

    let branchName: string | null = null;

    // Expect a choice to be made until a valid branch name is obtained
    while (!branchName) {
        const selection = await promptChoice(promptMessage, choices);

        // Handle manual entry
        if (selection === 'x') {
            const branchNameInput = (await promptText('Enter branch name:')).trim();
            if (branchNameInput) {
                branchName = branchNameInput;
            }
        } else {
            // Find and return selected branch
            const selectedChoice = choices.find((c) => c.key === selection);
            if (selectedChoice) {
                branchName = selectedChoice.label;
            }
        }
    }

    return branchName;
}

export enum DirtyAction {
    Commit = 'A',
    Cancel = 'B',
    Discard = 'C',
}

function isDirtyAction(value: string): value is DirtyAction {
    return value === DirtyAction.Commit || value === DirtyAction.Cancel || value === DirtyAction.Discard;
}

/**
 * Prompt user to select an action for dirty worktrees.
 *
 * Presents options to commit changes, discard changes, or stop the operation.
 * Returns the user's choice as 'A', 'B', or 'C'.
 */
export async function promptDirtyActions(): Promise<{ action: DirtyAction; commitMessage?: string }> {
    while (true) {
        const answer = await promptChoice('Worktree contain uncommitted changes. Choose an action:', [
            { key: DirtyAction.Commit, label: 'Commit work (you will be asked for a commit message)' },
            { key: DirtyAction.Cancel, label: 'Stop here and do nothing' },
            { key: DirtyAction.Discard, label: 'Discard work and remove worktrees' },
        ]);

        const normalized = answer.trim().toUpperCase();
        if (isDirtyAction(normalized)) {
            if (normalized === DirtyAction.Commit) {
                const commitMessage = await promptText('Enter commit message:');
                if (!commitMessage) {
                    console.log('Commit message is required.');
                    continue;
                }
                return { action: DirtyAction.Commit, commitMessage };
            }
            return { action: normalized };
        }
    }
}
