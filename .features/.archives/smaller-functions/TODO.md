# TODO

## Phase 1: Analyse et préparation

- [x] Lister toutes les fonctions de plus de 50 lignes dans `commands/*.ts`
- [x] Identifier les patterns de code dupliqué (vérifications, validations, récupération de noms de repo)
- [x] Créer un inventaire des appels à `this.ensureConfig()` dans toutes les classes
- [x] Documenter les fonctions privées qui reçoivent `config` comme paramètre

## Phase 2: Refactoring de AbstractCommands

- [x] Modifier le constructeur de `AbstractCommands` pour rendre `config` obligatoire
- [x] Supprimer la méthode `ensureConfig()` de `AbstractCommands`
- [x] Mettre à jour toutes les classes dérivées pour passer `config` obligatoirement
- [x] Remplacer tous les `await this.ensureConfig()` par `this.config` dans les classes
- [x] Vérifier que la compilation TypeScript passe sans erreur

## Phase 3: Création de fonctions utilitaires

- [x] Créer une fonction utilitaire `getRepoNameOrThrow(repoNames, repoRoot)` pour éviter la répétition
- [x] Créer une fonction utilitaire `buildWorktreeList()` pour mapper les repos vers leurs worktrees
- [x] Ajouter des docblocks JSDoc complets pour toutes ces fonctions

## Phase 4: Refactoring de commands/feature.ts

- [x] Découper la méthode `start()` (actuellement ~70 lignes) en sous-fonctions
  - [x] Extraire `handleExistingWorktrees()` pour gérer les worktrees existants
  - [x] Extraire `createNewWorktrees()` pour créer les nouveaux worktrees
  - [x] Extraire `finalizeFeatureStart()` pour finaliser le démarrage
- [x] Découper la méthode `stop()` (actuellement ~80 lignes) en sous-fonctions
  - [x] Extraire `cleanupOrphanedWorktrees()` pour gérer les worktrees orphelins
  - [x] Extraire `handleDirtyWorktrees()` pour gérer les changements non commités
- [x] Découper la méthode `archive()` (actuellement ~90 lignes) en sous-fonctions
  - [x] Extraire `determineArchiveWorktree()` pour déterminer le worktree à utiliser
  - [x] Extraire `performArchiveOperation()` pour effectuer l'archivage
- [x] Découper la méthode `list()` (actuellement ~65 lignes) en sous-fonctions
  - [x] Extraire `collectFeatureBranches()` pour collecter les branches
  - [x] Extraire `formatBranchInfo()` pour formater l'affichage
- [x] Découper la méthode `resync()` (actuellement ~60 lignes) en sous-fonctions
  - [x] Extraire `resyncSingleWorktree()` pour resynchroniser un worktree
- [x] Remplacer les patterns de vérification répétés par `getRepoNameOrThrow()`
- [x] Optimiser l'utilisation de `this.config` au lieu de passer `config` en paramètre
- [x] Ajouter des commentaires explicatifs avant chaque appel de sous-fonction

## Phase 5: Refactoring de commands/merge.ts

- [x] Vérifier que toutes les fonctions sont < 50 lignes (déjà bien découpé) ✅
- [x] Optimiser l'utilisation de `this.config` au lieu de passer `config` en paramètre
- [x] Corriger les références à `config` dans `merge()`

## Phase 6: Refactoring de commands/agent.ts

- [x] Remplacer `await this.ensureConfig()` par `this.config`

## Phase 7: Refactoring de commands/init.ts et commands/mode.ts

- [x] Vérifier que le refactoring de `AbstractCommands` est appliqué
- [x] S'assurer que `this.config` est utilisé correctement
- [x] Ces fichiers sont déjà courts, vérifier qu'ils restent lisibles ✅

## Phase 8: Mise à jour de cli.ts

- [x] S'assurer que toutes les instances de commandes reçoivent un `config` valide
- [x] Gérer le cas où `config` n'est pas disponible (commands qui en ont vraiment besoin)
- [x] Ajouter une gestion d'erreur claire si `config` est requis mais absent

## Phase 9: Validation finale

- [x] Vérifier que le code compile sans erreur TypeScript
- [x] Vérifier qu'aucune fonction ne dépasse 50 lignes
- [x] Vérifier que toutes les fonctions ont des docblocks
- [ ] Tester manuellement chaque commande pour s'assurer qu'elles fonctionnent
- [ ] Faire un grep pour trouver des duplications restantes
- [x] S'assurer que les commentaires sont clairs et utiles

## Phase 10: Simplification de l'architecture (bonus)

- [x] Déplacer les fonctions `register*Commands` vers `cli.ts`
- [x] Alléger les fichiers de commandes en supprimant le code de registration
- [x] Exporter les classes de commandes directement
- [x] Vérifier que la compilation passe
