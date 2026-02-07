# TODO

## Config changes

- [x] Add optional `openCommand` field to `IDEConfig` type in `ForgeConfig.ts`
- [x] Add `openCommand` to the `IDE` resolved type in `types/IDE.ts`
- [x] Pass through `openCommand` in `standardizeIDEs()` in `ForgeConfig.ts`
- [x] Add hardcoded default command map per `IDEName` (e.g. `VSCode` → `code`)

## New command handler

- [x] Create `src/commands/OpenCommands.ts` extending `AbstractCommands`
- [x] Implement `open(slug?: string)` method:
  - [x] Resolve feature context: if slug provided use `context.loadFeatureContext(slug)`, else use `FeatureContext.findNearestFeatureContext(context)`
  - [x] Validate feature is active
  - [x] Resolve IDE to use (first configured IDE, error if none)
  - [x] Resolve CLI command (`openCommand` from config or hardcoded default)
  - [x] Resolve target path: workspace file if it exists, otherwise feature root directory
  - [x] Spawn IDE process detached via `execa`

## CLI registration

- [x] Add `registerOpenCommands()` in `cli.ts`
- [x] Register `forge open [slug]` as top-level command
- [x] Register `forge feature open [slug]` as subcommand
- [x] Add import for `OpenCommands`

## Shell completion

- [x] Add completion for `open` command slug argument (list active feature slugs)

## Integration with `forge feature start`

- [x] Prompt user to open the feature in IDE after `forge feature start` (only when an IDE is configured)
