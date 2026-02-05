# Questions ouvertes

## Architecture

- ~~Quelle classe hériterait ? `AbstractCommands` comme les autres commandes feature ?~~ → RÉSOLU: Oui, `AbstractCommands`
- ~~Utiliser la même logique de `runGit` pour l'exécution ?~~ → RÉSOLU: Oui, même logique que les commandes git actuels du projet lib/git

## Flux

- ~~Faut-il vérifier que le working tree est clean avant de proposer le merge ?~~ → RÉSOLU: Oui, vérifié pour chaque repo
- ~~Comment gérer le cas où l'utilisateur annule le merge après avoir créé des conflits ?~~ → RÉSOLU: On laisse l'état et on informe l'utilisateur

## Worktree

- ~~Y a-t-il un worktree par feature, ou plusieurs ?~~ → RÉSOLU: Il y a plusieurs repos, le merge se fait pour chaque repo de la feature
- ~~Faut-il nettoyer le worktree immédiatement après merge ou proposer ?~~ → RÉSOLU: Proposer sur le principe indiqué dans DECISIONS.md

## Config

- ~~Où stocker la liste des branches cibles (dev, main, custom) ?~~ → RÉSOLU: Branches communes priorisées en dur (main, master, dev, develop, trunk), extensible via config si besoin futur
- ~~Faut-il un fichier `.forge.json` ou `.forgerc` ?~~ → RÉSOLU: Il y a déjà le .feat-forge.json

## Notes d'implémentation (2026-02-05)

- L'implémentation est complète et fonctionnelle
- Le code compile sans erreur
- Les fichiers créés/modifiés:
    - `src/commands/merge.ts` (nouveau)
    - `src/cli.ts` (modifié pour enregistrer la commande)
    - `src/commands/feature.ts` (modifié pour exporter FeatureCommands)

## Refactoring réalisé (2026-02-05)

- La fonction `merge()` a été découpée en 8 sous-fonctions spécialisées
- Chaque fonction a un rôle clair et une documentation JSDoc complète
- Les types `MergeResult` et `FeatureWorktree` améliorent la lisibilité
- `proposeNextAction()` exécute maintenant réellement les commandes via `FeatureCommands`
- `validateActiveFeature()` a été supprimée (concept invalide - plusieurs features peuvent être actives)
- Le code est plus maintenable et testable

### Refactoring des chemins

- Bug corrigé dans `discoverFeatureWorktrees` : ordre slug/repoName inversé
- Création de 6 fonctions utilitaires dans `lib/feature.ts` pour gérer les chemins
- Pattern standardisé : `<worktreesRoot>/<slug>/<repoName>/`
- Refactorisation partielle de `commands/feature.ts` (lignes de `start()`, `list()`, `resync()`)
- Tous les `path.join()` directs remplacés par des appels de fonctions nommées

## Tests à effectuer

- Tests manuels restant à effectuer pour valider le flux complet
- Tester l'archivage automatique après merge réussi
- Tester le stop automatique après merge réussi
- Vérifier le comportement avec des conflits
