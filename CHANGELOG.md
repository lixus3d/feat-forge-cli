# Changelog

## [1.0.1](https://github.com/lixus3d/feat-forge-cli/compare/v1.0.0...v1.0.1) (2026-02-13)


### Bug Fixes

* correct CI publish workflow order ([c991141](https://github.com/lixus3d/feat-forge-cli/commit/c9911414546bb8c809dbed877c6922c97ba9d55d))

## 1.0.0 (2026-02-13)


### Features

* add .active-feature symlinks in all repos with cascade to main repo ([ab5d623](https://github.com/lixus3d/feat-forge-cli/commit/ab5d623354d9ce6257ec34d266cb9ab33311aeb5))
* add agents and IDE configuration system ([4b52994](https://github.com/lixus3d/feat-forge-cli/commit/4b529948c040ac9c706c620898504d6dc6a54137))
* add core command handlers ([de9e135](https://github.com/lixus3d/feat-forge-cli/commit/de9e135d71d07852d01018a80cd08e2a816eb736))
* add prettier configuration and format all files ([3b521c8](https://github.com/lixus3d/feat-forge-cli/commit/3b521c8a28ca350ff89a186eab1e89b6b7dad47f))
* add slug guard and feature stop prompts ([b294660](https://github.com/lixus3d/feat-forge-cli/commit/b294660873f871b432f878146741cebf7389ccfe))
* **agent:** implement agent refresh command with shared adapter logic ([6fca13d](https://github.com/lixus3d/feat-forge-cli/commit/6fca13d82d9e7e51f07170cd97a411b26a7cea73))
* **archive:** add branch delete option at the end ([e59c260](https://github.com/lixus3d/feat-forge-cli/commit/e59c2605df1c09d918569527cdbb656ce7838cf0))
* **autocomplete:** add rebase completion ([2a11e84](https://github.com/lixus3d/feat-forge-cli/commit/2a11e84a1fea3e936c65d40ee87f5108c169e456))
* **autocomplete:** add shell completion command (bash/zsh/fish) ([b690390](https://github.com/lixus3d/feat-forge-cli/commit/b69039047352cfde43192b79dfa6a3c448ed796c))
* **commands:** add rebase command and extract shared logic to AbstractCommands ([b55752a](https://github.com/lixus3d/feat-forge-cli/commit/b55752a5b1c4ef3939ac82cc6498c2e7db98ca6e))
* **config:** now using basic class-validator for config loading ([e17f126](https://github.com/lixus3d/feat-forge-cli/commit/e17f12632a35ab1aee470e9d138ff3e1739984b5))
* create .vscode/settings.json alongside workspace file ([433da9d](https://github.com/lixus3d/feat-forge-cli/commit/433da9ddefa3498c3c3fb5eed314fadac5f43af0))
* **env:** add automatic source_up + options to disable it ([a9f4788](https://github.com/lixus3d/feat-forge-cli/commit/a9f4788ada214b0a7d7f940713af37b9dcb56cb4))
* **feature:** add list and resync commands ([f47cfa4](https://github.com/lixus3d/feat-forge-cli/commit/f47cfa43e3da45aa5442c9545fd10f6586054a1d))
* **feature:** improve stop and add .gitignore management ([2f4e263](https://github.com/lixus3d/feat-forge-cli/commit/2f4e26307e94dcc0c0786e073769a841f795733d))
* **hooks:** add more hook calls ([cdb35c8](https://github.com/lixus3d/feat-forge-cli/commit/cdb35c89018237928593e5f299b77f632ae8424b))
* **hooks:** add parameters support to hooks via environment variables ([7bd53e4](https://github.com/lixus3d/feat-forge-cli/commit/7bd53e4a0fd1bb72714bf024381e6c0d2d3bc6a7))
* implement feature archive command with shared cleanup and dirty check utilities ([f941cac](https://github.com/lixus3d/feat-forge-cli/commit/f941cac2b02519f0da47bff7182596aa89d4b30b))
* **init:** way better init ux with ([b4a9d35](https://github.com/lixus3d/feat-forge-cli/commit/b4a9d35d14b1c52ff128e941cb5a1bbe6f98762b))
* **maintenance:** add 'maintenance rewrite-agent-files' command and dry-run/commit support ([74778d2](https://github.com/lixus3d/feat-forge-cli/commit/74778d27deafd799a72edc25c43eb0b889ba9618))
* **merge:** change action order to do nothing by default ([dccbcbb](https://github.com/lixus3d/feat-forge-cli/commit/dccbcbb7d6f2eb63b94d7517180052dcc0107a39))
* **merge:** implement merge command with path utilities refactoring ([da279cb](https://github.com/lixus3d/feat-forge-cli/commit/da279cb3dbe15ea4d62837f4eb86257ae87b8e9c))
* **npm:** add npm scripts auto-detection and execution ([408fede](https://github.com/lixus3d/feat-forge-cli/commit/408fede3fee2eaa3741ebb2ed1ae5acd86bce34a))
* **open-command:** implement feature open in IDE functionality ([e60f13b](https://github.com/lixus3d/feat-forge-cli/commit/e60f13b07e211bfb1625df74809fdda1b7949361))
* **prompt:** continue prompt improvements ([e3cb17a](https://github.com/lixus3d/feat-forge-cli/commit/e3cb17ad12027f49de53b338f30b96ae433266a7))
* **proxy:** first stable version of proxy ([04ad885](https://github.com/lixus3d/feat-forge-cli/commit/04ad885bd3bb6a8da0e02129b8a91697f90e3d0a))
* **proxy:** stable services discovery + envrc generation ([74ee60d](https://github.com/lixus3d/feat-forge-cli/commit/74ee60d6f4ab2f94956500e31b9a8ee1ba4a1ade))
* **proxy:** wip ia code to review and simplify ([c1bcff1](https://github.com/lixus3d/feat-forge-cli/commit/c1bcff1d9173302679b0d446c86b63ebaf69f4d0))
* rename feature use to start and scope active mode per worktree ([d364b49](https://github.com/lixus3d/feat-forge-cli/commit/d364b494656a8864a453d815f9a42979de168e0b))
* **start:** add a copyFiles options to copy files from root repo to worktree repos ([82adef0](https://github.com/lixus3d/feat-forge-cli/commit/82adef03869c7197876e23587de24e8cc5e06ed4))
* **start:** only ask for base branch if branch doesn't exists ([c5ef077](https://github.com/lixus3d/feat-forge-cli/commit/c5ef077bab409f3d2f3a24db1349b2b163a40568))
* **templates:** add a string replacement logic to agent templates files ([60c062f](https://github.com/lixus3d/feat-forge-cli/commit/60c062f42f88b76241f852720eb67a2a56e3a30f))
* **templates:** improve custom template resolution ([c517096](https://github.com/lixus3d/feat-forge-cli/commit/c517096788e5a207e7492e478cae9b2b6aa25f00))
* use concrete .md files for base features file template ([75f7fe6](https://github.com/lixus3d/feat-forge-cli/commit/75f7fe621e573c39b74ef837facd7dbf2d586e2a))


### Bug Fixes

* base commands now using BranchCommands correctly ([c87652e](https://github.com/lixus3d/feat-forge-cli/commit/c87652e14feba0a019f9967a73b2201c0d9c0451))
* better config loading + handle global config in home folder ([ff5eacd](https://github.com/lixus3d/feat-forge-cli/commit/ff5eacd668743f7f2b20393ba4a404b67e164f92))
* better error message for dirty repos ([ee5a479](https://github.com/lixus3d/feat-forge-cli/commit/ee5a479f176ae143f8c47d38a2ab7c3e305879be))
* better list infos ([0785db9](https://github.com/lixus3d/feat-forge-cli/commit/0785db9a8d92d92c71f282a52d2dc358fbaa3061))
* ide workspace file creation ([62333cf](https://github.com/lixus3d/feat-forge-cli/commit/62333cfd0f3935d09e3cabd017a649c74f09beb9))
* improve orphan cleaning ([52eca98](https://github.com/lixus3d/feat-forge-cli/commit/52eca981dd27b96d47ebe980f23f69f73b9474a6))
* list command now working as expected + new branch ask for base branch ([aa2773b](https://github.com/lixus3d/feat-forge-cli/commit/aa2773be1a5215e35f45e3e3e8b0f9e9d540178e))
* loading of worktreeRepositories now map correctly the rootRepo ([f408052](https://github.com/lixus3d/feat-forge-cli/commit/f4080529a7b65b45390f00f4226fd4267fadae78))
* making OOP version working like before refactor ([45aa56c](https://github.com/lixus3d/feat-forge-cli/commit/45aa56c2a87a2df93cd7ddb90d168eff553d1727))
* merge now works also on active branch ([533eccc](https://github.com/lixus3d/feat-forge-cli/commit/533eccc38ef8f4218988d339fa2db311dd7f8027))
* now using branchName correctly ([1f81e5b](https://github.com/lixus3d/feat-forge-cli/commit/1f81e5bb41dfb20d7bc921b826cbfa8052a13d94))
* **npm:** better handling of test env ([e5cec1e](https://github.com/lixus3d/feat-forge-cli/commit/e5cec1e67cde934a981add49d50f8a10e40aefb8))
* project root dir loading + findNearestFeatureContext logic ([6b742f4](https://github.com/lixus3d/feat-forge-cli/commit/6b742f49e2b9b673147b201000c55e6baecb5092))
