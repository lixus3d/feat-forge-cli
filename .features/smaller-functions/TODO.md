# TODO

## Phase 1: Analyse et préparation

- [ ] Lister toutes les fonctions de plus de 50 lignes dans `commands/*.ts`
- [ ] Identifier les patterns de code dupliqué (vérifications, validations, récupération de noms de repo)
- [ ] Créer un inventaire des appels à `this.ensureConfig()` dans toutes les classes
- [ ] Documenter les fonctions privées qui reçoivent `config` comme paramètre

## Phase 2: Refactoring de AbstractCommands

- [ ] Modifier le constructeur de `AbstractCommands` pour rendre `config` obligatoire
- [ ] Supprimer la méthode `ensureConfig()` de `AbstractCommands`
- [ ] Mettre à jour toutes les classes dérivées pour passer `config` obligatoirement
- [ ] Remplacer tous les `await this.ensureConfig()` par `this.config` dans les classes
- [ ] Vérifier que la compilation TypeScript passe sans erreur

## Phase 3: Création de fonctions utilitaires

- [ ] Créer une fonction utilitaire `getRepoNameOrThrow(repoNames, repoRoot)` pour éviter la répétition
- [ ] Créer une fonction utilitaire pour vérifier qu'un worktree existe et est propre
- [ ] Créer une fonction utilitaire pour valider l'existence d'une branche
- [ ] Créer une fonction utilitaire pour mapper les repos vers leurs worktrees
- [ ] Ajouter des docblocks JSDoc complets pour toutes ces fonctions

## Phase 4: Refactoring de commands/feature.ts

- [ ] Découper la méthode `start()` (actuellement ~70 lignes) en sous-fonctions
  - [ ] Extraire la logique de création des worktrees
  - [ ] Extraire la logique de vérification des worktrees existants
  - [ ] Extraire la logique de création des IDE workspaces
- [ ] Découper la méthode `stop()` (actuellement ~80 lignes) en sous-fonctions
  - [ ] Extraire la gestion des worktrees orphelins
  - [ ] Extraire la logique de nettoyage
- [ ] Découper la méthode `archive()` (actuellement ~90 lignes) en sous-fonctions
  - [ ] Extraire la création du worktree temporaire
  - [ ] Extraire la logique de déplacement des fichiers
- [ ] Découper la méthode `initSpecInBranch()` (actuellement ~50 lignes)
- [ ] Remplacer les appels de `config` passé en paramètre par `this.config`
- [ ] Ajouter des commentaires explicatifs avant chaque appel de sous-fonction

## Phase 5: Refactoring de commands/merge.ts

- [ ] Vérifier que toutes les fonctions sont < 50 lignes (déjà bien découpé)
- [ ] Remplacer les patterns de vérification répétés par les nouvelles fonctions utilitaires
- [ ] Optimiser l'utilisation de `this.config` au lieu de passer `config` en paramètre
- [ ] Ajouter des docblocks manquants si nécessaire

## Phase 6: Refactoring de commands/agent.ts

- [ ] Analyser la méthode `refresh()` pour opportunités de découpage
- [ ] Remplacer `await this.ensureConfig()` par `this.config`
- [ ] Ajouter des commentaires explicatifs si nécessaire

## Phase 7: Refactoring de commands/init.ts et commands/mode.ts

- [ ] Vérifier que le refactoring de `AbstractCommands` est appliqué
- [ ] S'assurer que `this.config` est utilisé correctement
- [ ] Ces fichiers sont déjà courts, vérifier qu'ils restent lisibles

## Phase 8: Mise à jour de cli.ts

- [ ] S'assurer que toutes les instances de commandes reçoivent un `config` valide
- [ ] Gérer le cas où `config` n'est pas disponible (commands qui en ont vraiment besoin)
- [ ] Ajouter une gestion d'erreur claire si `config` est requis mais absent

## Phase 9: Validation finale

- [ ] Vérifier que le code compile sans erreur TypeScript
- [ ] Tester manuellement chaque commande pour s'assurer qu'elles fonctionnent
- [ ] Vérifier qu'aucune fonction ne dépasse 50 lignes
- [ ] Vérifier que toutes les fonctions ont des docblocks
- [ ] Faire un grep pour trouver des duplications restantes
- [ ] S'assurer que les commentaires sont clairs et utiles
