# Notes et références

## ✅ Implémentation terminée (2026-02-05)

### Points d'attention pour les tests manuels
1. **Bash** : Tester avec `source <(forge completion bash)` puis `forge <TAB>`, `forge feature <TAB>`, `forge merge <TAB>`
2. **Zsh** : Vérifier que `compinit` est activé dans .zshrc avant de tester
3. **Fish** : Les fonctions fish doivent être dans `~/.config/fish/completions/` ou sourcées

### Variable d'environnement
- `FORGE_WORKTREES_ROOT` : Permet de surcharger le chemin par défaut "features" pour la complétion des slugs
- Utile si l'utilisateur a configuré un autre chemin dans `.feat-forge.json`

### Limitations connues
- Les scripts ne gèrent pas l'autocomplete des options longues (--help, --version, etc.) car non requis dans les critères d'acceptation
- Les scripts ne font pas d'appel à la CLI forge pour récupérer la liste des features (pour des raisons de performance)
- La complétion des slugs se base uniquement sur les répertoires existants dans worktreesRoot

---

## UX et documentation

### Messages d'instructions ✅
Instructions complètes affichées après `forge completion <shell>` incluant :
- Source direct dans session courante
- Ajout permanent au fichier rc
- Installation dans répertoire de completions système

### Shell non supporté ✅
Message d'erreur explicite avec liste des shells supportés : bash, zsh, fish


---

## Considérations futures

### Autocomplete des slugs de features ✅
Implémenté ! Les slugs sont auto-complétés pour :
- `forge merge <slug>`
- `forge feature merge <slug>`
- `forge feature create/start/stop/resync/archive <slug>`

### Cache des suggestions ⏸️
Pas implémenté car :
- La lecture du filesystem est suffisamment rapide
- Les scripts shell sont très légers
- Pas de problème de performance identifié

### Support de Windows ✅
Les scripts bash générés sont compatibles avec :
- WSL (Windows Subsystem for Linux)
- Git Bash
- Toute implémentation bash standard sur Windows


---

## Références techniques

### Exemples de completion existants
- Git: `/usr/share/bash-completion/completions/git`
- npm: `npm completion`
- yarn: Scripts de completion dans le repo

### Format bash completion
```bash
_forge_completion() {
    local cur prev
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Logic here
}
complete -F _forge_completion forge
```

### Format zsh completion
```zsh
#compdef forge

_forge() {
    # Logic here
}

_forge
```

### Format fish completion
```fish
# Basic structure
complete -c forge -n '__fish_use_subcommand' -a 'init feature mode agent merge'
complete -c forge -n '__fish_seen_subcommand_from feature' -a 'create start stop'
```

---

## Détails d'implémentation suggérés

### Structure du script bash
Le script devrait:
1. Détecter la position du curseur (COMP_CWORD)
2. Récupérer le mot précédent (COMP_WORDS[COMP_CWORD-1])
3. Selon le contexte, générer les suggestions appropriées
4. Utiliser COMPREPLY pour retourner les suggestions

### Exemple pour `forge merge <TAB>`
```bash
if [[ "$prev" == "merge" ]]; then
    # List available features
    local features=$(forge feature list --format=simple 2>/dev/null | awk '{print $1}')
    COMPREPLY=( $(compgen -W "$features" -- "$cur") )
    return 0
fi
```

### Gestion des cas d'erreur
- Si forge n'est pas initialisé (pas de config), retourner seulement "init"
- Si la commande échoue, retourner une liste vide plutôt qu'une erreur
- Toutes les erreurs doivent être redirigées vers /dev/null dans le script

---

## Métriques de succès

Comment mesurer si la feature est réussie?
- Temps de réponse de l'autocomplete < 200ms
- Taux d'erreur 0% (pas de crash du shell)
- Feedback positif des utilisateurs
- Réduction des erreurs de frappe dans les commandes
