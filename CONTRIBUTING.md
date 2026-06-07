# Contributing

Thank you for helping improve OpenHub.

The project has a working pnpm TypeScript workspace, Electron shell, SQLite
domain model, local inventory loop, sync, plugin runtime, and release-readiness
tooling. Contributions should preserve the local-first security model and
include tests for public behavior.

## Ground Rules

- Keep the app local-first by default.
- Preserve SQLite as the authoritative local data store.
- Do not give renderer code direct Node, filesystem, SQLite, or `ipcRenderer`
  access.
- Do not introduce telemetry, cloud sync, or network calls without explicit
  product and security review.
- Treat agent skill directories as read-only inventory inputs in current
  runtime workflows.
- Do not reintroduce deploy, source reputation, trust scoring, policy packs, or
  review queues without a new accepted spec.
- Add or update tests for public behavior.

## Development Flow

Use this local flow before opening a pull request:

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:desktop
pnpm release:smoke
```

Pull requests should include:

- Scope and motivation.
- Linked issue, spec, or roadmap phase.
- Verification commands and results.
- Screenshots for UI changes.
- Security, privacy, migration, or release impact.

## Dependency Policy

Dependency changes must explain:

- Why the dependency is needed.
- Whether it runs in the renderer, main process, build tooling, or tests.
- Security and maintenance risk.
- Replacement or removal plan if the dependency becomes unmaintained.

The lockfile must be committed.

## Commit Style

Use Conventional Commits:

```text
feat: scaffold desktop workspace
fix: reject zip slip imports
docs: document SQLite source of truth
test: cover path sanitizer
ci: add workspace verification
```

## Fixtures

Fixtures must be synthetic. Do not commit real private skills, tokens, user
paths, customer names, API keys, or full local agent directory snapshots.

See `docs/contributor-recipes.md` for adding adapters, importers, sync drivers,
and fixtures. See `docs/fixture-contribution.md` for fixture review rules.
