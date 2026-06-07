# Development

The repository contains a pnpm TypeScript workspace, an Electron + Vite + React
desktop shell, SQLite domain storage, read-only agent indexing, local/Git/ZIP
imports, version and collection services, optional sync state and drivers,
constrained plugin runtime services, release packaging scripts, smoke tests,
maintainer operations docs, ADRs, typed desktop runtime IPC, linting,
formatting, and CI.

## Prerequisites

Local development requires:

- Node.js LTS
- pnpm
- Git
- A supported desktop operating system for Electron development

Version requirements are declared in `package.json`. The current package
manager is `pnpm@10.33.2`.

## Commands

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:desktop
pnpm release:smoke
pnpm release:inventory
```

## Repository Layout

- `references/`: historical research and implementation plans.
- `docs/`: architecture, roadmap, development, testing, release, and maintainer
  docs.
- `.github/`: issue, pull request, and discussion templates.
- `apps/desktop`
- `packages/shared`
- `packages/core`
- `packages/db`
- `packages/adapters`

## Scope Discipline

Every non-trivial change should:

- Link to the relevant spec, issue, or roadmap item.
- Implement only the required scope.
- Update docs and tests that prove current behavior.
- Run the acceptance commands.
- Avoid reintroducing deploy, source reputation, trust scoring, policy packs,
  or review queues without a new accepted spec.

## Local Data Safety

Tests must not write to real user agent directories. Use temporary directories
and fixtures for:

- Codex roots
- Claude roots
- Gemini roots
- OpenCode roots
- Agents roots
- archive import fixtures
- Git import fixtures
- path traversal and symlink escape fixtures

Database unit tests should use `createMemoryDatabase()` from `packages/db`.
Filesystem-backed SQLite tests must use temporary directories created by the
test runner, never the user's application data directory.

Agent indexing tests should inject a fake `homeDirectory` into
`createBuiltInAgentAdapters()`. Do not scan real `~/.codex`, `~/.claude`,
`~/.gemini`, `.agents`, or `~/.opencode` directories in automated tests.

Import tests must stage inputs under a temp directory and must not write to real
agent roots. ZIP slip fixtures should use raw malicious archive entries rather
than ZIP helper APIs that normalize traversal away before the app can inspect
it.

Desktop runtime tests may use filesystem-backed SQLite, but only under a temp
`dataDirectory`. Runtime tests should call `createDesktopRuntime()` directly
instead of using Electron, and should inject fake `homeDirectory` roots for
agent detection.

Version and collection tests should use temporary directories and in-memory or
temp SQLite databases. Collection tests should use a fresh database when slug
conflicts could obscure package behavior.

Sync tests should use in-memory SQLite and temporary directories for
shared-folder and Git fixtures. A test must prove the disabled-by-default
startup plan, outbox enqueue after local persistence, shared-folder push/pull,
Git package commit/pull, and conflict open/resolve lifecycle.

Plugin tests should use in-memory SQLite and temporary plugin roots. Fixtures
must prove manifest validation, integrity checking, explicit permission
authorization, restricted host registration, malicious entry blocking, disabled
capability removal, and Plugins UI state.

Release smoke tests should use generated `out/` artifacts only. They must
verify package payload entrypoints, packaged main startup under the Electron
runtime, database migration, skills import/search/index flow, root-detection
startup behavior, Electron window options, privacy defaults, and redacted
release logs.

## Dependency Changes

Dependency changes require a short risk note in the pull request. The lockfile
must be committed.

Native dependencies with install scripts must be listed in
`package.json#pnpm.onlyBuiltDependencies`. Current approved native/build
dependencies are `better-sqlite3`, `electron`, and `esbuild`.
