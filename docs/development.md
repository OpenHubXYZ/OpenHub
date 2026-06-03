# Development

The repository is currently in Phase 7 and contains a pnpm TypeScript
workspace, an Electron + Vite + React desktop shell, SQLite domain storage,
agent indexing, import/export/install core services, security governance
services, version/collection services, optional sync state and drivers, tests,
linting, formatting, and CI.

## Prerequisites

The planned implementation will require:

- Node.js LTS
- pnpm
- Git
- A supported desktop operating system for Electron development

Version requirements are declared in `package.json`. The current package manager
is `pnpm@10.33.2`.

## Commands

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Repository Layout

Current:

- `references/`: research and implementation plans.
- `docs/`: architecture, roadmap, development, testing, and release docs.
- `.github/`: issue, pull request, and discussion templates.
- `apps/desktop`
- `packages/shared`
- `packages/core`
- `packages/db`
- `packages/adapters`

## Phase Discipline

Each phase should:

- Link to the relevant spec or plan.
- Implement only that phase's scope.
- Update docs and tests that prove the phase behavior.
- Run the acceptance commands.
- Commit only the phase work.

Do not pre-build plugins, release packaging, or database features before their
roadmap phases.

## Local Data Safety

Tests must not write to real user agent directories. Use temporary directories
and fixtures for:

- Codex roots
- Claude roots
- Gemini roots
- OpenCode roots
- archive import fixtures
- Git import fixtures
- path traversal and symlink escape fixtures

Database unit tests should use `createMemoryDatabase()` from `packages/db`.
Filesystem-backed SQLite tests must use temporary directories created by the
test runner, never the user's application data directory.

Agent indexing tests should inject a fake `homeDirectory` into
`createBuiltInAgentAdapters()`. Do not scan real `~/.codex`, `~/.claude`,
`~/.gemini`, or `~/.opencode` directories in automated tests.

Import tests must stage inputs under a temp directory and must not write to real
agent roots. ZIP slip fixtures should use raw malicious archive entries rather
than ZIP helper APIs that normalize traversal away before the app can inspect
it.

Security tests should use imported temp fixtures and in-memory SQLite. High-risk
fixtures must prove install blocking before any target-root write. Exemption
fixtures must include a concrete reason and scope, and revocation should be
verified through policy evaluation.

Version and collection tests should use temporary directories for install roots
and exported packages. Rollback tests must verify both restored files and
deleted app-owned files from newer versions. Collection import tests should use a
fresh database so slug conflicts do not obscure package behavior.

Sync tests should use in-memory SQLite and temporary directories for
shared-folder and Git fixtures. A test must prove the disabled-by-default
startup plan, outbox enqueue after local persistence, shared-folder push/pull,
Git package commit/pull, and conflict open/resolve lifecycle.

## Dependency Changes

Dependency changes require a short risk note in the pull request. The lockfile
must be committed after Phase 1 creates the workspace.

Native dependencies with install scripts must be listed in
`package.json#pnpm.onlyBuiltDependencies`. Current approved native/build
dependencies are `better-sqlite3`, `electron`, and `esbuild`.
