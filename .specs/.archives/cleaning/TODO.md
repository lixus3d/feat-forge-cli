# TODO

- [x] Localiser l’implémentation de `forge completion` et la liste des shells supportés (ajouter `powershell` + `pwsh`)
- [x] Reproduire l’erreur zsh et identifier la ligne de script générée qui casse le parse
- [x] Définir la source de vérité pour les “features actives” à proposer en completion (liste `forge feature list`, mais n’exposer que le `<slug>`/nom de dossier)
- [x] Ajouter la completion dynamique pour `feature stop|archive|resync|merge|rebase`
- [x] Utiliser la racine `worktrees` issue de la config pour la completion, meme depuis un sous-dossier
- [ ] Valider le comportement sur zsh et sur les autres shells listés
