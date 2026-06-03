# Contributing

Thank you for helping improve TheOpenHub Skills Studio.

This project is currently in its foundation phase. Until the workspace scaffold
lands, contributions should focus on documentation, planning accuracy, security
model clarity, and repository hygiene.

## Ground Rules

- Keep the app local-first by default.
- Preserve SQLite as the authoritative local data store.
- Do not give renderer code direct Node, filesystem, or SQLite access.
- Do not introduce telemetry, cloud sync, or network calls without explicit
  product and security review.
- Treat agent skill directories as projections, not the only state source.
- Add or update tests for public behavior once implementation begins.

## Development Flow

After Phase 1 lands:

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
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

The lockfile must be committed after Phase 1 creates the workspace.

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
