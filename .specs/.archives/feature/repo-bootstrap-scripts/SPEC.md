# Goal

Enable each repo to auto-bootstrap and execute hooks when starting a branch via feat-forge

---

# Feature details

**Bootstrap Scripts**
- Execute a `.forge/bootstrap.sh` script (or `.bat` on Windows) when a branch is started
- Script responsible for repo initialization (dependency installation, local setup, etc.)

**Hook System**
- Triggerable hooks system: `postBranchStart`, `postXxxxx` (extensible)
- Stored in `.forge/hooks/postXxxxx.sh` (or `.bat`)
- Consistent execution chain with predictable hook order

**Package.json Auto-Discovery (Node projects)**
- Auto-detect npm scripts: `feat-forge:bootstrap`, `feat-forge:hooks:postXxxxx`
- Shell alternative: centralize hooks/bootstrap in JS/TS within `package.json`
- Avoid duplication for Node projects (single source of truth for config)

**Configurable Folder Path**
- `.forge` folder customizable via `options.folders.scripts` in `.feat-forge.json`
- Allows adaptation to existing project conventions

**Platform Awareness**
- Auto-select shell (bash/sh vs .bat) based on OS
- Graceful fallback if script does not exist

# Acceptance criteria

- Bootstrap script executed after branch start
- All registered hooks execute in order
- npm scripts detected and executed for Node projects
- Shell and batch scripts execute correctly per platform
- Clear logs for each execution

# Not in the perimeter

- System dependency management
- Retry/rollback on error
- UI interface to manage hooks
- Permission/sudo restrictions
