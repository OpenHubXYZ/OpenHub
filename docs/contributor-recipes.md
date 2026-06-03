# Contributor Recipes

These recipes point contributors to the smallest safe path for common
extension work.

## Add an adapter

- Add adapter behavior in `packages/adapters`.
- Use synthetic home directories and fixture roots.
- Preserve read-only detection unless the roadmap phase explicitly needs writes.
- Add tests for root detection and malformed skills.
- Document user-visible behavior in `docs/architecture.md` or a focused doc.

## Add a security rule

- Add a `SecurityRule` in `packages/core/src/security-service.ts` or a plugin
  security rule when plugin APIs cover the case.
- Include severity, category, finding excerpt, and test fixtures.
- Prove high and critical findings block install unless an exemption exists.
- Avoid rules that require uploading skill contents.

## Add a sync driver

- Add a `SyncDriver` implementation in `packages/core`.
- Keep sync disabled by default.
- Persist local SQLite state before outbox enqueue.
- Add push, pull, duplicate event, conflict, and offline tests.
- Document privacy and credential boundaries.

## Add a fixture

- Follow `docs/fixture-contribution.md`.
- Keep fixtures synthetic, minimal, and local to the test.
- Do not commit real agent directories, local paths, tokens, or private skill
  contents.
