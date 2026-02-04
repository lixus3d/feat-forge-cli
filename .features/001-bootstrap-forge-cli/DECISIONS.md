* Patch-based workflow (git apply) plutôt qu’écriture directe.
* Adapter files générés non-commit (au début), régénérés par `sync adapters`.
* CLI parser: `commander` (simple, stable, suffisante pour l'arborescence MVP).
* Branch naming: `feature/<slug>` et worktrees dans `<root>/features/<slug>/<repoName>` (sibling des repos) pour l'isolement MVP.
* Fichiers de spec MVP: `FEATURE.md`, `TODO.md`, `DECISIONS.md`, `NOTES.md` (aligné sur la demande initiale).
* Config racine: `.feat-forge.json` requis pour mapper les repos et les dossiers d'output (worktrees).
* Override templates: `.features/.template/` (repo) puis `~/.feat-forge/template/` (global), puis fallback intégré.
* `forge init` génère un `.feat-forge.json` minimal dans le dossier courant.
* Initialisation spec via worktree temporaire et commit dans la branche feature pour rendre les fichiers disponibles dans les worktrees.
* `feature stop` propose commit/abort/discard si worktrees dirty, sinon supprime worktrees + dossier `features/<slug>`.
* Slug user input: sanitize (filesystem/git-safe) et demander confirmation si modifié.
* Nomenclature spec confirmée: `FEATURE.md`, `TODO.md`, `DECISIONS.md`, `NOTES.md` (pas de `INSTRUCTIONS.md`/`STATUS.md`).
* Une feature active est pointée via `.features/.active` (non commit ou commit, à définir).
* Un fichier `.feat-forge.json` définit le "root" de travail et les repos git cibles.
* Le repo principal (first ou `mainRepo`) porte `.features` et `.active`.
* Les worktrees sont créés hors des repos, dans un dossier `features/` sibling des repos.
* Pour multi-repos: `features/<slug>/<repoName>` pour chaque repo configuré.
* `feature create/use` créent d'abord la branche, initialisent la spec dans cette branche (commit si besoin), puis créent le worktree.
* Les templates spec peuvent être surchargés via `.features/.template/` (repo) ou `~/.feat-forge/template/`.
* Les agents doivent toujours suivre ces 4 fichiers dans cet ordre : Feature → Todo → Decisions → Notes.
* Les “adapter files” (AGENT_CONTEXT.md, CLAUDE.md, copilot instructions, prompt files) sont **générés** à partir du canonique et **ne sont pas commit** (sauf décision contraire).