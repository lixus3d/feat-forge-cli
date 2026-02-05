import path from 'path';
import { readFile } from 'fs/promises';
import { pathExists } from './fs';

/**
 * Known agent types that have special behaviors
 */
export enum AgentName {
    CODEX = 'Codex',
    CLAUDE = 'Claude',
    COPILOT = 'Copilot',
    CURSOR = 'Cursor',
    GEMINI = 'Gemini',
}

/**
 * Known IDE types that we can configure automatically
 */
export enum IDEName {
    VSCODE = 'VSCode',
}

/**
 * Agent configuration - can be a simple string (agent name or custom file)
 * or a full config object for more control
 */
export type AgentConfigEntry =
    | string
    | {
          name?: AgentName;
          agentFile: string;
          settings?: Record<string, unknown>;
      };

/**
 * IDE configuration - can be a simple string (IDE name) or a config object
 */
export type IDEConfigEntry =
    | string
    | {
          name?: IDEName;
          settings?: Record<string, unknown>;
      };

/**
 * Resolved agent configuration
 */
export type Agent = {
    name: AgentName | null;
    agentFile: string;
    requiresIDEConfig: boolean;
    settings?: Record<string, unknown>;
};

/**
 * Resolved IDE configuration
 */
export type IDE = {
    name: IDEName;
    createWorkspace: boolean;
    settings: Record<string, unknown>;
};

export type ForgeConfig = {
    repoPaths: string[];
    mainRepo?: string;
    worktreesPath?: string;
    agents?: AgentConfigEntry[];
    ides?: IDEConfigEntry[];
};

export type ForgeContext = {
    rootDir: string;
    repoRoots: string[];
    mainRepoRoot: string;
    repoNames: Map<string, string>;
    worktreesRoot: string;
    agents: Agent[];
    ides: IDE[];
};

/**
 * Find the nearest .feat-forge.json by walking up from startDir.
 */
export async function findConfigPath(startDir: string = process.cwd()): Promise<string> {
    let current = path.resolve(startDir);
    while (true) {
        const configPath = path.join(current, '.feat-forge.json');
        if (await pathExists(configPath)) {
            return configPath;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            throw new Error("Missing .feat-forge.json. Run the CLI from a configured root folder or start with 'forge init'.");
        }
        current = parent;
    }
}

/**
 * Load and validate the Forge config from the nearest root.
 */
export async function loadForgeConfig(startDir: string = process.cwd()): Promise<ForgeContext> {
    const configPath = await findConfigPath(startDir);
    const rootDir = path.dirname(configPath);
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ForgeConfig>;

    if (!parsed.repoPaths || parsed.repoPaths.length === 0) {
        throw new Error('Invalid .feat-forge.json: missing required "repoPaths" array.');
    }

    const repoRoots = parsed.repoPaths.map((repoPath) => path.resolve(rootDir, repoPath));
    const worktreesRoot = path.resolve(rootDir, parsed.worktreesPath ?? 'features');
    const repoNames = new Map<string, string>();
    const agents = resolveAgents(parsed.agents);
    const ides = resolveIDEs(parsed.ides);

    for (const repoRoot of repoRoots) {
        const gitDir = path.join(repoRoot, '.git');
        if (!(await pathExists(gitDir))) {
            throw new Error(`Configured repoPath is not a git repo: ${repoRoot}`);
        }
        repoNames.set(repoRoot, path.basename(repoRoot));
    }

    const mainRepoRoot = resolveMainRepoRoot(repoRoots, repoNames, parsed.mainRepo);

    return { rootDir, repoRoots, mainRepoRoot, repoNames, worktreesRoot, agents, ides };
}

/**
 * Resolve the main repo root from config, defaulting to the first repoPath.
 */
