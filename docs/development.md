# Development

The repository is currently in Phase 0 and contains planning and open-source
foundation files only.

## Prerequisites

The planned implementation will require:

- Node.js LTS
- pnpm
- Git
- A supported desktop operating system for Electron development

Exact version requirements will be pinned when Phase 1 creates `package.json`
and the workspace lockfile.

## Planned Commands

After Phase 1:

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not report these commands as available until the workspace scaffold exists.

## Repository Layout

Current:

- `references/`: research and implementation plans.
- `docs/`: architecture, roadmap, development, testing, and release docs.
- `.github/`: issue, pull request, and discussion templates.

Planned:

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

Do not pre-build sync, plugins, or release packaging while working on P0 import
or database foundations.

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

## Dependency Changes

Dependency changes require a short risk note in the pull request. The lockfile
must be committed after Phase 1 creates the workspace.
