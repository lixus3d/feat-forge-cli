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

- Developed using FeatForge itself from the start. You can look at the `.specs/` folder to see how features are specified and implemented, and how agents are configured. Test and Learn by example!
- Not opinionated about how you specify features, how you implement them, or how you use agents. It just provides a structure (yet customizable) and a workflow to keep everything organized and traceable.
- Partially tested with : Copilot, Codex, Claude code (+Ollama, LM-Studio). But it should work with any agent that can be configured to read/write files in the `.active-spec` folders.

**_This is an expirement, trying to mix between classic development and vibe-coding in large project with quality and sustainability in mind by making specification explicit and separating thinking from coding accross multiple agents and repositories._**

## Key Concepts

- A **branch** is a self-contained unit with its own spec (`SPEC.md`) and tasks (`TODO.md`).
- You always work inside one **active spec** (`.active-spec`) per git worktree, which can span multiple repositories.
- Multiple modes are available per branch (see [Modes](#modes)).
- Agents goals are always scoped to a branch, never global.
- You can launch multiple agents per branch and work on multiple branches in parallel.
- Finished branches are archived in `.specs/.archives/`.
- Branch types: `anything` `feature/`, `fix/`, `release/` (each with their own customizable prefix).

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

# Create a new feature (branch: feature/my-feature (customizable prefix))
forge feature create my-feature

# Start working on a feature (creates worktrees)
forge feature start my-feature

# Switch mode (updates agent files with the templates for this mode)
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
  repo2/                      # Main repo (contains .specs/)
    .git/                     # Git repository for repo2
    .specs/                   # All branch spec directories (created on first branch creation)
      .archives/              # Archived branch folders (moved here when archived)
      .template/              # Template for new branches
        agent/                # Agent configuration templates
          CONTEXT.spec.md     # Legacy spec mode context template
          CONTEXT.code.md     # Legacy code mode context template
      <branch-slug>/          # Active branch
        SPEC.md               # Branch specification (required)
        TODO.md               # Implementation tasks (required)
        .forge-mode           # Current mode
  repo3/
    .git/                     # Git repository for repo3
  worktrees/
    001-bootstrap/            # Example active branch directory (created on branch start)
      repo1/                  # git worktree for repo1 (created on branch start)
        .active-spec -> ../repo2/.active-spec  # symlink to active spec in main repo
      repo2/                  # git worktree for repo2 (created on branch start)
        .active-spec -> ../.specs/001-bootstrap  # symlink to active spec in this repo
        .specs/
          001-bootstrap/      # actual branch folder with spec and agent context
            .forge-mode       # current mode
            SPEC.md           # branch specification
            TODO.md           # implementation tasks
      repo3/                  # git worktree for repo3 (created on branch start)
        .active-spec -> ../repo2/.active-spec  # symlink to active spec in main repo
```

---

## Modes

Each branch has a mode stored in `.specs/<slug>/.forge-mode`. Switching modes updates agent adapter files with the corresponding templates.
Agent name are useful when calling subagent

Built-in modes:

| Mode            | Agent                | Description                         |
| --------------- | -------------------- | ----------------------------------- |
| `general`       | Omnibus              | General-purpose agent               |
| `discovery`     | Inventorius          | Explore and understand the codebase |
| `design`        | Architecturius       | Design architecture and specs       |
| `plan`          | Strategos            | Plan implementation strategy        |
| `tdd`           | TestDrivenCodificius | Test-driven development             |
| `code`          | Codificius           | Implement according to the spec     |
| `simplify`      | Consolidarius        | Simplify and consolidate code       |
| `review`        | Auditorix            | Review code                         |
| `test-writer`   | TestScriptor         | Write tests                         |
| `test-executor` | TestExecutor         | Execute tests                       |
| `commit`        | Scribus              | Commit changes                      |

Switch modes at any time:

```bash
forge mode <mode>
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

Create a new feature branch folder and initialize its spec.

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

List all active feature branches and their worktrees.

**Usage:**

```bash
forge feature list
```

---

### `forge feature stop <slug>`

Clean up worktrees and remove the active spec symlink.

**Usage:**

```bash
forge feature stop my-feature
```

---

### `forge feature archive <slug>`

Move a completed feature to `.specs/.archives/`.

**Usage:**

```bash
forge feature archive my-feature
```

**Options:**

- `--force` : Skip confirmation

---

### `forge feature merge <slug>`

Merge a feature branch into a target branch (across all repos).

---

### `forge feature rebase <slug>`

Rebase a feature branch onto a base branch (across all repos).

---

### `forge feature open [slug]`

Open a feature branch in the configured IDE.

---

### `forge feature resync <slug>`

Resync all repos to the expected branch.

---

### `forge fix` / `forge release` / `forge <command> branch`

Same commands as `forge feature`, but with automatic `fix/` or `release/` prefix for branch names, or just plain branch names if you prefer.

```bash
forge fix create my-bugfix
forge release create v1.2.0
forge start dev
```

---

### `forge merge <slug>` / `forge rebase <slug>`

Top-level shortcuts for merge and rebase operations (across all repos).

---

### `forge mode <mode>`

Switch agents to the given mode (updates agent files with the templates for this mode).

**Usage:**

```bash
forge mode code
forge mode review
```

---

### `forge agent refresh`

Refresh agent adapter files for the nearest branch.

---

### `forge services scan [branch]`

Scan repositories for service declarations and generate configuration with allocated ports.

---

### `forge services list [branch]`

List discovered services with their allocated ports.

---

### `forge env update [branch]`

Generate `.envrc` from `generated.services.json`.

---

### `forge env show [branch]`

Display current `.envrc` and port allocation information.

---

### `forge proxy`

Start a reverse-proxy server routing branches via subdomains.

---

### `forge maintenance rewrite-agent-files <slug>`

Rewrite all agent template files from built-in templates (overwrite).

---

### `forge completion <shell>`

Generate shell completion script (bash, zsh, fish, powershell).

**Usage:**

```bash
forge completion bash
forge completion zsh
```

---

## Help

For all commands and options:

```bash
forge --help
```
