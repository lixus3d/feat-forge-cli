# FeatForge

**FeatForge** is a _feature-first_ development workflow and a CLI (`forge`) designed to help you build software **deliberately**, **traceably**, and **at scale**, with or without AI agents.

This is **not** a tool to type code faster.
It is a tool to **understand what you are building before you build it**, and to keep that context alive over time — even with dozens or hundreds of features.

---

## TL;DR — the mental model

- A **feature** is a first-class artifact with its own specification.
- You always work inside one **active feature** (`.active-feature`).
- A feature has two **modes**:
    - `spec` → think, clarify, write
    - `code` → implement, guided by the spec

- AI agents are **scoped to a feature**, never global.
- Finished features are moved to `.features/.archives/`.

If you understand those five points, you understand FeatForge.

---

## What problem does FeatForge solve?

When projects grow, features pile up, context gets lost, and AI agents start hallucinating because they lack a stable source of truth.

FeatForge solves this by:

- making **specification explicit and versioned**
- separating **thinking** from **coding** via modes
- giving both humans and agents a **single, stable entry point** to feature context
- keeping finished features without cluttering active work

---

## Core concepts

### Feature

A feature is represented by a directory:

```
.features/<feature-slug>/
  FEATURE.md
  TODO.md
  agent/
```

These documents are the **source of truth** for the feature.

---

### Active feature

The feature you are currently working on is exposed via:

```
.active-feature -> .features/<feature-slug>/
```

Properties:

- `.active-feature` is a **symlink**
- it is **gitignored** (local, per-worktree state)
- each Git worktree can have its own active feature
- editors and agents can always rely on a stable path

If you open VS Code or an agent inside `.active-feature`, everything you need is there.

Agents are always launched from:

```
.active-feature/agent/
```

---

### Feature archive

Completed or paused features can be moved to:

```
.features/.archives/<feature-slug>/
```

Properties:

- `.archives/` is **versioned**
- all specs, decisions, and notes are preserved
- keeps `.features/` readable even at large scale

Command:

```bash
forge feature archive <slug>
```

The command:

- refuses if the feature is active
- refuses if related worktrees are dirty
- guarantees no specification data is lost

---

## Modes

A feature always has one active mode:

- `spec` — specification and clarification
- `code` — implementation

The current mode is stored in:

```
.features/<slug>/.forge-mode
```

Switching modes **never modifies project code**.
It only changes how agents are instructed.

---

### Spec mode

```bash
forge mode spec
```

In **spec mode**, agents:

- may read the codebase for context
- propose changes **only** to:
    - FEATURE.md
    - TODO.md

- may add questions, assumptions, options, and risks
- must not modify application code

You can enter and exit spec mode as many times as needed.

---

### Code mode

```bash
forge mode code
```

In **code mode**, agents:

- treat the four documents as a strict contract
- implement code accordingly
- may update when justified :
    - FEATURE.md
    - TODO.md

All changes are still expected to be reviewable and intentional.

---

## Agent context and adapters

Agents are always scoped to a feature.

Inside:

```
.active-feature/agent/
```

You will find two **canonical** context files:

- `CONTEXT.spec.md`
- `CONTEXT.code.md`

Depending on the active mode, FeatForge generates adapter files (symlinks or copies), such as:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `COPILOT.md`

The list of adapters is configurable in:

```
.feat-forge.json
```

Adapters:

- are feature-scoped
- never modify global agent configuration
- can be regenerated at any time

---

## CLI quickstart

```bash
# initialize forge in your project
forge init

# create a new feature
forge feature create auth-refactor

# start it (creates worktrees)
forge feature start auth-refactor

# list all feature worktrees
forge feature list

# think first
forge mode spec
# change agent context to plan, with focus on editing FEATURE.md / TODO.md files

# implement
forge mode code
# change agent context to code, with focus on reading plan from FEATURE.md / TODO.md files

# resync branches if needed
forge feature resync auth-refactor

# stop working on feature (remove worktrees)
forge feature stop auth-refactor

# archive when done (moving this feature folder to keep global .features folder clean)
forge feature archive auth-refactor
```

---

## Command Reference: `forge init`

