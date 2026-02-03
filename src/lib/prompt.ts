import readline from "readline/promises";

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
    const optionText = choices.map((choice) => `${choice.key}. ${choice.label}`).join("\n");
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
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}
