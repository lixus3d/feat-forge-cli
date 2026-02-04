# TODO

* [x] scaffolding repo Node/TS + build + bin
* [x] impl `feature create/start`
* [x] impl `feature archive`
* [x] impl `mode spec/code`
* [x] impl `agent refresh` (sync adapters)
* [x] decide spec file naming (FEATURE/TODO vs INSTRUCTIONS/STATUS)
* [x] add `.feat-forge.json` config discovery (workspace root, repo path, worktrees path)
* [x] add template override resolution (.features/.template -> ~/.feat-forge/template -> default)
* [x] refactor command handlers to reusable classes (no inline commander action logic)
* [x] add `forge init` to scaffold `.feat-forge.json`
* [x] add `feature stop` command (clean/dirty handling)
* [x] avoid the loadForgeConfig in each command function, instantiate the commands class with the config
* [x] when we do a `feature create/start`, it should start in spec mode if no .forge-mode is defined yet is the branch
