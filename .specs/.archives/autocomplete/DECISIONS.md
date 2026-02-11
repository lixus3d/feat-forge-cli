# DECISIONS

## Approche technique

### Utilisation d'une bibliothèque vs custom

**Question** : Doit-on utiliser une bibliothèque existante (comme `omelette`, `tabtab`) ou implémenter manuellement?

**Options** :

1. Bibliothèque existante (ex: omelette, tabtab)
    - ✅ Gain de temps
    - ✅ Support multi-shell inclus
    - ❌ Dépendance externe supplémentaire
    - ❌ Moins de contrôle sur le comportement

2. Implémentation custom
    - ✅ Contrôle total
    - ✅ Pas de dépendance supplémentaire
    - ✅ Scripts générés plus simples et lisibles
    - ❌ Plus de travail initial
    - ❌ Maintenance des 3 formats de shell

**Décision** : ✅ **Implémentation custom** - Approche retenue car elle permet un contrôle total sans dépendances supplémentaires. Les scripts générés sont simples, lisibles et maintenables.

---

### Format de sortie

**Question** : Comment l'utilisateur obtient-il le script d'autocomplete?

**Options** :

1. Output direct vers stdout : `forge completion bash > ~/.forge-completion.bash`
2. Écriture dans un fichier temporaire avec affichage du path
3. Commande interactive avec proposition d'installation

**Décision** : Option 1 (stdout)

---

### Récupération des features disponibles

**Question** : Comment obtenir la liste des features pour `forge merge <TAB>`?

**Options** :

1. Parser le système de fichiers (.features/worktrees/)
2. Parser les branches git (git branch | grep feature/)
3. Réutiliser la logique existante de FeatureCommands.list()

**Décision** : ✅ **Option hybride** - Dans TypeScript, on réutilise la logique (readdir sur worktreesRoot) de FeatureCommands. Dans les scripts shell, on fait un simple `find` sur le worktreesRoot pour performance. Pas besoin d'appeler la CLI depuis le shell, ça serait trop lent.

---

### Installation automatique

**Question** : Doit-on proposer une installation automatique dans .bashrc/.zshrc?

**Décision** : Non (défini comme non-objectif). L'utilisateur doit manuellement sourcer le script. On fournit juste les instructions.

---

## Priorité des shells

**Décision** : Ordre d'implémentation

1. Bash (le plus courant)
2. Zsh (très populaire, notamment sur macOS)
3. Fish (moderne mais moins répandu)

---

## Structure de commande

**Décision** : Commande `forge completion <shell>` avec:

- Argument obligatoire `<shell>` : bash | zsh | fish
- Output vers stdout
- Message d'aide envoyé sur stderr pour ne pas polluer le script

---

## Décisions issues des réponses aux questions

### Performance de la lecture des features

**Question** : L'opération de listage des features pour `forge merge <TAB>` peut-elle être lente?

**Décision** : Pas de problème si on regarde dans worktreesRoot sans regarder réellement les branches git. Approche filesystem directe suffisante.

---

### Compatibilité versions de shell

**Question** : Y a-t-il des différences importantes entre les versions de bash/zsh?

**Décision** : Partir sur les versions à jour, ne pas se prendre la tête avec la rétrocompatibilité. Focus sur bash 4+, zsh 5+.

---

### Support Commander.js

**Question** : Commander.js a-t-il un support natif pour l'autocomplete?

**Décision** : ✅ **Non, Commander.js ne fournit pas de support natif pour l'autocomplete**. C'est pourquoi on génère des scripts shell natifs qui utilisent les mécanismes d'autocomplete de chaque shell (complete pour bash, compdef pour zsh, complete pour fish).

---

### Gestion des erreurs

**Question** : Que se passe-t-il si `.feat-forge.json` n'existe pas quand on fait `forge merge <TAB>`?

**Décision** : ✅ **Le script d'autocomplete doit gérer ce cas gracieusement** (pas d'erreur visible à l'utilisateur). Implémenté via :

1. Variable d'environnement `FORGE_WORKTREES_ROOT` avec fallback sur "features"
2. Redirection stderr vers /dev/null dans les commandes find (2>/dev/null)
3. Dans le CLI TypeScript, création d'un fallback config avec valeurs par défaut si pas de .feat-forge.json

---

## Décisions d'implémentation finales (2026-02-05)

### Architecture du code

**Décision** : Classe `CompletionCommands` qui hérite de `AbstractCommands` pour réutiliser le contexte config, comme les autres commandes.

### Réutilisation des utilitaires existants

**Décision** :

- Utiliser `pathExists()` de `lib/fs.ts` pour vérifier l'existence des répertoires
- Utiliser `readdir()` avec `{ withFileTypes: true }` comme dans `FeatureCommands`
- Suivre le pattern de gestion d'erreur try/catch avec retour de tableau vide

### Gestion des types TypeScript

**Décision** :

- Import explicite de `Dirent` depuis `'fs'` (pas depuis `'fs/promises'`)
- Typage explicite des paramètres de callback pour éviter les erreurs "implicitly any type"
- Export du type `ShellType` pour validation dans cli.ts

### Intégration CLI sans config

**Décision** : La commande `completion` doit fonctionner même sans `.feat-forge.json` pour permettre l'autocomplete avant l'initialisation du projet. Implémenté avec un fallback config minimal.

### Format des scripts d'autocomplete

**Décision** :

- **Bash** : Fonction `_forge_completion` avec `complete -F`
- **Zsh** : Fonction `_forge` avec `#compdef forge` et `_arguments`
- **Fish** : Fonctions helper `__forge_features` et directives `complete -c`

### Instructions d'installation

**Décision** : Afficher 3 options pour chaque shell après la génération :

1. Source direct dans la session courante (test rapide)
2. Ajout au fichier rc (~/.bashrc, ~/.zshrc) (permanent)
3. Installation dans le répertoire de completions système/utilisateur (recommandé)
