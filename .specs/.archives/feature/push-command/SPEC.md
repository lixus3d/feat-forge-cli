# Commande `forge push`

## Contexte

`forge pull` permet de mettre à jour une branche sur l'ensemble des repositories
d'un projet feat-forge. Il n'existe pas d'équivalent pour pousser : l'utilisateur
doit aujourd'hui lancer `git push` repository par repository, avec le risque d'en
oublier un, ou de devoir créer l'upstream à la main lors du premier push.

# Goal

Ajouter une commande `forge push [branch-name]`, symétrique de `forge pull`, qui
pousse une branche sur tous les repositories du projet, en une seule commande,
depuis la racine du projet ou depuis n'importe quel dossier d'un workspace.

Dans le même développement, aligner `forge pull` : lancée depuis la racine du
projet sans argument, elle propose elle aussi la liste des branches actives au
lieu d'échouer.

---

# Feature details

## Commandes exposées

| Commande                         | Argument                   | Équivalent                          |
| -------------------------------- | -------------------------- | ----------------------------------- |
| `forge push [branch-name]`       | optionnel                  | —                                   |
| `forge feature push <feature>`   | obligatoire, sans préfixe  | `forge push <featurePrefix><name>`  |
| `forge fix push <fix>`           | obligatoire, sans préfixe  | `forge push <fixPrefix><name>`      |
| `forge release push <release>`   | obligatoire, sans préfixe  | `forge push <releasePrefix><name>`  |

Option commune : `--force` (voir « Push forcé »).

La commande est déclarée dans `genericBranchTypeCommands` (`src/cli.ts`), comme
`pull`, et ajoutée aux listes `slugSubcommands` / `rootSlugCommands` de la
complétion shell (`CompletionCommands.ts`).

## Résolution de la branche

Ordre de résolution :

1. **Argument fourni** → `confirmSlugOrThrow(rawSlug)`, comme `pull`.
2. **Lancée depuis un dossier d'un workspace** (racine du workspace, un worktree
   ou n'importe quel sous-dossier) → détection automatique via
   `BranchContext.findNearestBranchContext`. Aucune question n'est posée ; le nom
   de la branche détectée est affiché.
3. **Lancée depuis la racine du projet** (ou tout dossier hors workspace) →
   prompt de sélection parmi les **branches actives**
   (`context.loadActiveBranchesContexts()`).
   - Si aucune branche active : message explicite et sortie sans erreur.
   - Si une seule branche active : elle est quand même proposée (pas de
     sélection implicite, push = action sortante).

La branche doit être active (workspace présent). Pousser une branche non active
n'est pas supporté : erreur explicite invitant à faire `forge start`.

Cette résolution est factorisée dans un helper commun (ex.
`resolveBranchNameOrPrompt(rawSlug?)` dans `BranchCommands`), utilisé par `push`
**et** par `pull`.

## Évolution de `forge pull`

Comportement actuel : sans argument hors workspace,
`findNearestBranchContext` lève `ForgeNotInActiveBranchError`.

Nouveau comportement :

- **Argument fourni** → inchangé (y compris le pull d'une branche non active via
  `makeBranchContext`).
- **Depuis un dossier d'un workspace** → inchangé (détection automatique).
- **Depuis la racine du projet / hors workspace** → prompt de sélection parmi
  les branches actives (même helper que `push`). Aucune branche active →
  message clair, sortie sans erreur.
- Le reste de `pull` (`verifyCleanBranch` bloquant, checkout, résumé) est
  inchangé.
- Les variantes `forge feature|fix|release pull <name>` gardent leur argument
  obligatoire : pas de changement.

## Contrôle du worktree non clean

Le push ne nécessite pas un worktree propre (seuls les commits sont poussés).
Mais pour éviter d'oublier des modifications :

1. Avant tout push, collecter l'état de chaque repository de la branche
   (`collectRepositoriesStatus` / `isDirty`).
2. Si au moins un repository est dirty, afficher **un seul** avertissement
   global listant les repositories concernés (avec un résumé type
   `git status --short` : nombre de fichiers modifiés / non suivis).
3. Demander une confirmation (`promptConfirm`, défaut **non**) :
   `Some repositories have uncommitted changes. Push anyway?`
4. Refus → abandon complet, rien n'est poussé, code de sortie 0.

Contrairement à `pull`, on n'utilise pas `verifyCleanBranch` (bloquant).

## Push par repository

Exécution **séquentielle** (logs lisibles, demandes d'authentification
éventuelles l'une après l'autre), comme `pull`. Pour chaque repository :

