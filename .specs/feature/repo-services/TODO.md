# TODO

**Core Logic:**
- [x] Scanner : parcourir branchRoot, parser/valider `.forge/services.json`, agréger par repo, générer `generated.services.json` avec `_doNotEdit`
  - Implémenté: `scanServices()` in `src/lib/services.ts`
  - Valide avec class-validator, retourne ScannedServices
- [x] Port Allocator : charger `port-allocations.json`, assigner ports séquentiels depuis plage de branche, error si débordement
  - Implémenté: Classe `PortAllocator` in `src/lib/portAllocator.ts`
  - Gère allocations par branche, détecte débordement, persiste à disque

**Commands:**
- [x] `forge services scan` : exécuter Scanner & Aggregator, afficher résumé (repos, services, ports)
  - Implémenté: `ServicesCommands.scan()` in `src/commands/ServicesCommands.ts`
  - Affiche résumé avec repos, services, ports assignés
- [x] `forge services list` : afficher services avec ports en tableau (optionnel : flag `--json`)
  - Implémenté: `ServicesCommands.list()` avec flag `--json`
  - Tableau formaté par défaut, JSON optionnel
- [x] `forge env update` : générer `.envrc` avec variables `REPO_SERVICE_PORT`, header `_doNotEdit`, timestamp, branch name
  - Implémenté: `EnvCommands.update()` in `src/commands/EnvCommands.ts`
  - Génère `.envrc` avec BRANCH_SLUG, REPO_SERVICE_PORT, REPO_SERVICE_PATH, timestamp
- [x] `forge env show` : afficher `.envrc` courant + plage réservée de la branche
  - Implémenté: `EnvCommands.show()`
  - Affiche contenu .envrc + info allocation (start/end/used)

**Quality:**
- [x] Validation schéma JSON (name, type, path obligatoires)
  - Implémenté avec `class-validator` decorators
  - ServiceDefinition valide name, type, path
- [x] Error handling : fichiers manquants, plage débordée, format invalide
  - Scanner: error si `.forge/services.json` invalide
  - PortAllocator: error si débordement de plage
  - EnvCommands: messages d'erreur explicites si fichiers manquants
- [x] Tests : unit (parser, allocator) + integration (scan + env update)
  - Fichier test types: `tests/unit/foundation/types/Services.test.ts` (9 tests)
  - Fichier test allocator: `tests/unit/lib/portAllocator.test.ts` (7 tests)
  - Tous les tests passent (146 tests total)

**Files Implemented:**
- `src/foundation/types/Services.ts` - Classes de validation
- `src/lib/services.ts` - Scanner et générateurs
- `src/lib/portAllocator.ts` - Gestionnaire d'allocations
- `src/commands/ServicesCommands.ts` - Commandes services
- `src/commands/EnvCommands.ts` - Commandes env
- `src/cli.ts` - Enregistrement CLI (modifié)
- Tests et validations complètement couverts

**Status:** ✅ Implémentation complète et testée
