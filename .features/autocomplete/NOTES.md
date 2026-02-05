# Notes et références

## UX et documentation

### Messages d'instructions
Quelles instructions exactes afficher après `forge completion bash`?
Exemple:
```
# Bash completion generated!
# To enable, run:
#   forge completion bash > ~/.forge-completion.bash
#   echo 'source ~/.forge-completion.bash' >> ~/.bashrc
#   source ~/.bashrc
```

### Shell non supporté
Que retourner si l'utilisateur demande `forge completion powershell`?
→ Message d'erreur clair avec liste des shells supportés

---

## Considérations futures

### Autocomplete des slugs de features
Pourrait-on autocomplete les slugs existants dans d'autres commandes?
Exemple: `forge feature resume <TAB>` → liste des features archivées
→ Pourrait être une amélioration future si la feature actuelle fonctionne bien

### Cache des suggestions
Faut-il implémenter un cache pour éviter de relire le filesystem à chaque TAB?
→ Probablement pas nécessaire initialement, à mesurer en conditions réelles

### Support de Windows
Bash sur Windows (WSL/Git Bash) devrait-il être supporté?
→ Oui, si on génère du bash standard, ça devrait fonctionner

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