1. **Vérifier la branche courante du worktree.** Si elle ne correspond pas à la
   branche attendue → le repository est marqué en échec avec un conseil
   (`forge resync <branch>`). Pas de checkout automatique (contrairement à
   `pull`) : on ne change pas l'état d'un worktree potentiellement dirty.
2. **Upstream existant** → `git push`.
3. **Pas d'upstream** (premier push) → `git push -u origin <branch>`, avec un
   message indiquant que la branche distante est créée. Si le remote `origin`
   n'existe pas → échec du repository avec message explicite.
4. **Rien à pousser** (branche à jour avec son upstream) → le repository est
   marqué « up to date » sans appel réseau inutile (ou en laissant git le
   constater), et compte comme un succès.
5. **Rejet non fast-forward** → échec du repository, avec le conseil :
   `forge pull` si la branche distante a avancé, ou `forge push --force` après un
   `forge rebase`.
6. Toute autre erreur git (auth, réseau, hook pre-push…) → échec du repository,
   l'erreur est affichée, les autres repositories continuent.

## Push forcé

- Option `--force` sur toutes les variantes de la commande.
- Traduite en `git push --force-with-lease` (jamais `--force` brut), pour ne pas
  écraser des commits distants poussés par quelqu'un d'autre.
- Confirmation préalable (`promptConfirm`, défaut **non**) rappelant la branche
  et la liste des repositories concernés.
- Cas d'usage principal : après `forge rebase`.

## Résumé final

- Réutiliser `displayOperationSummary` avec un nouveau membre
  `GitOperation.Push = 'push'`.
- Distinguer dans le résumé : poussés, déjà à jour (optionnel, peut être fondu
  dans les succès), branches distantes créées, échecs.
- `process.exitCode = 1` si au moins un repository est en échec.

## Implémentation (indicative)

- `BranchCommands.push(rawSlug?, options?)` — résolution de branche, contrôle
  dirty, boucle sur `branchContext.repositories`, résumé.
- `SubBranchCommands.push(rawSlug, options?)` — ajout du préfixe puis délégation.
- `Repository.push(branch, { force })` → `GitOperationResult`.
- Helpers git éventuels : `hasUpstream(repoPath)`, `aheadBehind(repoPath)`.

# Acceptance criteria

- `forge push` lancé depuis n'importe quel dossier d'un workspace pousse la
  branche du workspace sur tous ses repositories, sans poser de question sur la
  branche.
- `forge push` lancé depuis la racine du projet propose la liste des branches
  actives, puis pousse la branche choisie sur tous ses repositories.
- `forge pull` lancé depuis la racine du projet sans argument propose la liste
  des branches actives et pulle la branche choisie ; depuis un workspace ou avec
  un argument, son comportement est inchangé.
- `forge push <branch>`, `forge feature|fix|release push <name>` fonctionnent
  comme `pull` (même résolution de nom / préfixe), et sont présents dans la
  complétion shell.
- Si au moins un repository est dirty : un avertissement unique liste les
  repositories concernés et demande confirmation ; un refus n'effectue aucun push.
- Un worktree propre ne déclenche aucune question supplémentaire (hors choix de
  branche à la racine et `--force`).
- Une branche sans upstream est poussée avec `-u origin <branch>` et l'upstream
  est configuré.
- Un repository à jour ne provoque pas d'erreur et apparaît comme succès / à jour.
- Un worktree qui n'est pas sur la bonne branche est signalé en échec, sans
  checkout, avec un conseil `resync`.
- `--force` utilise `--force-with-lease` et demande confirmation.
- L'échec d'un repository n'empêche pas le push des autres ; un résumé final est
  affiché et le code de sortie vaut 1 en cas d'échec.
- Aucune branche active depuis la racine → message clair, sortie sans erreur.
- Tests unitaires couvrant : résolution de branche (argument / workspace /
  racine) pour `push` et `pull`, confirmation dirty (accept / refus), premier push (`-u`), à jour,
  mauvaise branche, rejet non fast-forward, `--force-with-lease`.
- README / aide CLI mis à jour.

# Not in the perimeter

- Pousser une branche non active (sans workspace) depuis le repository principal.
- Choix du remote (autre que l'upstream existant ou `origin`) ; option
  `--remote`.
- Push des tags, `--all`, `--mirror`, options git arbitraires en passthrough.
- Push en parallèle des repositories.
- Commit automatique des modifications non commitées (on avertit seulement).
- Sélection d'un sous-ensemble de repositories à pousser.
- Création de pull request / merge request après le push.
- Autres modifications de `forge pull` que le prompt de branche à la racine
  (ex. assouplir le contrôle clean, le rendre non bloquant).
- Arguments optionnels pour `forge feature|fix|release pull|push`.
