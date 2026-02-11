# TODO

- [x] Implémenter la commande `forge feature merge` (hérite d'`AbstractCommands`, utilise `runGit`)
- [x] Ajouter les prompts interactifs pour la sélection de branche (branches classiques d'abord, surchargeables via .feat-forge.json)
- [x] Vérifier que le working tree est clean avant merge
- [x] Gérer le merge pour chaque repo de la feature (plusieurs worktrees/repos)
- [x] Gérer la logique d'archivage/cleanup après merge (proposer à l'utilisateur)
- [x] Signaler les conflits à l'utilisateur (pas de résolution auto)
- [x] Messages de feedback explicites pour chaque étape
- [ ] Tester le flux complet avec archivage et worktree cleanup
