# TODO

## Phase 1 : Recherche et architecture
- [ ] Analyser comment Commander.js gère l'autocomplete (built-in ou custom)
- [ ] Étudier les formats de scripts d'autocomplete pour bash, zsh, fish
- [ ] Identifier les bibliothèques existantes (omelette, tabtab, etc.) et choisir l'approche
- [ ] Définir la structure de données pour les suggestions contextuelles

## Phase 2 : Implémentation commande completion
- [ ] Créer `src/commands/completion.ts` avec la classe CompletionCommands
- [ ] Implémenter la génération de script bash completion
- [ ] Implémenter la génération de script zsh completion
- [ ] Implémenter la génération de script fish completion
- [ ] Ajouter les instructions d'installation après génération

## Phase 3 : Logique contextuelle
- [ ] Créer fonction helper pour lister les features disponibles (pour merge)
- [ ] Créer fonction helper pour lister les commandes et sous-commandes
- [ ] Implémenter la logique pour détecter le contexte de la commande en cours
- [ ] Gérer les cas où forge.config.json n'existe pas (init seulement)

## Phase 4 : Génération des scripts d'autocomplete
- [ ] Créer template pour bash avec completion pour toutes les commandes
- [ ] Créer template pour zsh avec completion pour toutes les commandes
- [ ] Créer template pour fish avec completion pour toutes les commandes
- [ ] S'assurer que les scripts gèrent les erreurs gracieusement

## Phase 5 : Tests et documentation
- [ ] Tester manuellement dans bash avec le script généré
- [ ] Tester manuellement dans zsh avec le script généré
- [ ] Tester manuellement dans fish avec le script généré
- [ ] Documenter la commande dans README.md
- [ ] Ajouter des exemples d'utilisation

## Phase 6 : Améliorations
- [ ] Optimiser les performances (cache des features disponibles?)
- [ ] Ajouter des messages d'erreur clairs si le shell n'est pas supporté
- [ ] Considérer un flag --install pour installation automatique (non-objectif initial)
