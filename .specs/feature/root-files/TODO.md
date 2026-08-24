# TODO

- [ ] Ajouter l'option `options.folders.workspaceRootFiles` au modèle de configuration, avec la valeur par défaut `workspace-root-files` et la possibilité de désactiver la feature.
- [ ] Résoudre le dossier source dans `.feat-forge` du projet de configuration et refuser les chemins absolus, les `..` sortants et les liens symboliques dangereux.
- [ ] Copier récursivement le contenu de ce dossier vers la racine virtuelle du workspace, en préservant la structure relative, les octets et les permissions quand possible.
- [ ] Brancher cette copie dans le flux commun de création des workspaces, après la création du dossier virtuel et avant la génération des fichiers dépendants du workspace.
- [ ] Ajouter des tests couvrant au minimum : source absente, dossier personnalisé, désactivation, copie de fichier/arborescence/binaire et erreur de copie.
