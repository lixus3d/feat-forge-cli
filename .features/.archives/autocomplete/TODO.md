# TODO

## Phase 1 : Recherche et architecture ✅
- [x] Analyser comment Commander.js gère l'autocomplete (built-in ou custom) - Commander.js ne fournit pas d'autocomplete natif
- [x] Étudier les formats de scripts d'autocomplete pour bash, zsh, fish - Scripts natifs du shell
- [x] Identifier les bibliothèques existantes (omelette, tabtab, etc.) et choisir l'approche - Pas de bibliothèque, scripts natifs générés
- [x] Définir la structure de données pour les suggestions contextuelles - Répertoires de features via readdir

## Phase 2 : Implémentation commande completion ✅
- [x] Créer `src/commands/completion.ts` avec la classe CompletionCommands
- [x] Implémenter la génération de script bash completion
- [x] Implémenter la génération de script zsh completion
- [x] Implémenter la génération de script fish completion
- [x] Ajouter les instructions d'installation après génération

## Phase 3 : Logique contextuelle ✅
- [x] Créer fonction helper pour lister les features disponibles (pour merge) - `getAvailableFeatures()` privée
- [x] Créer fonction helper pour lister les commandes et sous-commandes - Intégré dans les templates de scripts
- [x] Implémenter la logique pour détecter le contexte de la commande en cours - Géré nativement par les scripts shell
- [x] Gérer les cas où forge.config.json n'existe pas (init seulement) - Fallback config avec valeurs par défaut

## Phase 4 : Génération des scripts d'autocomplete ✅
- [x] Créer template pour bash avec completion pour toutes les commandes
- [x] Créer template pour zsh avec completion pour toutes les commandes
- [x] Créer template pour fish avec completion pour toutes les commandes
- [x] S'assurer que les scripts gèrent les erreurs gracieusement - try/catch + fallback + 2>/dev/null dans les scripts

## Phase 5 : Tests et documentation 🚧
- [x] Tester la compilation TypeScript
- [x] Tester la génération des trois types de scripts (bash, zsh, fish)
- [x] Tester la validation des shells supportés
- [ ] Tester manuellement dans bash avec le script généré (source <(forge completion bash))
- [ ] Tester manuellement dans zsh avec le script généré (source <(forge completion zsh))
- [ ] Tester manuellement dans fish avec le script généré (forge completion fish | source)
- [ ] Documenter la commande dans README.md
- [ ] Ajouter des exemples d'utilisation

## Phase 6 : Améliorations ⏸️
- [x] Ajouter des messages d'erreur clairs si le shell n'est pas supporté
- [ ] Optimiser les performances (cache des features disponibles?) - Non nécessaire pour l'instant
- [ ] Considérer un flag --install pour installation automatique (non-objectif initial)

