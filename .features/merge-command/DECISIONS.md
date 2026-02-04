# DECISIONS

## À trancher
- Que faire si l'utilisateur annule le merge après avoir créé des conflits ? (ex : doit-on rollback, laisser l'état, proposer une aide ?)

## Décisions prises
* La commande se nomme `forge feature merge <slug>` (verbe après le substantif)
* Un raccourci de commande est possible `forge merge <slug>`
* **Direction du merge** : Merge `feature/<slug>` into la branche sélectionnée
* **Source des branches cibles** : Proposer les branches existantes du projet, mais proposer en premier les classiques (main, master, dev, trunk), la liste des classiques étant surchargeable dans le fichier de config .feat-forge.json
* **État du working tree** : Exiger clean
* **Archivage / Cleanup** : Suggestion après un merge réussi, avec choix entre : ne rien faire, stop, archive
* Classe héritée : `AbstractCommands`
* Utilisation de la logique `runGit` : oui, comme les autres commandes git du projet (lib/git)
* Vérification du working tree clean avant merge : oui
* Worktree : plusieurs repos possibles, merge pour chaque repo de la feature
* Nettoyage du worktree : proposer après merge (voir DECISIONS.md)
* Stockage des branches cibles : option `commonBranches` dans .feat-forge.json
* Fichier de config : .feat-forge.json déjà existant