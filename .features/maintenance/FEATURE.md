# Commande : `maintenance rewrite-agent-files <slug>`

**Objectif**
Permettre de réécrire tous les fichiers d’agents dans le dossier de template agent (par défaut `.features/.template/agent/`), à partir des templates internes, en écrasant les fichiers existants.

**Comportement attendu**

- Prend en entrée `<action>` (`rewrite-agent-files`) et `<slug>` (pour le contexte).
- Réécrit récursivement tous les fichiers d’agents dans le dossier cible.
- Par défaut, le dossier cible est `.features/.template/agent/`, mais ils sont déjà paramètrables dans les options
- Les fichiers existants sont écrasés (overwrite).
- Affiche la liste des fichiers modifiés/écrasés si possible
- Supporte les options :
    - `--dry-run` : simule sans écrire
- Idempotence : relancer sans changement ne modifie rien.

**Cas d’usage**

- Régénérer les templates d’agents après une mise à jour de feat-forge
- Synchroniser les templates sur plusieurs dépôts.

**Points à vérifier dans le code existant**

- Présence et bon fonctionnement de la logique d’overwrite (`ensureAgentTemplates(overwrite: boolean)`).
- Récursivité et gestion des sous-dossiers.
- Gestion des erreurs (dossier source manquant).
- Création du commit conditionnelle.
- Ajout/gestion des options `dry-run`
- Affichage de la liste des fichiers modifiés.
