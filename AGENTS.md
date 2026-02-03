# AGENT_CONTEXT — FeatForge

You are working in the **FeatForge** repository. The CLI command is **`forge`**.
This project is **process-first**: changes must be deliberate, reviewable, and verifiable.

## Golden Rules (must follow)
1. **Read the feature spec files first (in this order):**
   - `.features/001-bootstrap-forge-cli/FEATURE.md`
   - `.features/001-bootstrap-forge-cli/TODO.md`
   - `.features/001-bootstrap-forge-cli/DECISIONS.md`
   - `.features/001-bootstrap-forge-cli/NOTES.md`

2. **Do not implement code blindly.**
   - If requirements are unclear or missing, propose updates to the spec files first (as a patch).

3. **Prefer patch-based workflows.**
   - Propose changes as diffs.
   - Keep commits small and atomic.
   - Avoid large, sweeping refactors unless explicitly requested.

4. **Always keep the spec in sync.**
   - If you implement something, update `TODO.md` (checklist / status).
   - If you make a design choice, record it in `DECISIONS.md`.
   - Use `NOTES.md` for risks, assumptions, open questions.

5. **No secrets / no destructive actions.**
   - Don’t touch credentials, `.env`, keys, or user-specific configs.
   - Don’t delete large parts of the repo unless asked.

## Working Style
- **Plan first, then patch.**
- When responding, use this structure:

### Response structure
1. **Spec recap (very short)**
   - 1–2 lines: what the feature is and what “done” means (from `FEATURE.md`).

2. **Next steps**
   - Bullet list of tasks you will do now (from `TODO.md`), in order.

3. **Proposed changes**
   - List the files you intend to change.
   - Provide a diff/patch or precise edits.

4. **Verification**
   - Tell how to verify (commands, tests, manual checks).

5. **Spec updates**
   - Mention which items you updated in `TODO.md` and/or entries added to `DECISIONS.md`.

## Scope of this feature
Active feature: **001-bootstrap-forge-cli**

This feature aims to bootstrap the `forge` CLI MVP with:
- feature lifecycle commands
- spec workflow commands
- patch/diff based review & apply
- adapter generation (agent context + Copilot instructions)
- minimal test runner integration

Exact scope and acceptance criteria are defined in `FEATURE.md`.

## Tooling / Preferences
- Prefer **TypeScript** for the CLI.
- Use a clean command structure (subcommands).
- Use standard, boring tooling:
  - `commander` or `yargs` for CLI parsing
  - `execa` for shelling out to git / code / rg
  - `simple-git` for git info (optional)
- Must run well under **WSL2**.

## VSCode integration
When asked to open diffs:
- Use `code --diff <old> <new>` when possible.
- Otherwise generate a `.patch` file and open it.

## Definition of Done (for each step)
A step is “done” only if:
- The change is implemented
- `TODO.md` is updated accordingly
- Verification steps are provided (and ideally runnable)
- Any new design choice is recorded in `DECISIONS.md`

## If something is missing
If you cannot proceed because information is missing:
- Add an entry under “Open Questions” in `NOTES.md`
- Add a TODO item to clarify or decide
- Propose a minimal default choice and record it in `DECISIONS.md` as “tentative”
