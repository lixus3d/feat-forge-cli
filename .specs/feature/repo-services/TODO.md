# TODO

**Core Logic:**
- [ ] Scanner : parcourir branchRoot, parser/valider `.forge/services.json`, agréger par repo, générer `generated.services.json` avec `_doNotEdit`
- [ ] Port Allocator : charger `port-allocations.json`, assigner ports séquentiels depuis plage de branche, error si débordement

**Commands:**
- [ ] `forge services scan` : exécuter Scanner & Aggregator, afficher résumé (repos, services, ports)
- [ ] `forge services list` : afficher services avec ports en tableau (optionnel : flag `--json`)
- [ ] `forge env update` : générer `.envrc` avec variables `REPO_SERVICE_PORT`, header `_doNotEdit`, timestamp, branch name
- [ ] `forge env show` : afficher `.envrc` courant + plage réservée de la branche

**Quality:**
- [ ] Validation schéma JSON (name, type, path obligatoires)
- [ ] Error handling : fichiers manquants, plage débordée, format invalide
- [ ] Tests : unit (parser, allocator) + integration (scan + env update)
