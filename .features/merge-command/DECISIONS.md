# DECISIONS

## À trancher

- ~~Que faire si l'utilisateur annule le merge après avoir créé des conflits ? (ex : doit-on rollback, laisser l'état, proposer une aide ?)~~ → Résolu : on laisse l'état et on informe l'utilisateur

## Décisions prises

- La commande se nomme `forge feature merge <slug>` (verbe après le substantif)
- Un raccourci de commande est possible `forge merge <slug>`
- **Direction du merge** : Merge `feature/<slug>` into la branche sélectionnée
- **Source des branches cibles** : Proposer les branches existantes du projet, mais proposer en premier les classiques (main, master, dev, trunk), la liste des classiques étant surchargeable dans le fichier de config .feat-forge.json
- **État du working tree** : Exiger clean
- **Archivage / Cleanup** : Suggestion après un merge réussi, avec choix entre : ne rien faire, stop, archive
- Classe héritée : `AbstractCommands`
- Utilisation de la logique `runGit` : oui, comme les autres commandes git du projet (lib/git)
- Vérification du working tree clean avant merge : oui
- Worktree : plusieurs repos possibles, merge pour chaque repo de la feature
- Nettoyage du worktree : proposer après merge (voir DECISIONS.md)
- Stockage des branches cibles : option `commonBranches` dans .feat-forge.json
- Fichier de config : .feat-forge.json déjà existant

## Décisions d'implémentation (2026-02-05)

- **Fichier créé** : `src/commands/merge.ts` avec la classe `MergeCommands`
- **Stratégie de merge** : Utilisation de `git merge --no-ff` pour préserver l'historique de la feature
- **Gestion des conflits** : Les conflits sont détectés via le statut git (UU, AA, DD), signalés mais non résolus automatiquement
- **Continuation en cas d'erreur** : Si un repo a des conflits, le merge continue pour les autres repos
- **Prompt de branche** : Liste toutes les branches locales, priorise les branches communes (main, master, dev, develop, trunk)
- **Option "Autre"** : Permet à l'utilisateur de saisir manuellement un nom de branche
- **Feedback** : Messages détaillés pour chaque étape avec emojis pour améliorer la lisibilité
- **Résumé final** : Affiche un récapitulatif des merges réussis, en conflit, et échoués
- **Actions post-merge** : Exécution directe via `FeatureCommands` (archive/stop) selon le choix utilisateur

## Refactoring (2026-02-05)

- **Architecture du code** : La fonction `merge()` a été découpée en plusieurs sous-fonctions avec des responsabilités claires:
    - `validateActiveFeature()` : ~~Validation de la feature active~~ → SUPPRIMÉE (concept invalide)
    - `discoverFeatureWorktrees()` : Découverte des branches de feature
    - `verifyCleanWorkingTrees()` : Vérification des working trees propres
    - `performMergesForAllRepos()` : Orchestration des merges
    - `mergeSingleRepo()` : Merge d'un seul repo
    - `displaySummaryAndProposeAction()` : Affichage du résumé et proposition d'action
    - `promptForTargetBranch()` : Sélection de la branche cible
    - `proposeNextAction()` : Proposition et exécution de l'action suivante
- **Types définis** : `MergeResult` et `FeatureWorktree` pour une meilleure lisibilité
- **Documentation** : Docblocks JSDoc ajoutés pour chaque fonction avec descriptions détaillées
- **Export de FeatureCommands** : La classe a été exportée depuis `feature.ts` pour permettre son utilisation

### Refactoring des chemins (2026-02-05)

- **Problème identifié** : Chemins construits de manière incohérente avec `path.join()` dans tout le code
- **Solution** : Création de fonctions utilitaires dans `lib/feature.ts` :
    - `getFeatureRoot(worktreesRoot, slug)` : Chemin du répertoire racine d'une feature
    - `getFeatureWorktreePath(worktreesRoot, slug, repoName)` : Chemin du worktree d'un repo
    - `getTempFeatureWorktreePath(rootDir, slug, repoName)` : Chemin temporaire pour init
    - `getTempFeatureRoot(rootDir)` : Racine temporaire pour init
    - `getTempArchiveWorktreePath(rootDir, slug, repoName)` : Chemin temporaire pour archive
    - `getTempArchiveRoot(rootDir)` : Racine temporaire pour archive
- **Pattern standardisé** : `<worktreesRoot>/<slug>/<repoName>/` (ordre corrigé)
- **Fichiers refactorisés** : `commands/merge.ts` et `commands/feature.ts` utilisent maintenant ces fonctions
- **Bénéfices** :
    - Cohérence garantie dans la construction des chemins
    - Évite les erreurs d'ordre (slug avant repoName)
    - Code plus maintenable et testable
    - Changements de structure de répertoires centralisés
