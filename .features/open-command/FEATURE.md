# Goal

Add a `forge open` command that opens the active feature's worktree in the user's configured IDE.

Currently, `forge feature start` creates the `.code-workspace` file but never launches the IDE. Users must manually open the workspace. The `open` command closes that gap.

---

# Feature details

## Command signature

```
forge open [slug]
```

- `slug` (optional): the feature slug to open.
- If omitted, auto-detect the feature from the current working directory using `FeatureContext.findNearestFeatureContext()` (same pattern as `forge mode` and `forge agent refresh`).
- If provided, load the feature context for that slug (must be an active/started feature).

## What it opens

The command opens the feature's `.code-workspace` file in the configured IDE using the IDE's CLI command.

- Workspace file pattern: `<featureRootPath>/<slug>.code-workspace`
- The IDE is launched via its CLI command (e.g. `code <workspace-file>` for VSCode).

If the workspace file does not exist (e.g. IDE has `createWorkspace: false`, or the feature was started before IDE support was configured), fall back to opening the feature root directory directly.

## IDE CLI command resolution

Each IDE needs a CLI command to be launched. Resolution strategy:

1. Use a new optional `openCommand` field in the IDE config (e.g. `"openCommand": "cursor"`)
2. If not set, fall back to a hardcoded default for known IDEs:
   - `VSCode` → `code`
3. If no IDE is configured, print an error message and exit.

### Config example

```json
{
  "ides": [
    "VSCode"
  ]
}
```

or with explicit command override:

```json
{
  "ides": [
    { "name": "VSCode", "openCommand": "cursor" }
  ]
}
```

## Multiple IDEs

If multiple IDEs are configured, the command opens the workspace in the **first** configured IDE. A future enhancement could add a `--ide` flag or prompt for selection, but this is out of scope for v1.

## Command registration

- Top-level command: `forge open [slug]`
- Also registered as `forge feature open [slug]` for consistency with other feature commands.
- Requires config (same as `mode`, `agent`, etc.).

## Implementation pattern

Follow the same structure as existing commands:
- `OpenCommands` class extending `AbstractCommands`
- Registered in `cli.ts` via `registerOpenCommands()`
- Uses `execa` to spawn the IDE process (detached, so the CLI exits immediately)

---

# Decisions

- **Auto-detect or slug**: optional slug, auto-detect from cwd if omitted (same as `forge mode`)
- **Open target**: workspace file first, fall back to directory
- **IDE command**: hardcoded defaults with configurable `openCommand` override
- **Multiple IDEs**: open with the first configured IDE only (v1)

---

# Acceptance criteria

- `forge open` (no slug) opens the workspace file in the IDE when run from inside a feature worktree
- `forge open <slug>` opens the workspace file for the given feature slug
- Falls back to opening the feature root directory if no workspace file exists
- Uses the `openCommand` from IDE config if provided, otherwise uses the hardcoded default
- Errors clearly if no IDE is configured
- Errors clearly if the feature is not active/started
- The IDE process is spawned detached (CLI exits immediately, IDE stays open)
- Shell completion works for the slug argument (list active features)

# Not in the perimeter

- Adding new IDE types to the `IDEName` enum (separate feature)
- `--ide` flag to choose between multiple configured IDEs
- Opening spec files directly in an editor (could be a separate command)
- Auto-opening the IDE after `forge feature start` (could be added later as a config option)
