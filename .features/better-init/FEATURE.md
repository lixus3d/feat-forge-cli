Purpose

- **Purpose:** Provide an interactive, safe `forge init` that scans the current directory and generates a validated `.feat-forge.json` to bootstrap Forge usage.

Goals

- **Detection** look at the directories in the confirmed rootDir, if they have `.git` folder propose them as repositories to include in the config
- **Minimal prompts:** Ask only the data required to produce a valid config.
- **Non-interactive support:** Support `--yes`, `--force`, `--non-interactive` and CLI overrides.
- **Safe writes:** Create backups on overwrite and write atomically.
- **Compatibility:** Produced file must be accepted by `ForgeConfig` runtime code.

UX Flows

- **Interactive (default):**
    - Scan current folder and display short detection summary of git repositories in it
    - Ask which of these repositories to include
    - Ask minimal questions (see Questions list) to fill required fields.
    - Show a summary
    - Create `.feat-forge.json`
- **Non-interactive (`--yes`):**
    - Accept detected defaults and write file (still show summary unless `--quiet`).
- **Forced overwrite (`--force`):**
    - Backup existing `.feat-forge.json` to `.feat-forge.json.bak.TIMESTAMP` then overwrite.
- **Path-scoped (`--path` / `--rootDir`):**
    - Create config at specified path and scope repo paths relative to that rootDir path.
- **Failure modes:**
    - If missing required values in `--non-interactive` mode, exit with clear missing-field errors.

Interactive Questions (minimal prioritized set)

- **Repositories:** choose detected repository paths or add/edit manually (must select >=1).
- **Main repo:** choose which repository is `main` (auto-picked the first one detected or if one have already a `.features` folder in it).
- **Validation rules:** `repositories` must be non-empty; only the path of each repo is required by default; if multiple repos, exactly one `main` should be implied or chosen.
- **Agents & IDEs:** accept suggested agents and IDE entries or edit list.

Directory scanning heuristics

- **Git:** detect via `.git`
- **Features/templates:** detect `.features`, `.features/.template`, `.active-feature`, `.feat-forge.json` already present.
- **IDE detection:** detect `.vscode` or `.idea` presence to suggest IDE workspace creation.

CLI flags & behavior

- **Common flags:**
    - `--yes` / `-y`: accept defaults and write.
    - `--force` / `-f`: overwrite existing config (creates backup).
    - `--path <dir>`: target directory for config file (defaults to `cwd`).
    - `--rootDir <dir>` / `--scope`: set `rootDir` explicitly.
    - `--repositories <json|string>`: pass array JSON or comma list; skip repo prompts.
    - `--agents <json|string>` / `--ides <json|string>`: set non-interactively.
    - `--non-interactive`: require all required fields supplied via flags; otherwise exit 1.
    - `--quiet`: minimize summary output.
- **Existing file behavior:**
    - Abort if `.feat-forge.json` exists unless `--force`.
    - With `--force` create `.feat-forge.json.bak.TIMESTAMP` then overwrite.

Edge cases & handling

- **No git:** prompt for manual repo paths and default branch.
- **Permission errors:** abort with clear error and no partial writes; on partial writes, attempt cleanup.
- **Ancestor config exists:** throw if any parent folder has a `.feat-forge.json`.
- **Unknown agent/IDE names:** this is allowed by the system, but they should use the `AgentConfig` schema or `IDEConfig` schema

Acceptance criteria

- `.feat-forge.json` schema already exist in the project as `ForgeConfigFile` use it
- **Valid file:** `.feat-forge.json` created is loadable by `new ForgeConfig(...)` and `loadForgeContext()` without throwing.
- **Min prompts:** only required interactive prompts are asked in default flow.
- **Non-interactive:** `--yes` creates safe defaults; `--non-interactive` fails with clear missing-field message if insufficient.
- **Backup:** `--force` writes backup file before overwrite.

Implementation notes & references

- **Reuse:** interactive prompts from [src/lib/prompt.ts](src/lib/prompt.ts)
- **Schema authority:** consult [src/foundation/ForgeConfig.ts](src/foundation/ForgeConfig.ts) for canonical shapes and validation.
- **CLI wiring:** add flags in [src/cli.ts](src/cli.ts).
- **Init command entry:** update [src/commands/InitCommands.ts](src/commands/InitCommands.ts).

Assumptions & confidence

- **Confidence:** Assumes `ForgeConfig` shape in `src/foundation/ForgeConfig.ts` is authoritative;
