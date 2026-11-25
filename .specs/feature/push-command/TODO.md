# TODO

- [ ] Ajouter `GitOperation.Push` et les helpers git (upstream présent, ahead/behind)
- [ ] Implémenter `Repository.push(branch, { force })` (upstream / `-u origin` / à jour / mauvaise branche / rejet non fast-forward / `--force-with-lease`)
- [ ] Implémenter `BranchCommands.push` : résolution de branche (argument, workspace, prompt branches actives à la racine)
- [ ] Factoriser la résolution de branche (argument / workspace / prompt) dans un helper commun
- [ ] Brancher `forge pull` sur ce helper (prompt des branches actives depuis la racine)
- [ ] Avertissement global + confirmation si un ou plusieurs repositories sont dirty
- [ ] Confirmation pour `--force`
- [ ] Implémenter `SubBranchCommands.push` (préfixe feature / fix / release)
- [ ] Déclarer `push` + option `--force` dans `genericBranchTypeCommands` (`src/cli.ts`)
- [ ] Ajouter `push` à la complétion shell (`CompletionCommands.ts`)
- [ ] Résumé final + `process.exitCode = 1` en cas d'échec
- [ ] Tests unitaires (cas listés dans les critères d'acceptation)
- [ ] Tests de résolution de branche pour `pull` (racine sans argument)
- [ ] Mettre à jour README / aide CLI