The `forge init` command bootstraps FeatForge in your project by creating a `.feat-forge.json` configuration file.

### What it does

- Scans for Git repositories in the current directory
- Guides you through selecting which repositories to include
- Detects existing IDE configurations (VSCode, etc.)
- Generates a validated configuration file
- Creates backups when overwriting existing configs

### Basic usage

#### Interactive mode (default)

```bash
forge init
```

This launches an interactive wizard that:
1. Discovers Git repositories in the directory
2. Shows detected repositories and asks which to include
3. Prompts you to select the main repository (where `.features/` will live)
4. Detects IDE folders and suggests IDE workspace configuration
5. Shows a configuration summary
6. Asks for confirmation before writing

#### Quick accept with defaults

```bash
forge init --yes
# or
forge init -y
```

Accepts all detected defaults and writes the config file immediately. Still shows a summary unless combined with `--quiet`.

#### Fully non-interactive

```bash
forge init --non-interactive \
  --repositories "./,../other-repo" \
  --agents "Copilot,Claude" \
  --ides "VSCode"
```

Requires all configuration via flags. No prompts — fails with clear error if required values are missing.

### Flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--yes` | `-y` | Accept all defaults, skip confirmation prompts |
| `--force` | `-f` | Overwrite existing config (creates timestamped backup) |
| `--non-interactive` | | Require all values via flags; no prompts |
| `--quiet` | `-q` | Suppress summary output |
| `--path <dir>` | | Create config in specified directory (default: current) |
| `--root-dir <dir>` | | Set explicit `rootDir` in config |
| `--repositories <paths>` | | Repository paths (comma-separated or JSON array) |
| `--agents <names>` | | Agent names (comma-separated or JSON array) |
| `--ides <names>` | | IDE names (comma-separated or JSON array) |

### Common workflows

#### Initialize in a subdirectory

```bash
forge init --path ./workspace
```

#### Multiple repositories

```bash
forge init --repositories "./api,./web,./shared"
```

Or using JSON:

```bash
forge init --repositories '["./api","./web","./shared"]'
```

#### Override root directory

```bash
forge init --root-dir ../project-root
```

#### Complete non-interactive setup

```bash
forge init \
  --non-interactive \
  --yes \
  --path ./my-project \
  --root-dir . \
  --repositories "./backend,./frontend" \
  --agents "Copilot" \
  --ides "VSCode"
```

#### Force overwrite with backup

```bash
forge init --force
```

Creates `.feat-forge.json.bak.TIMESTAMP` before overwriting.

#### Silent initialization

```bash
forge init --yes --quiet
```

Accepts defaults and suppresses all output except errors.

### Safety features

- **Ancestor check**: Refuses to init if a parent directory already has a `.feat-forge.json`
- **Validation**: All repository paths are validated before writing
- **Atomic writes**: Config is written atomically (never left in partial state)
- **Backups**: `--force` always creates timestamped backups
- **Interactive protection**: Prompts for confirmation when overwriting without `--force`

### Error handling

The command will fail with clear errors if:
- An ancestor config already exists
- Repository paths don't exist or aren't directories
- Required flags are missing in `--non-interactive` mode
- Invalid JSON is provided for array flags
- Write permissions are insufficient

### What gets created

After running `forge init`, you'll have:

```
.feat-forge.json
```

Example content:

```json
{
    "rootDir": ".",
    "repositories": [
        { "path": "./backend", "main": true },
        { "path": "./frontend", "main": false }
    ],
    "agents": ["Copilot"],
    "ides": ["VSCode"]
}
```

This configuration is validated and ready for use with all other FeatForge commands.

---

## What FeatForge is NOT

- ❌ Not a magic AI coding bot
- ❌ Not a replacement for Git or your editor
- ❌ Not "vibe coding"

FeatForge is a **process tool**.
It makes decisions explicit and work reviewable — for humans and machines.

---

## Project status

FeatForge is under active development.

Current focus:

- single-repo support
- feature lifecycle
- spec/code modes
- agent scoping

Planned later:

- multi-repo features
- background agents
- richer visualization
- optional web UI

---

## Naming

- **Project**: FeatForge
- **CLI**: `forge`
