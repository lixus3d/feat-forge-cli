# DECISIONS

## Décisions architecturales

### Config obligatoire dans AbstractCommands

**Décision** : Rendre le paramètre `config` obligatoire dans le constructeur de `AbstractCommands` et supprimer `ensureConfig()`.

**Justification** :
- Simplifie le code en évitant les vérifications répétées de nullabilité
- Rend explicite le fait que toutes les commandes nécessitent une configuration
- Permet l'utilisation directe de `this.config` sans `await` inutile
- Cohérent avec le pattern "dependency injection" - la config est une dépendance

**Impact** :
- Toutes les classes dérivées doivent passer `config` dans leur constructeur
- Le `cli.ts` doit gérer l'absence de config avant d'instancier les commandes
- Plus de code asynchrone pour simplement accéder à la config

**Alternative rejetée** : Garder `ensureConfig()` pour le lazy loading
- Cons: complexité inutile, chaque méthode doit l'appeler
- Cons: rend le code plus verbeux (`const config = await this.ensureConfig()`)

---

### Limite de 50 lignes par fonction

**Décision** : Fixer une limite de 50 lignes (hors docblock) par fonction.

**Justification** :
- Améliore la lisibilité et la compréhension du code
- Force la décomposition en responsabilités claires
- Facilite les tests et le débogage
- Standard industriel généralement accepté

**Application** :
- Les fonctions dépassant 50 lignes doivent être découpées
- Exception possible pour des switch/case très simples ou des mappings
- Les docblocks ne comptent pas dans la limite

---

### Placement des fonctions utilitaires

**Décision** : Créer des fonctions utilitaires privées dans les classes de commandes pour éviter la duplication.

**Options considérées** :
1. **Fonctions privées dans les classes** (choisi)
   - Pro: portée limitée, pas de pollution de namespace
   - Pro: facile à refactorer vers `lib/` si nécessaire plus tard
   - Con: pas réutilisable entre classes différentes

2. Fonctions dans `lib/validation.ts` ou similaire
   - Pro: réutilisable partout
   - Con: hors scope de cette feature (on se concentre sur `commands/`)
   - Con: nécessite plus d'analyse pour identifier le bon module

**Compromis** : On commence par des fonctions privées. Si on identifie qu'elles sont nécessaires dans plusieurs classes, on note cela dans NOTES.md pour une future refactorisation.

---

### Style de documentation

**Décision** : Utiliser JSDoc avec le format suivant :
- Description courte sur une ligne
- Ligne vide
- Description détaillée si nécessaire (2-4 lignes max)
- `@param` pour chaque paramètre avec description
- `@returns` pour la valeur de retour
- `@throws` si la fonction peut lever des exceptions

**Exemple** :
```typescript
/**
 * Retrieve the repository name for a given root path.
 *
 * Looks up the repository name from the repoNames map and throws
 * a descriptive error if not found.
 *
 * @param repoNames - Map of repository root paths to names
 * @param repoRoot - Root path of the repository
 * @returns The repository name
 * @throws Error if repository name is not found in the map
 */
private getRepoNameOrThrow(repoNames: Map<string, string>, repoRoot: string): string {
    // ...
}
```

---

### Gestion de l'absence de config dans cli.ts

**Décision** : Le `cli.ts` doit charger la config une seule fois et la passer aux commandes qui en ont besoin.

**Stratégie** :
- Commandes qui n'ont pas besoin de config: `init` (créer la config)
- Toutes les autres commandes nécessitent la config
- Si la config ne peut pas être chargée, afficher un message clair demandant de lancer `forge init`

**Code pattern** :
```typescript
if (!isInitCommand) {
    try {
        config = await loadForgeConfig();
    } catch (error) {
        console.error('No .feat-forge.json found. Run "forge init" to create one.');
        process.exit(1);
    }
}
```
