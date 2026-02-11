# TODO

- [ ] Support automatic bootstrap script execution on branch start
- [ ] Implement a flexible hook system (postBranchStart, postXxxxx, etc.) that runs in order
- [ ] Auto-detect npm scripts in package.json for Node projects (feat-forge:bootstrap, feat-forge:hooks:postXxxxx)
- [ ] Make bootstrap scripts folder path configurable through .feat-forge.json config file (options.folders.scripts)
- [ ] Automatically select the right shell based on the operating system
- [ ] Handle shell script execution on Unix-like systems (.sh)
- [ ] Handle batch script execution on Windows (.bat)
- [ ] Provide graceful fallback when bootstrap/hook scripts don't exist (do nothing basically)
- [ ] Generate clear execution logs for debugging
- [ ] Ensure hooks execute in a predictable, consistent order
- [ ] Support centralized bootstrap/hook configuration via package.json for Node projects
