# Fichiers à la racine des workspaces

## Contexte

Un workspace feat-forge est un dossier virtuel ouvert dans l'IDE. Il contient
les worktrees Git des repositories gérés ainsi que `.forge-mode` et
`.active-spec`. Git ne reproduit pas les fichiers non suivis ou ignorés ; il
faut donc pouvoir fournir des fichiers à cet environnement global, sans les
associer à un worktree particulier.

Le projet portant la configuration feat-forge doit pouvoir déclarer un
répertoire de fichiers à recopier. Son contenu est copié à la racine virtuelle
du workspace, en préservant sa structure relative.

## Objectif

Lors de la création d'un workspace, copier automatiquement le contenu d'un
répertoire conventionnel présent dans le dossier de configuration `.feat-forge`
du projet portant la configuration feat-forge vers la racine virtuelle du
workspace créé par feat-forge. La copie est effectuée une seule fois, quel que
soit le nombre de repositories.

Le nom du répertoire conventionnel doit être configurable dans
`.feat-forge.json`, afin de permettre l'adaptation aux projets existants.

## Périmètre fonctionnel

### Configuration

Ajouter une option de dossier, avec la valeur par défaut suivante :

```json
{
  "options": {
    "folders": {
      "workspaceRootFiles": "workspace-root-files"
    }
  }
}
```

Le chemin source est résolu relativement au dossier `.feat-forge` du projet
portant la configuration, jamais relativement aux worktrees. La configuration
doit accepter :

- une chaîne non vide désignant un sous-dossier ;
- une valeur désactivée (`false`, ou l'équivalent retenu par le modèle de
  configuration) pour ne rien recopier.

La valeur par défaut ne doit pas modifier le comportement des projets qui ne
possèdent pas ce dossier.

Exemple de structure :

```text
project/
└── .feat-forge/
    └── workspace-root-files/
        ├── .vscode/
        │   └── settings.json
        ├── .env.example
        └── scripts/
            └── local.sh
```

### Copie

Si le projet de configuration possède le dossier configuré :

1. parcourir récursivement son contenu ;
2. créer les répertoires de destination nécessaires ;
3. copier les fichiers à la racine du workspace, en retirant le préfixe
   `workspace-root-files` (ou son nom configuré) ;
4. préserver les octets et, autant que possible, les permissions des fichiers.

La copie concerne tout type de fichier supporté par le système de fichiers,
sans filtrage par extension et sans interprétation de son contenu. Les fichiers
existants dans le workspace ne doivent pas être supprimés automatiquement.

La copie doit être exécutée après la création du répertoire du workspace et
avant l'ouverture ou la génération des fichiers IDE qui dépendent de son
contenu. Elle doit s'appliquer à tous les workspaces créés par les commandes
feature/fix/release qui utilisent le même flux de création.

### Racine virtuelle et fichiers générés

La cible est le dossier qui contient les worktrees Git, `.forge-mode` et
`.active-spec`, et non le dossier d'un worktree particulier.

Les fichiers générés et gérés par feat-forge suivent leur cycle habituel. La
copie ne doit pas supprimer les fichiers déjà présents dans le workspace.

### Cas limites et sécurité

- Un dossier source absent est ignoré sans erreur.
- Un chemin source doit rester dans le dossier `.feat-forge` du projet ; les
  chemins absolus et les chemins contenant `..` qui sortent de ce dossier sont
  rejetés.
- Les liens symboliques ne doivent pas permettre de copier hors du dossier
  source. Le comportement recommandé est de les refuser avec une erreur
  explicite.
- Un fichier source illisible ou une erreur de création/copie doit faire échouer
  l'opération et produire un message actionnable ; un workspace partiellement
  copié ne doit pas être présenté comme terminé.
- Le dossier source lui-même n'est pas copié comme sous-dossier : seul son
  contenu est fusionné à la racine.

## Hors périmètre

- Synchroniser les modifications du workspace vers les dossiers sources.
- Supprimer les fichiers précédemment copiés lorsqu'ils disparaissent de la
  source.
- Effectuer une substitution de variables ou un rendu de templates.
- Copier ces fichiers dans les worktrees des repositories.
- Remplacer le mécanisme existant `repositories[].copyFiles`, qui reste dédié
  aux fichiers copiés dans le worktree d'un dépôt.

## Critères d'acceptation

- Avec la configuration par défaut et un dossier
  `.feat-forge/workspace-root-files`, la création d'un workspace copie un
  fichier simple à sa racine.
- Les sous-dossiers et les fichiers binaires sont copiés récursivement sans
  modification.
- L'absence du dossier source conserve un parcours de création réussi.
- Un nom de dossier personnalisé dans `.feat-forge.json` est pris en compte.
- La fonctionnalité peut être désactivée par configuration.
- La copie s'effectue dans la racine virtuelle, jamais dans chaque worktree.
- Les chemins sortant de `.feat-forge` et les liens symboliques dangereux sont
  rejetés.
- Les tests couvrent au minimum : fichier, arborescence, binaire, source
  absente, configuration personnalisée, désactivation et erreur de copie.

## Décisions à confirmer

1. Le dossier source est-il bien `.feat-forge/workspace-root-files` du projet
   qui porte la configuration feat-forge ? Cette spécification retient ce
   choix, avec une seule source pour le workspace global.

## Références

- [Documentation Git des worktrees](https://git-scm.com/docs/git-worktree) :
  les worktrees partagent le dépôt Git mais possèdent chacun leur arbre de
  travail.
- [Documentation Node.js du module `fs`](https://nodejs.org/api/fs.html) :
  primitives de copie et gestion des erreurs du système de fichiers.
