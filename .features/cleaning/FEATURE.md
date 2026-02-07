# Goal

Completer et corriger la commande `forge completion xxxx` afin que la completion fonctionne sans erreur sur zsh et propose davantage de suggestions de sous-commandes (notamment pour `forge feature stop`, `archive`, `resync`, `merge`, `rebase`).

# Feature details

- Commander concernée : `forge completion xxxx` (le shell `xxxx` doit correspondre à la liste existante dans le code, à compléter en ajoutant `powershell` et un alias `pwsh` compatible)
- Problème actuel : sur zsh, `source <(forge completion zsh)` (ou équivalent) échoue avec `"/proc/self/fd/18:36: parse error near ')'"`
- Attendu : génération d’un script de completion compatible zsh, sans erreurs de parse
- Enrichir l’autocompletion pour afficher des valeurs dynamiques (features actives = même liste que `forge feature list`, mais proposer uniquement le nom de dossier correspondant au `<slug>`) pour certaines sous-commandes
  - `forge feature stop <TAB>` affiche les features actives
  - idem pour `archive`, `resync`, `merge`, `rebase`
- Conserver l’existant : ne pas changer le périmètre de la completion en dehors des points listés (sauf si nécessaire pour corriger l’erreur zsh)

# Design choices

- Completion PowerShell ajoutée via `Register-ArgumentCompleter`, en utilisant la meme liste de commandes que bash/zsh/fish et la source des features actives basee sur `FORGE_WORKTREES_ROOT` (par defaut `features`).
- Les suggestions de slugs sont limitees aux sous-commandes `stop`, `archive`, `resync`, `merge`, `rebase` (et aux raccourcis `merge`/`rebase`) pour eviter des completions actives sur `create`/`start`.
- Les scripts de completion detectent au runtime le `.feat-forge.json` en remontant les dossiers, lisent `options.folders.worktrees` (ou `folders.worktrees` si legacy) via Node.js et utilisent cette valeur, en tenant compte de `rootDir` si defini (surcharge possible via `FORGE_WORKTREES_ROOT`).

# Acceptance criteria

- `forge completion zsh` produit un script qui se source sans erreur sur zsh
- `forge feature stop <TAB>` propose les features actives
- `forge feature archive <TAB>` propose les features actives
- `forge feature resync <TAB>` propose les features actives
- `forge feature merge <TAB>` propose les features actives
- `forge feature rebase <TAB>` propose les features actives
- Les autres shells déjà listés dans le code restent supportés (sans régression), et `powershell` + `pwsh` sont ajoutés

# Not in the perimeter

- Changements de comportement CLI en dehors de la completion
- Modification du modèle de données des features actives
- Ajout de nouveaux shells non présents dans la liste existante (sauf `powershell`, explicitement demandé)
