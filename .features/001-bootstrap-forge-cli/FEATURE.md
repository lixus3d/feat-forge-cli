# Objectif

Construire un CLI Node.js global installable (nom de travail: `forge`) qui orchestre un workflow **feature-first** basé sur une spec versionnée, des worktrees Git, et l’usage d’agents IA **multi-providers** (Copilot / Codex / Claude Code / Gimini / etc.), via un mécanisme simple de **modes de travail** (spec ↔ code).

Le CLI doit permettre de faire travailler des agents IA **dans le contexte d’une feature**, sans jamais écraser les fichiers globaux du projet, et en distinguant clairement :

* la phase de **rédaction / clarification** (spec)
* la phase d’**implémentation** (code)

---

## Concepts

### Feature

Une feature = un dossier `.features/<slug>/` contenant :

* `FEATURE.md` — objectif, périmètre, critères d’acceptation
* `TODO.md` — checklist structurée (TODO / DOING / DONE)
* `DECISIONS.md` — décisions actées + rationales
* `NOTES.md` — contexte libre, hypothèses, questions ouvertes
* `agent` — le dossier où les agents doivent être lancé pour travailler sur la feature

Ces fichiers sont la **source de vérité** de la feature.

---

### Feature active

La feature actuellement travaillée est exposée via :

* `.features/.active` → **symlink** pointant vers `.features/<slug>/`

Caractéristiques :

* `.active` est **gitignored** (état local par worktree)
* chaque worktree peut avoir sa propre feature active
* permet d’ouvrir directement VS Code ou un agent sur la feature courante
* point d’entrée unique et stable, même avec des dizaines de features

Convention d’accès :

* les agents utilisent systématiquement :

  * `.features/.active/agent/`

Cela garantit une navigation simple et prévisible, sans dépendre d’un état stocké dans un fichier.


---

### Mode de travail

Une feature peut être dans **un mode actif** :

* `spec` → aide à la **complétion et clarification** des 4 fichiers
* `code` → **lecture stricte** des 4 fichiers pour implémentation

Le mode courant est stocké dans :

* `.features/<slug>/.forge-mode` (`spec` | `code`)

Changer de mode n’implique **aucune modification du code projet**, uniquement une mise à jour du contexte agent.

---

### Agents IA (scope feature)

Les agents sont **toujours lancés depuis** :

```
.features/<slug|.active>/agent/
```

Ce dossier contient :

* `CONTEXT.spec.md` — instructions agents en mode *spec*
* `CONTEXT.code.md` — instructions agents en mode *code*

Ces fichiers sont **canoniques**.

---

### Adapters agents

Pour compatibilité avec les outils existants (Codex, Claude, Gemini, Copilot, etc.), le dossier `agent/` contient des **symlinks ou fichiers générés** pointant vers le contexte actif :

Exemples :

* `AGENTS.md`
* `CLAUDE.md`
* `GEMINI.md`
* `COPILOT.md`

Le mapping des adapters est configurable via :

* `.feat-forge.json`

Les adapters :

* sont **scopés à la feature**
* **ne modifient jamais** les fichiers agents globaux du repo
* peuvent être régénérés à tout moment

---

### Règles par mode

#### Mode `spec`

Les agents :

* peuvent lire le code du projet pour contexte
* proposent des modifications **uniquement** dans :

  * `FEATURE.md`
  * `TODO.md`
  * `DECISIONS.md`
  * `NOTES.md`
* peuvent ajouter : questions ouvertes, hypothèses, options, risques
* **ne modifient pas** le code applicatif

#### Mode `code`

Les agents :

* lisent les 4 fichiers **dans l’ordre** : Feature → Todo → Decisions → Notes
* implémentent le code conformément à ces documents
* peuvent mettre à jour si nécessaire :

  * `FEATURE.md`
  * `TODO.md`
  * `DECISIONS.md`
  * `NOTES.md`

---

### Archivage des features

Les features terminées ou mises en pause peuvent être déplacées dans :

* `.features/.archives/<slug>/`

Propriétés :

* `.archives/` est **versionné**
* conserve l’historique des specs, décisions et notes
* permet de garder le dossier `.features/` principal lisible, même à grande échelle

---

## Configuration

### `.feat-forge.json`

Définit :

* le dossier racine des features (`.features/` par défaut)
* la liste des adapters agents à générer
* les repositories du projet, le premier étant le main ou mainRepo
* etc.

---

## Commandes MVP

### Feature

* `forge feature create <slug>`

  * crée `.features/<slug>/`
  * initialise les 4 fichiers
  * crée le dossier `agent/`
  * initialise le mode `spec` pour cette feature

* `forge feature use <slug>`

  * créé le worktree qui va bien
  * met à jour le symlink `.features/.active`

* `forge feature archive <slug>`

  * déplace `.features/<slug>/` vers `.features/.archives/<slug>/`
  * refuse si la feature est active (si `.features/.active` pointe dessus)
  * refuse si des worktrees associés sont *dirty* (sauf option explicite ultérieure)
  * garantit qu’aucune modifications non commit soit perdue


---

### Mode

* `forge mode spec`

  * écrit `.forge-mode = spec`
  * active `CONTEXT.spec.md`
  * régénère les adapters agents

* `forge mode code`

  * écrit `.forge-mode = code`
  * active `CONTEXT.code.md`
  * régénère les adapters agents

---

### Agents

* `forge agent refresh`

  * régénère les fichiers adapters selon le mode courant (.forge-mode) dans la feature .active

---

### Tests (optionnel MVP)

* `forge test`

  * exécute la commande de test détectée (package.json / config)

---

## Critères d’acceptation MVP

* Une feature peut être créée avec ses fichiers et son dossier agent
* Le mode peut être changé (`spec` ↔ `code`) sans effet de bord sur le repo
* Les agents utilisent un contexte **scopé feature**
* Aucun fichier agent global du projet n’est modifié
* Le workflow fonctionne localement (WSL2 inclus)

---

## Non-objectifs (MVP)

* RAG / embeddings / indexation
* UI graphique
* Orchestration d’agents concurrents
