# TheOpenHub Skills Studio

TheOpenHub Skills Studio is a planned MIT licensed, local-first desktop
application for managing AI coding agent skills across Codex, Claude, Gemini,
OpenCode, and other local agent environments.

The product goal is not another file browser. The app will treat SQLite as the
authoritative local source of truth, keep agent skill directories as deployment
projections, and provide import, install, uninstall, version history, security
review, optional sync, and constrained plugin capabilities.

## Current Status

This repository is in Phase 2: SQLite domain foundation. The desktop shell
renders the product name and an empty library state, and `packages/db` now has
idempotent SQLite migrations, required domain tables, FTS5 skill search, app
data directory resolution, and repository tests. Agent indexing, imports,
installs, sync, security center UI, and plugins are still future roadmap phases.

The tracked planning inputs are:

- `references/deep-research-report.md`
- `references/2026-06-03-electron-react-node-sqlite-development-plan.md`
- `references/2026-06-03-high-standard-open-source-goal-development-plan.md`

## Product Principles

- Local-first by default: no account, cloud sync, telemetry, or remote skill
  collection is required.
- SQLite is the local source of truth for skills, versions, scans,
  installations, sync events, and plugin state.
- Agent directories are projections. Install and uninstall operations must be
  recorded and reversible through app-owned metadata.
- The renderer must not directly access Node, the filesystem, or SQLite.
  Privileged work belongs behind typed Electron preload IPC.
- Sync and plugins are opt-in and constrained by explicit permissions.
- Imported folders, Git repositories, and archives must be isolated and path
  checked before they can affect an agent directory.

## Planned Architecture

The planned workspace uses pnpm, TypeScript, Electron, Vite, React, Node, and
SQLite:

- `apps/desktop`: Electron main process, Vite React renderer, preload IPC.
- `packages/shared`: shared types, IPC contracts, validators, constants.
- `packages/core`: domain services for skills, versions, imports, installs,
  security, sync, and plugins.
- `packages/db`: SQLite schema, migrations, repositories, fixtures.
- `packages/adapters`: Codex, Claude, Gemini, OpenCode, and future adapters.

See `docs/architecture.md` for the design baseline and security boundaries.

## Development Commands

The standard commands are:

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The CI workflow will run the same install, lint, typecheck, test, and build
commands so local and hosted verification stay aligned.

## Privacy Defaults

TheOpenHub Skills Studio is designed to keep skill contents on the user's
machine by default. Skill text, file contents, paths, tokens, and local
configuration are not collected by the project. Network access is reserved for
explicit user actions such as Git import, update checks, optional sync, or
plugin installation.

See `SECURITY.md` for vulnerability reporting and the security model baseline.

## Roadmap

The implementation roadmap is phased:

- Phase 0: open-source repository foundation.
- Phase 1: workspace, Electron shell, tooling, and CI.
- Phase 2: SQLite domain foundation.
- Phase 3: agent detection and library indexing.
- Phase 4: import, export, install, and uninstall loop.
- Phase 5: security center and governance.
- Phase 6: version history, blob store, collections.
- Phase 7: optional offline-first sync.
- Phase 8: constrained plugin runtime.
- Phase 9: packaging, release, and OSS launch.
- Phase 10: maintainer operations and long-term quality.

See `docs/roadmap.md` for acceptance gates.

## Contributing

Contributions are welcome once implementation starts. Please read
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and the docs under
`docs/` before opening a pull request.

## License

TheOpenHub Skills Studio is licensed under the MIT License. See `LICENSE`.
