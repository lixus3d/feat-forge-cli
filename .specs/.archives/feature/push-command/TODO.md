# TODO

- [x] Ajouter `GitOperation.Push` et les helpers git (upstream présent, ahead/behind)
- [x] Implémenter `Repository.push(branch, { force })` (upstream / `-u origin` / à jour / mauvaise branche / rejet non fast-forward / `--force-with-lease`)
- [x] Implémenter `BranchCommands.push` : résolution de branche (argument, workspace, prompt branches actives à la racine)
- [x] Factoriser la résolution de branche (argument / workspace / prompt) dans un helper commun
- [x] Brancher `forge pull` sur ce helper (prompt des branches actives depuis la racine)
- [x] Avertissement global + confirmation si un ou plusieurs repositories sont dirty
- [x] Confirmation pour `--force`
- [x] Implémenter `SubBranchCommands.push` (préfixe feature / fix / release)
- [x] Déclarer `push` + option `--force` dans `genericBranchTypeCommands` (`src/cli.ts`)
- [x] Ajouter `push` à la complétion shell (`CompletionCommands.ts`)
- [x] Résumé final + `process.exitCode = 1` en cas d'échec
- [x] Tests unitaires (cas listés dans les critères d'acceptation)
- [x] Tests de résolution de branche pour `pull` (racine sans argument)
- [x] Mettre à jour README / aide CLI
