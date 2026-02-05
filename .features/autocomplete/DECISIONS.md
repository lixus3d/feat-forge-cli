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

**Décision** : Utiliser la bibliothèque existante la plus répandue et la mieux maintenue

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

**Décision** : Option 3 - Réutiliser la logique existante, voir si possibilité de mettre du code en commun sur la découverte des dossiers dans le worktreesRoot

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

**Décision** : À vérifier dans la documentation de Commander.js lors de l'implémentation (Phase 1).

---

### Gestion des erreurs
**Question** : Que se passe-t-il si `.feat-forge.json` n'existe pas quand on fait `forge merge <TAB>`?

**Décision** : Le script d'autocomplete doit gérer ce cas gracieusement (pas d'erreur visible à l'utilisateur).
