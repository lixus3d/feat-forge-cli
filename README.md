# FeatForge

**FeatForge** is a feature-first workflow and CLI (`forge`) to help you build software at scale, with (or without) AI agents.

Its goal is to make the specification of features explicit and separate the thinking/specifying phase from the coding/implementation phase, across multiple agents and repositories, while keeping everything organized and traceable.

With **FeatForge** you will be able to :

- Parallelize work on multiple features:
    - across multiple repositories.
    - accross multiple agents.
    - while keeping track of everything.
- Come back to any feature after days/weeks and immediately understand its initial specifications.
- Change agent configurations and prompts on a per-feature basis.
- Switch between agents whenever you want, without losing any context or work.

**FeatForge** is :

- Developed using FeatForge itself from the start. You can look at the `.features/` folder to see how features are specified and implemented, and how agents are configured. Test and Learn by example!
- Not opinionated about how you specify features, how you implement them, or how you use agents. It just provides a structure (yet customizable) and a workflow to keep everything organized and traceable.
- Partially tested with : Copilot, Codex, Claude code (+Ollama, LM-Studio). But it should work with any agent that can be configured to read/write files in the .active-feature folders.

**_This is an expirement, trying to mix between classic development and vibe-coding in large project with quality and sustainability in mind by making specification explicit and separating thinking from coding accross multiple agents and repositories._**

## Key Concepts

- A **feature** is a self-contained unit with its own spec (`FEATURE.md`) and tasks (`TODO.md`).
- You always work inside one **active feature** (`.active-feature`) per git worktree, which can span multiple repositories.
- Two modes: `spec` (think/specify) and `code` (implement) per feature.
- Agents goals are always scoped to a feature, never global.
- You can launch multiple agents per feature and work on multiple features in parallel.
- Finished features are archived in `.features/.archives/`.

---

## Installation

```bash
npm install -g feat-forge-cli
forge --version
```

---

## Quick Start

```bash
# Initialize FeatForge in your project
forge init

# Create a new feature
forge feature create my-feature

# Start working on a feature (creates worktrees)
forge feature start my-feature

# Switch to spec mode (write/clarify spec)
forge mode spec

# Switch to code mode (implement)
forge mode code

# Stop working on a feature (cleanup worktrees)
forge feature stop my-feature

# Archive a completed feature
forge feature archive my-feature
```

---

## Recommended Folder Structure

Here is a typical FeatForge project layout (forge creates most folders/files automatically):

```
forge-project-root/
  .feat-forge.json            # Configuration file for the project (per user)
  repo1/
    .git/                     # Git repository for repo1
  repo2/                      # Main repo (contains .features/)
    .git/                     # Git repository for repo2
    .features/                # All feature directories (created on first feature creation)
      .archives/              # Archived features folders (moved here when archived)
      .template/              # Template for new features (created on first feature creation)
        FEATURE.md            # Default feature specification
        TODO.md               # Default todo list
        agent/                # Agent configuration templates
          CONTEXT.spec.md     # Spec mode context template
          CONTEXT.code.md     # Code mode context template
      <feature-slug>/         # Active
        FEATURE.md            # Feature specification (required)
        TODO.md               # Implementation tasks (required)
        agent/                # Agent configuration
          CONTEXT.spec.md     # Spec mode context files (generated)
          CONTEXT.code.md     # Code mode context files (generated)
  repo3/
    .git/                     # Git repository for repo3
  features/
    001-bootstrap/            # Example active feature directory (created on feature start)
      repo1/                  # git worktree for repo1 (created on feature start)
        .active-feature -> ../repo2/.active-feature  # symlink to active feature in main repo
      repo2/                  # git worktree for repo2 (created on feature start)
        .active-feature -> ../.features/001-bootstrap  # symlink to active feature in this repo
        .features
          001-bootstrap/      # actual feature folder with spec and agent context
            .forge-mode       # current mode (spec or code)
            FEATURE.md        # feature specification
            TODO.md           # implementation tasks
            agent/
              CONTEXT.spec.md
              CONTEXT.code.md
      repo3/                  # git worktree for repo3 (created on feature start)
        .active-feature -> ../repo2/.active-feature  # symlink to active feature in main repo
```

---

## Modes

Each feature has a mode stored in `.features/<slug>/.forge-mode`:

- `spec`: Write/clarify the spec (`FEATURE.md`, `TODO.md` only)
- `code`: Implement according to the spec

Switch modes at any time:

```bash
forge mode spec
forge mode code
```

---

## Command Reference

### `forge init`

Initialize FeatForge in your project. Interactively creates `.feat-forge.json`, scans for git repos and asks for options.

**Usage:**

```bash
forge init
```

**Options:**

- `--yes` / `-y` : Accept all defaults
- `--force` / `-f` : Overwrite config (with backup)
- `--repositories <paths>` : Comma-separated repo paths
- `--agents <names>` : Comma-separated agent names
- `--ides <names>` : Comma-separated IDE names

---

### `forge feature create <slug>`

Create a new feature folder with spec and todo files.

**Usage:**

```bash
forge feature create my-feature
```

**Options:**

- `--yes` : Skip confirmation
- `--no-branch` : Do not create a branch

---

### `forge feature start <slug>`

Create git worktrees for all repos and set the feature as active.

**Usage:**

```bash
forge feature start my-feature
```

**Options:**

- `--ide <name>` : Open in specified IDE

---

### `forge feature list`

List all active features and their status.

**Usage:**

```bash
forge feature list
```

---

### `forge feature stop <slug>`

Clean up worktrees and remove the active feature symlink.

**Usage:**

```bash
forge feature stop my-feature
```

---

### `forge feature archive <slug>`

Move a completed feature to the archive folder.

**Usage:**

```bash
forge feature archive my-feature
```

**Options:**

- `--force` : Skip confirmation

---

### `forge mode spec` / `forge mode code`

Switch the current feature mode. `spec` for writing/clarifying, `code` for implementation.

**Usage:**

```bash
forge mode spec
forge mode code
```

---

## Help

For all commands and options:

```bash
forge --help
```
