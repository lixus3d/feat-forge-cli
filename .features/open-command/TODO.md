# TODO

## Config changes

- [ ] Add optional `openCommand` field to `IDEConfig` type in `ForgeConfig.ts`
- [ ] Add `openCommand` to the `IDE` resolved type in `types/IDE.ts`
- [ ] Pass through `openCommand` in `standardizeIDEs()` in `ForgeConfig.ts`
- [ ] Add hardcoded default command map per `IDEName` (e.g. `VSCode` → `code`)

## New command handler

- [ ] Create `src/commands/OpenCommands.ts` extending `AbstractCommands`
- [ ] Implement `open(slug?: string)` method:
  - [ ] Resolve feature context: if slug provided use `context.loadFeatureContext(slug)`, else use `FeatureContext.findNearestFeatureContext(context)`
  - [ ] Validate feature is active
  - [ ] Resolve IDE to use (first configured IDE, error if none)
  - [ ] Resolve CLI command (`openCommand` from config or hardcoded default)
  - [ ] Resolve target path: workspace file if it exists, otherwise feature root directory
  - [ ] Spawn IDE process detached via `execa`

## CLI registration

- [ ] Add `registerOpenCommands()` in `cli.ts`
- [ ] Register `forge open [slug]` as top-level command
- [ ] Register `forge feature open [slug]` as subcommand
- [ ] Add import for `OpenCommands`

## Shell completion

- [ ] Add completion for `open` command slug argument (list active feature slugs)
