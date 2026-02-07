import inquirer from 'inquirer';
import { getBranches } from './git';

export type PromptChoice = {
    value: string;
    name: string;
};

export type CheckboxChoice = {
    name: string;
    value: string;
    checked?: boolean;
};

/**
 * Prompt the user to pick a single choice by key.
 */
export async function promptChoice(message: string, choices: PromptChoice[]): Promise<string> {
    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'selected',
            message,
            choices,
        },
    ]);
    return answer.selected;
}

/**
 * Prompt the user for free-form input.
 */
export async function promptText(message: string): Promise<string> {
    const answer = await inquirer.prompt([
        {
            type: 'input',
            name: 'text',
            message,
        },
    ]);
    return answer.text.trim();
}

/**
 * Prompt the user for a yes/no confirmation.
 */
export async function promptConfirm(message: string): Promise<boolean> {
    const answer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message,
            default: false,
        },
    ]);
    return answer.confirmed;
}

/**
 * Prompt the user to select multiple items using checkboxes.
 */
export async function promptCheckbox(message: string, choices: CheckboxChoice[]): Promise<string[]> {
    const answer = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selected',
            message,
            choices: choices.map((choice) => ({
                name: choice.name,
                value: choice.value,
                checked: choice.checked || false,
            })),
        },
    ]);
    return answer.selected;
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
    const choices: CheckboxChoice[] = [];

    // Add priority branches first
    for (const branch of priorityBranches) {
        choices.push({ name: branch, value: branch });
    }

    // Add feature branches if requested
    if (includeFeatureBranches && featureBranches.length > 0) {
        for (const branch of featureBranches) {
            choices.push({ name: branch, value: branch });
        }
    }

    // Add other branches
    for (const branch of otherBranches) {
        choices.push({ name: branch, value: branch });
    }

    // Add manual entry option
    choices.push({ name: 'Other (enter branch name)', value: '__other__' });

    let branchName: string | null = null;

    // Expect a choice to be made until a valid branch name is obtained
    while (!branchName) {
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'selected',
                message: promptMessage,
                choices,
            },
        ]);

        const selection = answer.selected;

        // Handle manual entry
        if (selection === '__other__') {
            const branchNameInput = await promptText('Enter branch name:');
            if (branchNameInput) {
                branchName = branchNameInput;
            }
        } else {
            branchName = selection;
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
            { value: DirtyAction.Commit, name: 'Commit work (you will be asked for a commit message)' },
            { value: DirtyAction.Cancel, name: 'Stop here and do nothing' },
            { value: DirtyAction.Discard, name: 'Discard work and remove worktrees' },
        ]);

        if (isDirtyAction(answer)) {
            if (answer === DirtyAction.Commit) {
                const commitMessage = await promptText('Enter commit message:');
                if (!commitMessage) {
                    console.log('Commit message is required.');
                    continue;
                }
                return { action: DirtyAction.Commit, commitMessage };
            }
            return { action: answer };
        }
    }
}
