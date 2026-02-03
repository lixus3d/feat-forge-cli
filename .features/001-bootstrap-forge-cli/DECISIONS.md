* Patch-based workflow (git apply) plutôt qu’écriture directe.
* Adapter files générés non-commit (au début), régénérés par `sync adapters`.
* CLI parser: `commander` (simple, stable, suffisante pour l'arborescence MVP).
* Branch naming: `feature/<slug>` et worktrees dans `<root>/features/<slug>/<repoName>` (sibling des repos) pour l'isolement MVP.
* Fichiers de spec MVP: `FEATURE.md`, `TODO.md`, `DECISIONS.md`, `NOTES.md` (aligné sur la demande initiale).
* Config racine: `.feat-forge.json` requis pour mapper les repos et les dossiers d'output (worktrees).
* Override templates: `.features/.template/` (repo) puis `~/.feat-forge/template/` (global), puis fallback intégré.
* `forge init` génère un `.feat-forge.json` minimal dans le dossier courant.
* Initialisation spec via worktree temporaire et commit dans la branche feature pour rendre les fichiers disponibles dans les worktrees.
