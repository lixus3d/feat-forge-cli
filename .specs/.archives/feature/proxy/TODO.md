# TODO

**Setup:**
- [ ] Ajouter `http-proxy` + `@types/http-proxy` via pnpm
- [ ] Enregistrer `forge proxy` dans `cli.ts`

**Proxy Core (`src/foundation/Proxy.ts`):**
- [ ] Classe Proxy : construire routing table depuis branches actives (`loadActiveBranchesContexts` + `loadGeneratedServicesFile`)
- [ ] Serveur HTTP : lookup Host header dans routing table, forward via `http-proxy`
- [ ] Support WebSocket (upgrade) pour compatibilité Vite HMR et similaires
- [ ] Headers de debug : `X-Forge-Branch`, `X-Forge-Service` sur chaque requête proxiée
- [ ] Cas `localhost` sans sous-domaine → servir dashboard
- [ ] Erreurs : 404 route inconnue, 502 service DOWN, EADDRINUSE au démarrage

**Dashboard (`src/lib/proxy-dashboard.ts` + fichiers .html/.css):**
- [ ] Page HTML stylée avec liste branches/services, liens cliquables (proxy + direct)
- [ ] Health check par service (HTTP GET, timeout 2s) avec indicateur UP/DOWN
- [ ] Auto-refresh (meta refresh ou JS polling)

**File Watching & Hot Reload:**
- [ ] Watcher sur chaque `generated.services.json` → rebuild routing table + log terminal
- [ ] Watcher sur dossier worktrees → détecter ajout/suppression de branches, refresh summary

**Command (`src/commands/ProxyCommands.ts`):**
- [ ] Handler CLI : option `--port` (avec warning effet de bord), vérif `proxy.enabled`
- [ ] Afficher summary au démarrage (réutiliser pattern `showServiceSummary`)
- [ ] Gestion SIGINT (cleanup propre)

**Quality:**
- [ ] Tests unitaires : parsing Host, routing table, health checks
- [ ] Tests : WebSocket upgrade, headers de debug
