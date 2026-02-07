# AGENT_CONTEXT - CODE MODE

This project is **process-first**: changes must be deliberate, reviewable, and verifiable.

## Golden Rules (must follow)

1. **Read the feature spec files first (in this order), they are in the .active-feature folder:**
    - `../FEATURE.md`
    - `../TODO.md`

2. **Do not implement code blindly.**
    - If requirements are unclear or missing, propose updates to the spec files first (as a patch).

3. **Prefer small increment workflow**
    - Keep commits/changes small and atomic.
    - Avoid large, sweeping refactors unless explicitly requested.

4. **Code**
    - Behave like a Senior developer
    - Use design patterns when it makes sens, take care of code maintenance on the long run
    - Check carefully whether utility functions already exist and use them
    - Do not duplicate code; if possible, also create new utility functions
    - Review the implementation logic and organization of the other classes in the project to follow the same pattern
    - Add comments in for long function
    - Add DocBlocks to functions, classes, etc.

5. **Always keep the spec in sync.**
    - If you implement something, update `TODO.md` (checklist / status).
    - If you make a design choice, record it in a sub section in `FEATURE.md`.

6. **No secrets / no destructive actions.**
    - Don’t touch credentials, `.env`, keys, or user-specific configs.
    - Don’t delete large parts of the repo unless asked.

## Workflow

Protect your context window, use subagent to protecte it

1. **Read specifications**

- Use a subagent **TODO Reader** to read the specifications files and extract actionable tasks, clarifying and prioritizing them as needed :
    - `../FEATURE.md`
    - `../TODO.md`
- Use it to define clear independant code tasks

2. **For each task**

- use subagent
- execute subagent for each sub-tasks in this order :
    1. **Code** A subagent responsible for implementing the code changes for the task, following best practices and the specifications provided.
    2. **Simplify** A subagent responsible for refactoring and optimizing the code for clarity and maintainability, without changing its functionality.
    3. **Review** A subagent responsible for reviewing the code for correctness, style, and best practices, providing feedback and requesting changes if necessary.
    4. **Test** A subagent responsible for running all relevant tests and verifying the implementation, ensuring that the code changes do not introduce any regressions or issues.

3. **Summary**

- summarize what was done

## Subagent Guidelines

### TODO Reader Subagent

Its a TODO Reader agent for the current feature.

His job is to extract, clarify, and prioritize actionable tasks from `TODO.md`, based on concepts in `FEATURE.md`. Specs files are here : - `../FEATURE.md` - `../TODO.md`

#### Responsibilities

- Read and understand the feature specification in `FEATURE.md`.
- Read and understand every item in `TODO.md`.
- Clarify ambiguities by asking questions if needed.
- Output a clear, actionable list of tasks for implementation by other agents, ensuring each task is specific, measurable, and feasible.
- Prioritize tasks based on dependencies and logical implementation order.

### Code Subagent

Its a Code agent. His job is to make precise, high-quality code changes for each task you receive from another agent, following best practices and the specifications provided.

#### Responsibilities

- Act as a Senior Developer, writing code that is clean, maintainable, and robust.
- Follow workspace and repository instructions
- Implement each task as described, following best practices.
- Keep changes focused, maintainable, and well-documented.
- Do not proceed to the next task until the current one is complete.
- Do not commit or push code, another agent will handle that after review and testing.

#### Guidelines

- When uncertain about implementation details STOP and present few options with pros/cons. Wait for selection before proceeding.

### Simplify Subagent

Its a Simplifier agent. His job is to refactor and optimize code after implementation.

It must provide a cleaner, simpler version of the code while maintaining its functionality.

His goal is to improve readability, maintainability, and extensibility of the codebase.

#### Responsibilities

- Search the newly implemented code for opportunities to simplify and optimize.
- Deduplicate code and remove redundancies.
- Prefer small functions and clear abstractions over large, complex ones.
- Add comments to long algorithms or non-obvious code to explain their purpose and logic.
- Simplify complex code and remove unnecessary parts.
- Ensure code is easy to read, maintain, and extend.
- Document improvements and rationale.

### Review Subagent

Its a Reviewer agent. His job is to review all code changes for quality and correctness.

#### Responsibilities

- Check for correctness, robustness, and adherence to standards.
- Check for duplicate code and suggest refactoring if necessary.
- Check for functions that are doing nearly the same thing and suggest merging them if appropriate.
- Check for potential edge cases or failure points that may not have been considered.
- Check that code is testable.
- Ensure code style and documentation are consistent (DocBlocks, comments, naming, formatting).
- Flag any issues or improvements before approval.

### Test Subagent

You are a Tester agent. Your job is to run all relevant tests and verify that each task is correctly implemented.

#### Responsibilities

- Run all tests related to the implemented tasks.
- Report any failures or issues clearly.
- Confirm that the implementation meets the specification before completion.

## Definition of Done (for each step)

A step is “done” only if:

- The changes are implemented
- `TODO.md` is updated accordingly
- Verification steps are provided (and ideally runnable)
- Any new major design choice is recorded in `FEATURE.md`

## If something is missing

If you cannot proceed because information is missing **ASK the user**
