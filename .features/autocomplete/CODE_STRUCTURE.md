# Structure du code - Autocomplete Feature

## Arborescence des fichiers

```
feat-forge-cli/
├── src/
│   ├── cli.ts                      ← Modifié : intégration completion
│   ├── commands/
│   │   ├── abstract.ts
│   │   ├── agent.ts
│   │   ├── completion.ts           ← NOUVEAU : commande autocomplete
│   │   ├── feature.ts
│   │   ├── init.ts
│   │   ├── merge.ts
│   │   └── mode.ts
│   └── lib/
│       ├── agents.ts
│       ├── config.ts
│       ├── feature.ts
│       ├── fs.ts                   ← Utilisé : pathExists, readdir
│       ├── git.ts
│       ├── ide.ts
│       ├── mode.ts
│       ├── paths.ts
│       ├── prompt.ts
│       ├── slug.ts
│       └── templates.ts
└── .active-feature/
    ├── FEATURE.md
    ├── TODO.md                     ← Mis à jour avec statut
    ├── DECISIONS.md                ← Mis à jour avec décisions finales
    ├── NOTES.md                    ← Mis à jour avec notes d'implémentation
    ├── IMPLEMENTATION.md           ← NOUVEAU : doc d'implémentation
    └── VERIFICATION.md             ← NOUVEAU : guide de test
```

## Diagramme de flux - Génération de script

```
┌─────────────────────────────────────┐
│  Utilisateur : forge completion bash │
└──────────────┬──────────────────────┘
               │
               v
┌──────────────────────────────────────────────┐
│  cli.ts : registerCompletionCommands()       │
│  - Valide le type de shell                   │
│  - Charge config ou utilise fallback         │
└──────────────┬───────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────┐
│  CompletionCommands.generate(shell)          │
│  - Génère le script                          │
│  - Affiche sur stdout                        │
│  - Affiche instructions sur stderr           │
└──────────────┬───────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────┐
│  generateCompletionScript(shell)             │
│  - Délègue vers la méthode appropriée       │
└──────────────┬───────────────────────────────┘
               │
      ┌────────┴────────┬────────┐
      v                 v        v
┌─────────────┐  ┌──────────┐  ┌─────────────┐
│ Bash script │  │Zsh script│  │ Fish script │
└─────────────┘  └──────────┘  └─────────────┘
```

## Diagramme de flux - Autocomplete en action

```
Utilisateur tape : forge merge <TAB>
                          │
                          v
┌─────────────────────────────────────────────┐
│  Script shell (bash/zsh/fish) s'exécute     │
│  - Détecte la commande "merge"              │
│  - Cherche les features disponibles         │
└──────────────┬──────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────┐
│  find "${FORGE_WORKTREES_ROOT:-features}"    │
│    -mindepth 1 -maxdepth 1 -type d           │
│    -exec basename {} \; 2>/dev/null          │
└──────────────┬───────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────┐
│  Liste des features retournée au shell       │
│  Ex: feature-1 feature-2 feature-3           │
└──────────────┬───────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────┐
│  Shell affiche les suggestions               │
│  forge merge feature-1                       │
│              feature-2                       │
│              feature-3                       │
└──────────────────────────────────────────────┘
```

## Hiérarchie des classes

```
AbstractCommands (abstract class)
│
├── AgentCommands
├── FeatureCommands
├── MergeCommands
├── ModeCommands
└── CompletionCommands  ← NOUVEAU
    │
    ├── generate(shell: ShellType): Promise<void>
    │   └── PUBLIC : Point d'entrée principal
    │
    ├── generateCompletionScript(shell): Promise<string>
    │   └── PRIVATE : Router vers la méthode appropriée
    │
    ├── getAvailableFeatures(): Promise<string[]>
    │   └── PRIVATE : Helper pour lister les features
    │
    ├── generateBashCompletion(): string
    │   └── PRIVATE : Template bash
    │
    ├── generateZshCompletion(): string
    │   └── PRIVATE : Template zsh
    │
    ├── generateFishCompletion(): string
    │   └── PRIVATE : Template fish
    │
    └── displayInstallationInstructions(shell): void
        └── PRIVATE : Affiche les instructions
```

## Dépendances et réutilisations

```
CompletionCommands
│
├── Hérite de : AbstractCommands
│   └── Accède à : this.config (ForgeContext)
│
├── Utilise de lib/fs.ts :
│   ├── pathExists(path)
│   └── readdir(path, { withFileTypes: true })
│
├── Utilise de fs :
│   └── Dirent (type pour readdir)
│
└── Exporte :
    └── ShellType = 'bash' | 'zsh' | 'fish'
```

## Patterns et conventions respectés

### 1. Structure de classe standard
```typescript
export class CompletionCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    async generate(shell: ShellType): Promise<void> { ... }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    private async getAvailableFeatures(): Promise<string[]> { ... }
    private generateBashCompletion(): string { ... }
    // ...
}
```

### 2. DocBlocks sur toutes les méthodes
```typescript
/**
 * Generate and display shell completion script for the specified shell.
 *
 * @param shell - The target shell type (bash, zsh, or fish)
 */
async generate(shell: ShellType): Promise<void>
```

### 3. Gestion d'erreurs gracieuse
```typescript
private async getAvailableFeatures(): Promise<string[]> {
    try {
        if (!(await pathExists(this.config.worktreesRoot))) {
            return [];
        }
        // ... logique
    } catch {
        return [];  // Pas d'erreur visible à l'utilisateur
    }
}
```

### 4. Typage explicite TypeScript
```typescript
const entries: Dirent[] = await readdir(this.config.worktreesRoot, { withFileTypes: true });
return entries
    .filter((entry: Dirent) => entry.isDirectory())
    .map((entry: Dirent) => entry.name)
    .sort();
```

## Commandes disponibles

### Nouvelle commande ajoutée
```bash
forge completion <shell>    # Génère le script d'autocomplete
```

### Shells supportés
- `bash` - Bourne Again Shell
- `zsh` - Z Shell
- `fish` - Friendly Interactive Shell

### Exemple d'utilisation
```bash
# Génération et utilisation directe
source <(forge completion bash)

# Sauvegarde dans un fichier
forge completion zsh > ~/.zsh/completions/_forge

# Installation Fish
forge completion fish > ~/.config/fish/completions/forge.fish
```

## Variables d'environnement

### FORGE_WORKTREES_ROOT
```bash
# Définir un chemin personnalisé pour les features
export FORGE_WORKTREES_ROOT="/custom/path/to/features"

# Utilisation dans les scripts d'autocomplete
find "${FORGE_WORKTREES_ROOT:-features}" -type d
#                              ^^^^^^^^ fallback par défaut
```

## Statistiques

- **Lignes de code ajoutées** : ~420 lignes (completion.ts)
- **Fichiers modifiés** : 1 (cli.ts)
- **Fichiers créés** : 1 (completion.ts)
- **Nouvelles dépendances** : 0 (utilise uniquement Node.js built-ins)
- **Fonctions utilitaires réutilisées** : 2 (pathExists, readdir)
- **Scripts générés** : 3 (bash, zsh, fish)
