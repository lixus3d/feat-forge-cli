Overview

- Implement a scanning-driven, interactive `forge init` that produces a validated `.feat-forge.json`, supports non-interactive modes.

Tasks (ordered, with priority & estimate)

- Task 1 — Implement scanner library (P0, Medium)
    - **Files:** add `src/lib/scanner.ts`
    - **Work:** implement `detectGitRoot`, `listCandidateRepos`.
    - **Estimate:** Medium

- Task 2 — Implement interactive `InitCommands.init()` orchestration (P0, Large)
    - **Files:** update `src/commands/InitCommands.ts`
    - **Work:** orchestrate scanner, call prompts from `src/lib/prompt.ts`, produce final config object, validate against `ForgeConfig` expectations, write `.feat-forge.json` atomically, create `.feat-forge.json.bak.TIMESTAMP` on `--force`.
    - **Estimate:** Large

- Task 3 — Atomic write and backup helpers (P1, Small)
    - **Files:** `src/lib/fs.ts` (extend) or add `src/lib/writeAtomic.ts`
    - **Work:** write via temp file + rename; implement backup naming scheme `.feat-forge.json.bak.TIMESTAMP`.
    - **Acceptance:** overwrite flow creates backup and final file is valid.
    - **Estimate:** Small

- Task 4 — Non-interactive flags & CLI wiring (P0, Small)
    - **Files:** update `src/cli.ts` and `InitCommands` param parsing
    - **Work:** add flags `--yes`, `--force`, `--path`, `--rootDir`, `--repositories`, `--agents`, `--ides`, `--non-interactive`, `--quiet`.
    - **Acceptance:** `forge init --help` lists new options; `--non-interactive` fails with missing fields when insufficient.
    - **Estimate:** Small

- Task 5 — Docs & README updates (P2, Small)
    - **Files:** `README.md`, CLI help in `src/cli.ts`, ensure shell completion `src/commands/CompleteCommands`
    - **Work:** document `forge init` usage and examples.
    - **Acceptance:** README includes usage examples for interactive and non-interactive flows.
    - **Estimate:** Small

References (files consulted)

- [src/commands/InitCommands.ts](src/commands/InitCommands.ts) — initial init command entry point.
- [src/foundation/ForgeConfig.ts](src/foundation/ForgeConfig.ts) — authoritative config shape and defaults.
- [src/foundation/FeatureContext.ts](src/foundation/FeatureContext.ts) — feature/template context usage.
- [src/lib/templates.ts](src/lib/templates.ts) — template resolution & copy utilities.
- [src/lib/prompt.ts](src/lib/prompt.ts) — prompt primitives to reuse.
- [src/cli.ts](src/cli.ts) — CLI command registration and where flags should be added.
