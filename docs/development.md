# Development

The repository is currently in Phase 1 and contains a pnpm TypeScript
workspace, an Electron + Vite + React desktop shell, baseline packages, tests,
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

Do not pre-build sync, plugins, release packaging, or database features before
their roadmap phases.

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
