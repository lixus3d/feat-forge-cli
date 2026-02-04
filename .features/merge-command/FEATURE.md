# Objectif

Permettre à l'utilisateur de **fusionner la branche/worktree d'une feature** vers une branche cible (dev, main, etc.) via la commande `forge feature merge <slug>`, avec un **prompt interactif** qui guide le choix de destination.
**Attention** il y a potentiellement plusieurs repos à merger. Chaque branche de chaque repo doit être merger vers la branche cible sélectionnée.

---

# Fonctionalités

* Commande `forge feature merge <slug>` acceptant un slug de feature existante (raccourci `forge merge <slug>`)
* Prompt interactif listant les branches cibles disponibles (dev, main, configurables)
* Fusion de la branche feature vers la branche sélectionnée via `git merge` de chaque repo
* Signalement des conflits à l'utilisateur (pas de résolution auto en v1)
* Ne pas s'arrêter en cours, si un repos à des conflits continuer le git merge des autres repos
* Proposition d'archivage automatique, stop ou rien après merge réussi

---

# Critères d'acceptation

* La commande rejette les slugs invalides ou inexistants
* Un prompt affiche les branches cibles disponibles et attend une sélection ou autre. Choix "Autre" = l'utilisateur saisi le nom de la branche en prompt
* Le merge s'exécute avec `git merge` vers la branche choisie
* Les conflits sont signalés clairement à l'utilisateur
* La feature est proposée à l'archivage ou stop ou rien après merge réussi
* Messages de feedback explicites pour chaque étape (succès, erreurs)

---

# Non-objectifs

* Résoudre automatiquement les conflits de merge
* Créer des pull requests ou passer par un système de code review
* Pousser directement vers un dépôt distant (push manuel post-merge)
* Stratégies avancées (rebase, squash, cherry-pick) — merge classique uniquement pour v1 sans fast-forward
