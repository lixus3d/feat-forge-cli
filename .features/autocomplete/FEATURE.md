# Objectif

Permettre l'autocomplete via TAB dans les shells (bash, zsh, fish, etc.) pour la CLI `forge`, afin d'améliorer l'expérience développeur et réduire les erreurs de saisie.

---

# Fonctionalités

- **Autocomplete des commandes principales** : `forge <TAB>` cycle/affiche les commandes disponibles (init, feature, mode, agent, merge)
- **Autocomplete contextuel pour `merge`** : `forge merge <TAB>` propose les features actives disponibles
- **Autocomplete des sous-commandes** :
    - `forge feature <TAB>` → create, start, stop, archive, list, resume, delete
    - `forge mode <TAB>` → spec, code
    - `forge agent <TAB>` → refresh
- **Support multi-shell** : Génération de scripts d'autocomplete pour bash, zsh, et fish
- **Installation facile** : Commande `forge completion <shell>` pour générer le script approprié
- ***

# Critères d'acceptation

- L'utilisateur peut taper `forge <TAB>` et voir/cycler toutes les commandes disponibles
- L'utilisateur peut taper `forge merge <TAB>` et voir la liste des features disponibles à merger
- L'utilisateur peut taper `forge feature <TAB>` et voir toutes les sous-commandes de feature
- Les suggestions d'autocomplete sont pertinentes au contexte (ex: seulement les features existantes pour merge)
- La commande `forge completion bash` génère un script valide pour bash
- La commande `forge completion zsh` génère un script valide pour zsh
- La commande `forge completion fish` génère un script valide pour fish
- Les instructions d'installation sont affichées après génération du script
- L'autocomplete fonctionne correctement après avoir sourcé le script généré
- ***

# Non-objectifs

- Installation automatique dans les fichiers de configuration shell (.bashrc, .zshrc, etc.)
- Autocomplete des arguments complexes (paths, options longues)
- Support de shells exotiques ou obsolètes
- Autocomplete intelligent basé sur l'historique ou le contexte git
- Mise à jour automatique des scripts d'autocomplete lors de nouvelles versions
