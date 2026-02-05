# Questions ouvertes

## Analyse du code existant

### Fonctions longues identifiées (> 50 lignes)

#### commands/feature.ts
- `start()` : ~70 lignes - gère la création des worktrees et IDE workspaces
- `stop()` : ~80 lignes - gère le nettoyage des worktrees avec différentes stratégies
- `archive()` : ~90 lignes - gère l'archivage avec worktree temporaire
- `list()` : ~60 lignes - liste et formate les features avec détection d'incohérences
- `resync()` : ~60 lignes - resynchronise les branches avec gestion d'erreurs
- `initSpecInBranch()` : ~50 lignes - initialise les specs dans un worktree temporaire

#### commands/merge.ts
- Déjà bien découpé grâce au refactoring précédent ✅
- Toutes les fonctions < 50 lignes

#### commands/agent.ts, init.ts, mode.ts
- Déjà courts ✅
- Pas de refactoring nécessaire au niveau taille

### Patterns de duplication identifiés

#### 1. Récupération du nom de repo avec vérification
```typescript
// Pattern répété ~15 fois dans feature.ts et merge.ts
const repoName = repoNames.get(repoRoot);
if (!repoName) {
    throw new Error(`Missing repo name for ${repoRoot}`);
}
```

**Solution proposée** : Fonction utilitaire `getRepoNameOrThrow()`

#### 2. Vérification d'existence de worktree
```typescript
// Pattern répété ~10 fois
if (await pathExists(worktreePath)) {
    // ...
}
```

**Solution proposée** : Peut rester tel quel (trop simple pour extraire), mais documenter le pattern

#### 3. Vérification de worktree "propre" (sans changements)
```typescript
// Pattern répété ~5 fois
const status = await getGitStatusPorcelain(worktreePath);
if (status) {
    throw new Error(`Working tree is not clean in ${repoName}`);
}
```

**Solution proposée** : Fonction `ensureCleanWorktree()` ou `verifyWorktreeIsClean()`

#### 4. Construction de liste de worktrees
```typescript
// Pattern répété ~3 fois avec variations
const worktrees = repoRoots.map((repoRoot) => {
    const repoName = repoNames.get(repoRoot);
    if (!repoName) throw new Error(...);
    return getFeatureWorktreePath(worktreesRoot, slug, repoName);
});
```

**Solution proposée** : Fonction `buildWorktreeList()` ou similaire

---

## Observations et risques

### Impact du changement de config obligatoire

**Files impactés** :
- `commands/abstract.ts` : définition de la classe
- `commands/feature.ts` : 5 appels à `ensureConfig()`
- `commands/merge.ts` : 2 appels à `ensureConfig()`
- `commands/agent.ts` : 1 appel à `ensureConfig()`
- `commands/mode.ts` : 1 appel à `ensureConfig()`
- `cli.ts` : instanciation des commandes

**Risque** : Si la config n'est pas disponible, les commandes ne peuvent plus être instanciées.
- Mitigation: Gérer l'erreur dans `cli.ts` et afficher un message clair

### Compatibilité avec le pattern actuel

Le code utilise déjà un pattern similaire dans les `register*Commands()` :
```typescript
export function registerFeatureCommands(program: Command, config?: ForgeContext): void {
    const handlers = new FeatureCommands(config);
    // ...
}
```

Après refactoring, ce sera simplement :
```typescript
export function registerFeatureCommands(program: Command, config: ForgeContext): void {
    const handlers = new FeatureCommands(config);
    // ...
}
```

### Opportunités d'amélioration future (hors scope)

- Extraire les fonctions utilitaires vers `lib/validation.ts` ou `lib/repo-utils.ts`
- Ajouter des tests unitaires pour les fonctions extraites
- Créer un système de "guards" pour les vérifications communes
- Refactorer `lib/*.ts` avec les mêmes principes

---

## Métriques actuelles (avant refactoring)

### Nombre de lignes par fonction (top 10)

1. `feature.archive()` : ~90 lignes
2. `feature.stop()` : ~80 lignes
3. `feature.start()` : ~70 lignes
4. `feature.list()` : ~60 lignes
5. `feature.resync()` : ~60 lignes
6. `feature.initSpecInBranch()` : ~50 lignes
7. Autres : < 50 lignes ✅

### Nombre d'appels à ensureConfig

- Total : 10 appels
- `feature.ts` : 5
- `merge.ts` : 2
- `agent.ts` : 1
- `mode.ts` : 1
- `abstract.ts` : 1 (définition)

### Nombre de fois où le pattern "repoNames.get()" est utilisé

- Total : ~20 occurrences
- Avec vérification d'erreur : ~15 occurrences
- Pattern identique ou presque identique

---

## Questions à trancher

### Q1: Faut-il permettre un mode "graceful degradation" pour les commandes sans config ?

**Contexte** : Actuellement, si la config n'est pas chargée, les commandes peuvent quand même être instanciées grâce au `config?`.

**Options** :
- **A. Config strictement obligatoire** (recommandé)
  - Pro: plus simple, plus clair
  - Con: commandes non-fonctionnelles si config absente

- **B. Permettre l'absence de config et échouer à l'exécution**
  - Pro: permet d'afficher l'aide même sans config
  - Con: erreurs moins claires (échouent au runtime)

**Recommandation** : Option A - si config absente, `cli.ts` affiche un message et exit avant d'instancier les commandes.

### Q2: Doit-on créer des classes d'erreur personnalisées ?

**Contexte** : Beaucoup de `throw new Error(...)` avec des messages similaires.

**Options** :
- **A. Garder les Error simples** (recommandé pour cette feature)
  - Pro: simple, pas de complexité ajoutée
  - Con: pas de typologie des erreurs

- **B. Créer ConfigNotFoundError, RepoNotFoundError, etc.**
  - Pro: meilleure gestion d'erreur, plus testable
  - Con: hors scope de cette feature

**Recommandation** : Option A pour l'instant, noter dans NOTES que c'est une amélioration future possible.

### Q3: Ordre de refactoring - par phase ou par fichier ?

**Options** :
- **A. Par phase** (recommandé) : D'abord config, puis fonctions utilitaires, puis découpage
  - Pro: changements progressifs, plus facile à valider
  - Con: plus de commits

- **B. Par fichier** : Terminer complètement un fichier avant de passer au suivant
  - Pro: moins de contexte switching
  - Con: risque de casser des choses si on refactor abstract.ts en dernier

**Recommandation** : Option A - suivre les phases de la TODO list.
