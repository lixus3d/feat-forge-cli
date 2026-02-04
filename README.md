# FeatForge

**FeatForge** is a *feature-first* development workflow and a CLI (`forge`) designed to help you build software **deliberately**, **traceably**, and **at scale**, with or without AI agents.

This is **not** a tool to type code faster.
It is a tool to **understand what you are building before you build it**, and to keep that context alive over time — even with dozens or hundreds of features.

---

## TL;DR — the mental model

* A **feature** is a first-class artifact with its own specification.
* You always work inside one **active feature** (`.active-feature`).
* A feature has two **modes**:

  * `spec` → think, clarify, write
  * `code` → implement, guided by the spec
* AI agents are **scoped to a feature**, never global.
* Finished features are moved to `.features/.archives/`.

If you understand those five points, you understand FeatForge.

---

## What problem does FeatForge solve?

When projects grow, features pile up, context gets lost, and AI agents start hallucinating because they lack a stable source of truth.

FeatForge solves this by:

* making **specification explicit and versioned**
* separating **thinking** from **coding** via modes
* giving both humans and agents a **single, stable entry point** to feature context
* keeping finished features without cluttering active work

---

## Core concepts

### Feature

A feature is represented by a directory:

```
.features/<feature-slug>/
  FEATURE.md
  TODO.md
  DECISIONS.md
  NOTES.md
  agent/
```

These four documents are the **source of truth** for the feature.

Agents must read them **in this order**:

1. FEATURE
2. TODO
3. DECISIONS
4. NOTES

---

### Active feature

The feature you are currently working on is exposed via:

```
.active-feature -> .features/<feature-slug>/
```

Properties:

* `.active-feature` is a **symlink**
* it is **gitignored** (local, per-worktree state)
* each Git worktree can have its own active feature
* editors and agents can always rely on a stable path

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

* `.archives/` is **versioned**
* all specs, decisions, and notes are preserved
* keeps `.features/` readable even at large scale

Command:

```bash
forge feature archive <slug>
```

The command:

* refuses if the feature is active
* refuses if related worktrees are dirty
* guarantees no specification data is lost

---

## Modes

A feature always has one active mode:

* `spec` — specification and clarification
* `code` — implementation

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

* may read the codebase for context
* propose changes **only** to:

  * FEATURE.md
  * TODO.md
  * DECISIONS.md
  * NOTES.md
* may add questions, assumptions, options, and risks
* must not modify application code

You can enter and exit spec mode as many times as needed.

---

### Code mode

```bash
forge mode code
```

In **code mode**, agents:

* treat the four documents as a strict contract
* implement code accordingly
* may update when justified :

  * FEATURE.md
  * TODO.md
  * DECISIONS.md
  * NOTES.md

All changes are still expected to be reviewable and intentional.

---

## Agent context and adapters

Agents are always scoped to a feature.

Inside:

```
.active-feature/agent/
```

You will find two **canonical** context files:

* `CONTEXT.spec.md`
* `CONTEXT.code.md`

Depending on the active mode, FeatForge generates adapter files (symlinks or copies), such as:

* `AGENTS.md`
* `CLAUDE.md`
* `GEMINI.md`
* `COPILOT.md`

The list of adapters is configurable in:

```
.feat-forge.json
```

Adapters:

* are feature-scoped
* never modify global agent configuration
* can be regenerated at any time

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
# edit FEATURE.md / TODO.md / DECISIONS.md

# implement
forge mode code
# write code guided by the spec

# resync branches if needed
forge feature resync auth-refactor

# stop working on feature (remove worktrees)
forge feature stop auth-refactor

# archive when done (not yet implemented)
# forge feature archive auth-refactor
```

---

## What FeatForge is NOT

* ❌ Not a magic AI coding bot
* ❌ Not a replacement for Git or your editor
* ❌ Not "vibe coding"

FeatForge is a **process tool**.
It makes decisions explicit and work reviewable — for humans and machines.

---

## Project status

FeatForge is under active development.

Current focus:

* single-repo support
* feature lifecycle
* spec/code modes
* agent scoping

Planned later:

* multi-repo features
* background agents
* richer visualization
* optional web UI

---

## Naming

* **Project**: FeatForge
* **CLI**: `forge`
