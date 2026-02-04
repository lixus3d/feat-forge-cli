# Questions ouvertes

## Architecture
* Quelle classe hériterait ? `AbstractCommands` comme les autres commandes feature ? oui
* Utiliser la même logique de `runGit` pour l'exécution ? même logique que les commandes git actuels du projet lib/git

## Flux
* Faut-il vérifier que le working tree est clean avant de proposer le merge ? oui
* Comment gérer le cas où l'utilisateur annule le merge après avoir créé des conflits ?

## Worktree
* Y a-t-il un worktree par feature, ou plusieurs ? il y a surtout plusieurs repos, donc le merge doit se faire pour chaque repos de la feature
* Faut-il nettoyer le worktree immédiatement après merge ou proposer ? proposer sur le principe indiqué dans DECISIONS.md

## Config
* Où stocker la liste des branches cibles (dev, main, custom) ? on peut avoir une option commonBranches dans le fichier de config
* Faut-il un fichier `.forge.json` ou `.forgerc` ? il y a dejà le .feat-forge.json