function resolveMainRepoRoot(repoRoots: string[], repoNames: Map<string, string>, mainRepo?: string): string {
    if (!mainRepo) {
        return repoRoots[0];
    }

    const byPath = repoRoots.find((repoRoot) => repoRoot.endsWith(path.normalize(mainRepo)));
    if (byPath) {
        return byPath;
    }

    for (const repoRoot of repoRoots) {
        if (repoNames.get(repoRoot) === mainRepo) {
            return repoRoot;
        }
    }

    throw new Error(`mainRepo does not match any repoPaths: ${mainRepo}`);
}

/**
 * Get default agent file name for known agents
 */
function getDefaultAgentFile(agentName: AgentName): string {
    switch (agentName) {
        case AgentName.CLAUDE:
            return 'CLAUDE.md';
        case AgentName.COPILOT:
            return 'COPILOT.instructions.md';
        case AgentName.GEMINI:
            return 'GEMINI.md';
        case AgentName.CURSOR:
        // FIXME: cursor documentation doesn't say if it search for AGENTS.md file in the current folder, might not work https://cursor.com/docs/cli/using#rules
        case AgentName.CODEX:
            return 'AGENTS.md';
    }
}

/**
 * Check if agent requires IDE configuration
 */
function agentRequiresIDEConfig(agentName: AgentName | null): boolean {
    if (!agentName) return false;
    return [AgentName.COPILOT, AgentName.CURSOR].includes(agentName);
}

/**
 * Resolve agent configurations into ResolvedAgent objects
 */
function resolveAgents(agentConfig?: AgentConfigEntry[] | string[]): Agent[] {
    if (!agentConfig) {
        return [
            {
                name: null,
                agentFile: 'AGENTS.md',
                requiresIDEConfig: false,
            },
        ];
    }

    if (!Array.isArray(agentConfig)) {
        throw new Error('Invalid .feat-forge.json: "agents" must be an array.');
    }

    const resolved: Agent[] = [];

    for (const entry of agentConfig) {
        if (typeof entry === 'string') {
            // Check if it's a known agent name
            const agentName = Object.values(AgentName).find((name) => name === entry) as AgentName | undefined;

            if (agentName) {
                resolved.push({
                    name: agentName,
                    agentFile: getDefaultAgentFile(agentName),
                    requiresIDEConfig: agentRequiresIDEConfig(agentName),
                });
            } else {
                // Custom agent file
                resolved.push({
                    name: null,
                    agentFile: entry.trim(),
                    requiresIDEConfig: false,
                });
            }
        } else {
            // Full config object
            const agentName = entry.name || null;
            resolved.push({
                name: agentName,
                agentFile: entry.agentFile.trim(),
                requiresIDEConfig: agentName ? agentRequiresIDEConfig(agentName) : false,
                settings: entry.settings,
            });
        }
    }

    if (resolved.length === 0) {
        throw new Error('Invalid .feat-forge.json: "agents" cannot be empty.');
    }

    return resolved;
}

/**
 * Resolve IDE configurations
 */
function resolveIDEs(ideConfig?: IDEConfigEntry[]): IDE[] {
    if (!ideConfig || ideConfig.length === 0) {
        return [];
    }

    if (!Array.isArray(ideConfig)) {
        throw new Error('Invalid .feat-forge.json: "ides" must be an array.');
    }

    const resolved: IDE[] = [];

    for (const entry of ideConfig) {
        if (typeof entry === 'string') {
            // Check if it's a known IDE name
            const ideName = Object.values(IDEName).find((name) => name === entry) as IDEName | undefined;

            if (!ideName) {
                throw new Error(`Unknown IDE name: "${entry}". Valid values: ${Object.values(IDEName).join(', ')}`);
            }

            resolved.push({
                name: ideName,
                createWorkspace: true,
                settings: {},
            });
        } else {
            if (!entry.name) {
                throw new Error('Invalid IDE config: "name" is required when using object notation.');
            }

            resolved.push({
                name: entry.name,
                createWorkspace: true,
                settings: entry.settings || {},
            });
        }
    }

    return resolved;
}
