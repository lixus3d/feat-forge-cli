# Goal

Implémenter la commande `forge proxy` qui lance un reverse-proxy HTTP local routant toutes les branches actives vers les bons ports de services. Le proxy permet d'accéder à n'importe quel service de n'importe quelle branche via une URL unifiée à sous-domaines (`<branch>.<service>.localhost:<proxyPort>`), offrant un point d'entrée unique pour travailler sur une feature multi-services.

---

# Architecture

Le proxy :

1. Charge tous les `generated.services.json` des branches actives (worktrees existants)
2. Construit une table de routage `{branchSlug}.{serviceSlug}` → `localhost:{port}`
3. Pour chaque requête entrante, parse le `Host` header pour extraire branch + service
4. Forward la requête vers le bon `localhost:{port}` via `http-proxy`
5. Sert un dashboard HTML sur `http://localhost:{proxyPort}` (accès direct sans sous-domaine)

---

# Commande CLI

## `forge proxy`

Lance le proxy en mode foreground (bloquant jusqu'à CTRL+C).

```
forge proxy [options]
  --port <port>    Override le port du proxy (défaut: config proxy.port, typiquement 8080)
```

### Comportement au lancement

1. Vérifie que `proxy.enabled` est `true` dans la config
2. Charge les `generated.services.json` de **toutes les branches actives** via `loadActiveBranchesContexts()`
3. Construit la routing table
4. Lance le serveur HTTP sur `proxy.port`
5. Affiche le summary des services (réutilise le pattern de `showServiceSummary`)
6. Met en place un **file watcher** sur les `generated.services.json` de chaque branche
7. Reste actif jusqu'à CTRL+C (SIGINT)

### Output au démarrage (exemple)

```
🔀 Forge Proxy started on http://localhost:8080
📋 Dashboard: http://localhost:8080

Routing table:
  feature-auth:
    🚀 backend (PORT:3100)
        🔀 http://feature-auth.backend.localhost:8080/api → http://localhost:3100/api
    🚀 frontend (PORT:3101)
        🔀 http://feature-auth.frontend.localhost:8080 → http://localhost:3101

  dev:
    🚀 backend (PORT:3000)
        🔀 http://dev.backend.localhost:8080/api → http://localhost:3000/api

Watching for changes... (CTRL+C to stop)
```

---

# Routage par sous-domaines

## Format URL

```
{protocol}://{branchSlug}.{serviceSlug}.localhost:{proxyPort}{path}
```

Exemple : `http://feature-auth.backend.localhost:8080/api/users`

## Parsing du Host header

```
Host: feature-auth-xxxx.backend-xxxxxxx.localhost:8080
       └─ branchSlug ─┘ └ serviceSlug ┘
```

**Algorithme :**

1. Extraire le hostname du `Host` header (sans le port)
2. Lookup dans la routing table d'un service avec le host `branch-slug.service-slug.localhost` → `port`
3. Si trouvé : proxy vers `http://localhost:{port}{originalPath}`
4. Si non trouvé : retourner 404 avec message explicatif

**Cas spécial :** Si le hostname est exactement `localhost` (pas de sous-domaine), servir le dashboard HTML.

---

# Dashboard HTML

## Accès

`http://localhost:{proxyPort}` (requête directe sans sous-domaine)

## Contenu

Page HTML serveur-side avec :

- Titre "Forge Proxy Dashboard"
- Pour chaque branche active :
    - Nom de la branche comme header
    - Liste des services avec :
        - Nom du service
        - Port direct
        - Lien cliquable vers l'URL proxy (`http://{branch}.{service}.localhost:{proxyPort}{path}`)
        - Lien cliquable vers l'URL directe (`http://localhost:{port}{path}`)
        - **Indicateur de status** : pastille verte (UP) ou rouge (DOWN)
- Auto-refresh léger (meta refresh ou petit JS polling toutes les 5s)
- Voir si on peut trouver un joli template HTML/CSS léger pour rendre ça plus sympa

## Health checks

- Pour chaque service, tenter un `HTTP GET` sur `http://localhost:{port}` avec un timeout court (1-2s)
- Status UP si réponse reçue (n'importe quel code HTTP), DOWN si timeout/connection refused
- Les health checks sont effectués **à chaque chargement de la page dashboard** (pas de polling en background côté proxy il faut un refresh de la page pour ça)

---

# File Watching & Hot Reload

## Mécanisme

- Au démarrage, le proxy met en place un watcher (`fs.watch` ou `chokidar`) sur :
    - Le dossier `worktrees/` pour détecter les nouvelles branches / branches supprimées
    - Chaque fichier `generated.services.json` existant
- Quand un `generated.services.json` est modifié (après un `forge services scan`) :
    1. Recharger le fichier
    2. Mettre à jour la routing table
    3. Afficher un message dans le terminal : `🔄 Routing updated for branch "feature-auth"`
- Quand un nouveau worktree apparaît :
    1. Chercher son `generated.services.json`
    2. L'ajouter à la routing table si trouvé
    3. Mettre en place le watcher sur le nouveau fichier
- Quand un worktree est supprimé :
    1. Retirer les routes de cette branche
    2. Supprimer le watcher associé

---

# Implémentation

## Dépendance

- `http-proxy` (npm) pour le forwarding HTTP (gestion propre des headers, streaming, erreurs de connexion)

## Fichiers à créer/modifier

| Fichier                         | Action   | Description                                                                                          |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `src/commands/ProxyCommands.ts` | Créer    | Command handler `forge proxy`                                                                        |
| `src/foundation/Proxy.ts`       | Créer    | Class avec la logique du proxy : serveur, routing, file watching                                     |
| `src/lib/proxy-dashboard.ts`    | Créer    | Génération HTML du dashboard, on peut utiliser des vrais fichiers .html , .css et les lire si besoin |
| `src/cli.ts`                    | Modifier | Enregistrer `registerProxyCommands`                                                                  |
| `package.json`                  | Modifier | Ajouter dépendance `http-proxy` via pnpm                                                             |

## Structure de la routing table

```typescript
type RoutingTable = Map<string, RouteEntry>;
// key: "{branchSlug}.{serviceSlug}"

interface RouteEntry {
    host: string; // "{branchSlug}.{serviceSlug}.localhost"
    branchName: string;
    branchSlug: string;
    serviceName: string;
    serviceSlug: string;
    port: number;
    type: 'http' | 'tcp' | 'grpc';
    path?: string;
    targetUrl: string; // "http://localhost:{port}"
}
```

## Réutilisation du code existant

- `loadActiveBranchesContexts()` : Charger toutes les branches actives
- `loadGeneratedServicesFile()` : Charger les services d'une branche
- `getServiceOutputs()` : Obtenir les URLs formatées (proxy + directe)
- Pattern de `showServiceSummary()` : Afficher le résumé au démarrage

---

# Gestion des erreurs

- **Port déjà utilisé** : Message clair `❌ Port {port} already in use. Use --port to specify another.` + exit
- **Aucun service trouvé** : Warning `⚠️ No services found in any active branch. Run 'forge services scan' first.` mais le proxy démarre quand même (en attente de hot-reload)
- **Service cible DOWN** : Le proxy retourne une page 502 Bad Gateway avec message explicatif : `Service "{serviceName}" on branch "{branchName}" is not responding on port {port}`
- **Route inconnue** : 404 avec message : `No service found for "{host}". Visit http://localhost:{proxyPort} for available services.`

---

# Usage Flow

1. **Setup préalable** : Avoir fait `forge services scan` sur les branches souhaitées
2. **Lancer le proxy** : `forge proxy` depuis n'importe où dans le projet
3. **Accéder aux services** : Utiliser les URLs proxy (`http://branch.service.localhost:8080`)
4. **Voir le dashboard** : Ouvrir `http://localhost:8080` dans un navigateur
5. **Ajouter une branche** : Faire `forge services scan` dans une autre branche → le proxy détecte automatiquement
6. **Arrêter** : CTRL+C

---

# Acceptance criteria

- [ ] `forge proxy` lance un serveur HTTP sur le port configuré
- [ ] Le proxy route correctement `{branch}.{service}.localhost:{port}` vers le bon service
- [ ] Le dashboard HTML est servi sur `http://localhost:{proxyPort}` avec la liste de tous les services
- [ ] Le dashboard affiche le status UP/DOWN de chaque service (health check)
- [ ] Le summary des services est affiché au démarrage dans le terminal (URLs cliquables)
- [ ] Le proxy hot-reload quand un `generated.services.json` est modifié
- [ ] Le proxy détecte les nouveaux worktrees et branches supprimées (hot-reload , et refresh du summary terminal)
- [ ] Le proxy reste actif jusqu'à CTRL+C (gestion propre du SIGINT)
- [ ] Erreur claire si le port est déjà utilisé
- [ ] 502 si le service cible est DOWN, 404 si la route est inconnue
- [ ] Option `--port` pour override le port à la volée (mais indiqué possible effet de bord car les services peuvent être configurés pour pointer vers le port de la config)
- [ ] Les websockets et le hot reload des projets type Vite fonctionnent correctement à travers le proxy
- [ ] Envoyer des headers de debug (ex: `X-Forge-Branch`, `X-Forge-Service`) pour faciliter le debugging côté service
- [ ] Optionnel : gestion grpc et TCP (mais pas prioritaire, focus d'abord sur HTTP)

# Not in the perimeter

- TLS / HTTPS
- Authentication / autorisation sur le proxy
- Load balancing entre instances
- Persistance des logs de requêtes
- Configuration par branche du proxy (ex: headers custom)
