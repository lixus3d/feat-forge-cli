# Feature: Refactoring et simplification du code des commandes

## Objectif

Améliorer la maintenabilité et la lisibilité du code en refactorisant les fonctions trop longues, en optimisant l'utilisation de `this.config`, en éliminant la duplication de code, et en simplifiant la gestion de la configuration dans les classes de commandes.

---

## Fonctionnalités

### 1. Simplification de la gestion de la configuration

- Supprimer la méthode `ensureConfig()` de la classe `AbstractCommands`
- Rendre le paramètre `config` obligatoire (non optionnel) dans le constructeur
- Permettre l'utilisation directe de `this.config` dans toutes les classes dérivées
- Éliminer les passages de `config` comme paramètre vers des fonctions privées

### 2. Découpage des fonctions longues

- Identifier toutes les fonctions de plus de 50 lignes dans les fichiers `commands/*.ts`
- Découper ces fonctions en sous-fonctions avec des responsabilités claires
- Ajouter des docblocks JSDoc descriptifs pour chaque nouvelle fonction
- Ajouter des commentaires explicatifs avant chaque appel de fonction pour la clarté du flux

### 3. Réduction de la duplication de code

- Identifier les patterns de code répétés (ex: vérifications d'état, validations)
- Créer des fonctions utilitaires réutilisables avec docblocks
- Remplacer le code dupliqué par des appels à ces fonctions utilitaires
- Privilégier des fonctions avec des noms descriptifs pour améliorer la lecture

---

## Critères d'acceptation

### Configuration obligatoire

- [ ] La méthode `ensureConfig()` n'existe plus dans `AbstractCommands`
- [ ] Le constructeur de `AbstractCommands` accepte `config: ForgeContext` (obligatoire)
- [ ] Tous les appels à `this.ensureConfig()` sont remplacés par l'accès direct à `this.config`
- [ ] Les fonctions privées n'acceptent plus de paramètre `config` lorsqu'elles peuvent accéder à `this.config`

### Fonctions courtes et bien documentées

- [ ] Aucune fonction dans `commands/*.ts` ne dépasse 50 lignes (hors docblock)
- [ ] Toutes les nouvelles fonctions ont un docblock JSDoc complet
- [ ] Les commentaires avant les appels de fonction expliquent le "pourquoi" pas le "comment"
- [ ] Les noms de fonctions sont descriptifs et reflètent leur responsabilité unique

### Code non dupliqué

- [ ] Les vérifications courantes (ex: `pathExists`, `gitBranchExists`, `repoNames.get()`) sont extraites en fonctions utilitaires
- [ ] Les patterns de validation répétés sont centralisés
- [ ] Au moins 3-5 fonctions utilitaires réutilisables sont créées
- [ ] Le code résultant est plus DRY (Don't Repeat Yourself)

### Qualité générale

- [ ] Le code compile sans erreur TypeScript
- [ ] Tous les tests existants (si présents) passent
- [ ] Le comportement fonctionnel reste inchangé
- [ ] La structure des fichiers reste cohérente

---

## Non-objectifs

- **Refactoring de la logique métier** : on ne change pas le comportement ou les règles métier, uniquement la structure du code
- **Ajout de nouvelles fonctionnalités** : cette feature se concentre uniquement sur le refactoring du code existant
- **Refactoring du dossier `lib/`** : cette feature se concentre sur `commands/*.ts` (le `lib/` pourra être traité dans une autre feature)
- **Tests unitaires** : l'ajout de tests est hors scope, mais le code doit rester testable
- **Performance** : l'optimisation des performances n'est pas l'objectif principal (sauf si une amélioration évidente apparaît)
- **Documentation externe** : on se concentre sur les docblocks, pas sur une documentation utilisateur
