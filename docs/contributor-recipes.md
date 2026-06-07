# Contributor Recipes

These recipes point contributors to the smallest safe path for common extension
work.

## Add an adapter

- Add read-only adapter behavior in `packages/adapters`.
- Use synthetic home directories and fixture roots.
- Preserve root detection and `SKILL.md` indexing only.
- Add tests for root detection and malformed skills.
- Document user-visible behavior in `docs/architecture.md` or a focused doc.

## Add an importer

- Add importer behavior in `packages/core`.
- Stage inputs under a temporary directory before parsing.
- Reuse path-safety checks for traversal, symlink escape, and ZIP slip.
- Persist parsed metadata and file hashes to SQLite before exposing results.
- Add tests for valid fixtures and malicious path fixtures.

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
