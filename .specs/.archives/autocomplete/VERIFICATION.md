# Guide de vérification - Autocomplete

## Tests déjà effectués ✅

1. **Compilation TypeScript** : `pnpm run build` → ✅ Succès
2. **Commande help** : `forge --help` → ✅ Commande visible
3. **Génération bash** : `forge completion bash` → ✅ Script valide généré
4. **Génération zsh** : `forge completion zsh` → ✅ Script valide généré
5. **Génération fish** : `forge completion fish` → ✅ Script valide généré
6. **Shell non supporté** : `forge completion powershell` → ✅ Erreur claire affichée

## Tests manuels à effectuer

### Test 1 : Bash (sur WSL/Ubuntu)

```bash
# 1. Sourcer le script de completion
source <(forge completion bash)

# 2. Tester l'autocomplete des commandes principales
forge <TAB>
# Devrait afficher/cycler : init feature mode agent merge completion

# 3. Tester l'autocomplete des sous-commandes feature
forge feature <TAB>
# Devrait afficher/cycler : create start stop list resync archive merge

# 4. Tester l'autocomplete des sous-commandes mode
forge mode <TAB>
# Devrait afficher/cycler : spec code

# 5. Tester l'autocomplete des sous-commandes agent
forge agent <TAB>
# Devrait afficher : refresh

# 6. Si des features existent, tester l'autocomplete des slugs
forge merge <TAB>
# Devrait afficher les slugs de features disponibles dans le répertoire features/

# 7. Même chose avec la commande feature merge
forge feature merge <TAB>
# Devrait afficher les slugs de features disponibles
```

### Test 2 : Zsh (si disponible)

```zsh
# 1. Sourcer le script
source <(forge completion zsh)

# 2. Tests identiques à bash
forge <TAB>
forge feature <TAB>
forge mode <TAB>
forge agent <TAB>
forge merge <TAB>

# 3. Vérifier les descriptions (zsh les affiche)
# Les descriptions doivent apparaître à côté des commandes
```

### Test 3 : Fish (si disponible)

```fish
# 1. Sourcer le script
forge completion fish | source

# 2. Tests identiques
forge <TAB>
forge feature <TAB>
forge mode <TAB>
forge agent <TAB>
forge merge <TAB>

# 3. Vérifier les descriptions fish
# Fish affiche les descriptions de manière native
```

### Test 4 : Completion contextuelle des slugs

Si vous avez un projet forge initialisé avec des features :

```bash
# Créer quelques features de test
forge feature create test-feature-1
forge feature create test-feature-2
forge feature create test-feature-3

# Sourcer la completion
source <(forge completion bash)

# Tester l'autocomplete
forge merge <TAB>
# Devrait proposer : test-feature-1 test-feature-2 test-feature-3

forge feature stop <TAB>
# Devrait proposer : test-feature-1 test-feature-2 test-feature-3
```

### Test 5 : Sans configuration .feat-forge.json

```bash
# Dans un répertoire sans .feat-forge.json
cd /tmp/test-forge-completion

# Générer le script de completion devrait fonctionner
forge completion bash
# Devrait générer le script avec succès (utilise fallback config)

# Sourcer et tester
source <(forge completion bash)
forge <TAB>
# Devrait au moins proposer "init" et "completion"
```

## Critères d'acceptation à valider

- [ ] L'utilisateur peut taper `forge <TAB>` et voir/cycler toutes les commandes disponibles
- [ ] L'utilisateur peut taper `forge merge <TAB>` et voir la liste des features disponibles à merger
- [ ] L'utilisateur peut taper `forge feature <TAB>` et voir toutes les sous-commandes de feature
- [ ] Les suggestions d'autocomplete sont pertinentes au contexte (ex: seulement les features existantes pour merge)
- [ ] La commande `forge completion bash` génère un script valide pour bash
- [ ] La commande `forge completion zsh` génère un script valide pour zsh
- [ ] La commande `forge completion fish` génère un script valide pour fish
- [ ] Les instructions d'installation sont affichées après génération du script
- [ ] L'autocomplete fonctionne correctement après avoir sourcé le script généré

## Problèmes potentiels et solutions

### Problème : L'autocomplete ne fonctionne pas

**Solutions** :

1. Vérifier que le script a bien été sourcé : `type _forge_completion` (bash) ou `which _forge` (zsh)
2. Vérifier que bash-completion est installé : `apt-get install bash-completion` (Ubuntu/Debian)
3. Pour zsh, vérifier que `compinit` est appelé dans `.zshrc`
4. Recharger le shell : `exec bash` ou `exec zsh`

### Problème : Les features ne sont pas listées

**Solutions** :

1. Vérifier que le répertoire worktrees existe : `ls -la features/`
2. Définir la variable d'environnement : `export FORGE_WORKTREES_ROOT="chemin/vers/features"`
3. Vérifier les permissions du répertoire : `ls -ld features/`

### Problème : Erreurs visibles lors de l'autocomplete

**Solutions** :

1. Vérifier que les commandes dans le script sont disponibles : `which find`, `which basename`
2. Les erreurs devraient être redirigées vers /dev/null, vérifier le script généré

## Installation permanente (après validation)

### Bash

```bash
# Ajouter à ~/.bashrc
echo 'source <(forge completion bash)' >> ~/.bashrc
source ~/.bashrc
```

### Zsh

```bash
# Ajouter à ~/.zshrc
echo 'source <(forge completion zsh)' >> ~/.zshrc
source ~/.zshrc
```

### Fish

```fish
# Sauvegarder dans le répertoire de completions
forge completion fish > ~/.config/fish/completions/forge.fish
# Redémarrer fish ou ouvrir un nouveau terminal
```
