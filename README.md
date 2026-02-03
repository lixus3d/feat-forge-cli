# FeatForge

**FeatForge** is a feature-first development workflow and CLI designed to build software **deliberately**, **iteratively**, and **verifiably** — even when multiple agents (human or AI) work in parallel.

The goal is not faster typing.
The goal is **better features**.

FeatForge treats a feature as a first-class artifact with:

* a clear specification
* an explicit status
* documented decisions
* traceable iterations

The CLI provided by this project is called **`forge`**.

---

## Philosophy

FeatForge is built on a few strong principles:

### 1. Spec before code

Before implementing anything, the feature must be understood.
Specifications are written, reviewed, iterated, and versioned **before** code changes.

### 2. Iteration over improvisation

Features often require multiple passes:

* refining requirements
* adjusting scope
* correcting assumptions
* stabilizing implementation

FeatForge embraces this reality instead of hiding it behind “vibe coding”.

### 3. Patch, review, commit

All changes — documentation or code — are proposed as **diffs**:

* reviewable
* auditable
* reversible

No silent edits.

### 4. Multi-agent friendly

FeatForge is designed to work with:

* Copilot (VSCode)
* Codex
* Claude Code
* local models (Ollama)
* humans

Agents are interchangeable.
The **process** remains stable.

### 5. Features are long-lived

A feature may take hours, days, or weeks.
Its context must survive:

* interruptions
* tool changes
* agent changes
* developer changes

---

## Core Concepts

### Feature

A feature is represented by a directory:

```
.features/<feature-slug>/
  INSTRUCTIONS.md
  STATUS.md
  DECISIONS.md
  NOTES.md
```

These files are the **source of truth**.

### The four documents

| File              | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `FEATURE.md`      | What to build, why, constraints, acceptance criteria |
| `TODO.md`         | Current state, checklist, TODO / DOING / DONE        |
| `DECISIONS.md`    | Architectural or functional decisions and rationale  |
| `NOTES.md`        | Raw context, links, ideas, risks                     |

Agents must read and respect them **in this order**.

---

## The `forge` CLI

`forge` is a global CLI that orchestrates the FeatForge workflow.

It does **not** replace editors or AI tools.
It coordinates them.

### Feature lifecycle commands

```bash
forge feature create <slug>
forge feature use <slug>
```

Creates or activates a feature and prepares its workspace.

---

### Spec phase (thinking & planning)

```bash
forge spec init
forge spec ask "<goal>" --provider copilot|ollama|claude|openai
forge spec review
forge spec apply
forge spec commit
```

This phase focuses on **understanding and structuring** the feature.
It may run multiple times before any code is written.

---

### Implementation phase

```bash
forge impl ask "<task>" --provider copilot|claude|codex
forge impl review
forge impl apply
```

Implementation is always driven by the spec and produces reviewable patches.

---

### Verification

```bash
forge test
```

Runs the best available test command for the project (configurable).

---

### Agent synchronization

```bash
forge sync adapters
forge sync status
```

* Generates adapter files (`AGENT_CONTEXT.md`, Copilot instructions, prompt files…)
* Ensures all agents see the **same feature context**
* Keeps the active feature pointer consistent

Adapter files are generated artifacts and are not part of the canonical spec.

---

## What FeatForge is *not*

* ❌ Not “AI autocomplete in the terminal”
* ❌ Not a magic coding bot
* ❌ Not a replacement for Git, VSCode, or human judgment

FeatForge is a **process tool**, not a shortcut.

---

## Current Status

This project is under active development.

Initial focus:

* single-repo support
* spec workflow
* patch-based review
* VSCode integration for diffs

Planned later:

* multi-repo (front/back) features
* background agents
* richer status visualization
* optional web UI

---

## Naming

* **Project name**: FeatForge
* **CLI command**: `forge`

Example:

```bash
forge feature create auth-refactor
forge spec ask "define acceptance criteria"
forge impl ask "implement backend changes"
```
