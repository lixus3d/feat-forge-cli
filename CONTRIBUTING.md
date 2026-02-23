# Contributing

Thanks for contributing to FeatForge.

## Development Setup

- Node.js `>=20`
- `pnpm` (project uses `pnpm@10`)

Install dependencies:

```bash
pnpm install
```

## Useful Commands

Run tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Run tests with coverage:

```bash
pnpm test:coverage
```

Build the CLI:

```bash
pnpm build
```

Format files:

```bash
pnpm format
```

Check formatting:

```bash
pnpm format:check
```

Run lint checks:

```bash
pnpm lint
```

Run lint fix command:

```bash
pnpm lint:fix
```

Regenerate typed errors:

```bash
pnpm generate:errors
```

## Pull Requests

- Keep changes focused and small when possible.
- Add or update tests when behavior changes.
- Ensure `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass before opening a PR.
- Test locally with `pnpm link` or `npm link` if your changes affect the CLI behavior.
