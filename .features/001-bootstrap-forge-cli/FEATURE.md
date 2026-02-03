# Objectif

Construire un CLI Node.js global installable (nom de travail: `feature-cli`) qui orchestre un workflow **feature-first** basé sur une spec versionnée et sur des itérations via patch/diff, compatible multi-agents (Copilot / Codex / Claude Code / etc.).

## Concepts

* Une feature = un dossier `.features/<slug>/` contenant :

  * `INSTRUCTIONS.md` (contrat et critères d’acceptation)
  * `STATUS.md` (checklist + TODO/DOING/DONE)
  * `DECISIONS.md` (décisions actées + raisons)
  * `NOTES.md` (contexte brut)
* Une feature active est pointée via `.features/.active` (non commit ou commit, à définir).
* Un fichier `.feat-forge.json` définit le "root" de travail et les repos git cibles.
* Le repo principal (first ou `mainRepo`) porte `.features` et `.active`.
* Les worktrees sont créés hors des repos, dans un dossier `features/` sibling des repos.
* Pour multi-repos: `features/<slug>/<repoName>` pour chaque repo configuré.
* `feature create/use` créent d'abord la branche, initialisent la spec dans cette branche (commit si besoin), puis créent le worktree.
* Les templates spec peuvent être surchargés via `.features/.template/` (repo) ou `~/.feat-forge/template/`.
* Les agents doivent toujours suivre ces 4 fichiers dans cet ordre : Instructions → Status → Decisions → Notes.
* Les “adapter files” (AGENT_CONTEXT.md, CLAUDE.md, copilot instructions, prompt files) sont **générés** à partir du canonique et **ne sont pas commit** (sauf décision contraire).

## MVP Commandes

### Feature

* `feature create <slug>`

  * crée `.features/<slug>/` et les templates (ou via `spec init`)
  * crée/active le pointeur `.features/.active`
* `feature use <slug>`

  * met à jour `.features/.active`
  * (optionnel) appelle `sync adapters`
* `feature stop <slug>`

  * si worktrees clean: supprime les worktrees, supprime le dossier `features/<slug>/`, retire `.active` si match
  * si worktrees dirty: propose commit (message requis) / abort / discard (confirmation)
* Les commandes prenant un `<slug>` doivent le valider/sanitizer et demander confirmation si modifié.

### Spec

* `spec init` : génère les 4 fichiers si absents + templates
* `spec ask "<goal>" --provider copilot|ollama|claude|openai`

  * MVP: produit une “proposition” sous forme de patch/diff sur les fichiers spec
  * Au début, on peut supporter au moins `ollama` et un mode `manual` (stdin) si besoin
* `spec review` : ouvre VSCode en diff (fichier actuel vs proposé) ou ouvre le patch
* `spec apply` : applique le patch (git apply) dans le repo
* `spec commit` : commit “docs(<slug>): …” (message généré ou -m)

### Impl

* `impl ask "<task>" --provider copilot|claude|codex`

  * MVP: idem que spec ask mais sur le code (patch)
* `impl review`, `impl apply`

### Tests

* `test` : exécute la commande de test détectée (package.json scripts) ou config

### Sync

* `sync adapters` : régénère AGENT_CONTEXT.md + .github/copilot-instructions.md + prompt files
* `sync status` : garantit pointeur feature active cohérent

## Critères d’acceptation MVP

* On peut créer une feature, l’activer, initialiser la spec, générer une proposition de patch (au moins via un provider), review via VSCode diff, appliquer, commit.
* `sync adapters` produit un fichier racine expliquant aux agents les 4 docs + règles.
* Le workflow marche sur n’importe quel repo cloné sous WSL2.

## Non-objectifs (pour MVP)

* Multi-repos front/back (sera phase 2 via config)
* Indexation embeddings/RAG
* UI web
