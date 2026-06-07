# OpenHub

OpenHub is an MIT-licensed, local-first desktop application for indexing and
organizing AI coding agent skills across Codex, Claude, Gemini, OpenCode, and
other local agent environments.

The current product direction is intentionally simple: SQLite is the local
source of truth, agent skill directories are read-only inventory inputs, and
the app focuses on import, indexing, search, version history, collections,
source preview, optional sync, and constrained plugin capabilities. OpenHub no
longer deploys skills into agent roots and no longer maintains a trust,
security-review, or policy-scoring workflow.

## Current Status

The desktop shell now presents four product surfaces:

- Home: local inventory metrics and the first-run path.
- Inventory: indexed and imported skills with search.
- Sources: local or Git source preview before import.
- Settings: detected roots, sync status, and plugin registry state.

The Electron main process wires typed runtime IPC to local app-data SQLite and a
content store for first-launch root detection, read-only root scanning,
local/Git/ZIP import, FTS-backed library search, favorites, skill detail,
version list/diff/compare, collection creation, opt-in sync operations, plugin
state, plugin provider workflows, and Discover source previews.

`packages/db` contains idempotent SQLite migrations, FTS5 skill search,
app-data directory resolution, indexed skill location records, sync profiles,
outbox, inbox, conflicts, events, plugin manifests, permission grants, plugin
errors, Discover sources, and repository tests.

`packages/core` parses `SKILL.md`, indexes fixture roots into SQLite, imports
local folders, Git repositories, and ZIP archives through isolated staging
directories, writes file blobs to a content-addressed store, creates inventory
versions, diffs version files, creates collections, keeps sync disabled by
default, and manages the constrained plugin registry.

`packages/adapters` detects Codex, Claude, Gemini, OpenCode, and Agents skill
roots and can list `SKILL.md` directories for indexing. It does not write,
deploy, uninstall, or verify files in agent roots.

The tracked historical planning inputs are:

- `references/deep-research-report.md`
- `references/2026-06-03-electron-react-node-sqlite-development-plan.md`
- `references/2026-06-03-high-standard-open-source-goal-development-plan.md`

## Quick Start

Prerequisites: Node.js 20.19 or newer, pnpm 10 or newer, and Git.

```sh
pnpm install
pnpm dev
```

Open the Electron shell from the dev command. In a second terminal, run the
core verification gates:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For release-readiness checks on the current platform:

```sh
pnpm package:desktop
pnpm release:smoke
pnpm release:checksums
pnpm release:inventory
```

Generated release artifacts are written under `out/`, which is ignored by Git.

## Product Principles

- Local-first by default: no account, cloud sync, telemetry, or remote skill
  collection is required.
- SQLite is the local source of truth for skills, versions, indexed locations,
  sync state, and plugin state.
- Agent directories are inventory inputs. Current runtime code must not deploy
  files into those directories.
- The renderer must not directly access Node, the filesystem, or SQLite.
  Privileged work belongs behind typed Electron preload IPC.
- Sync and plugins are opt-in and constrained by explicit permissions.
- Imported folders, Git repositories, and archives must be isolated and path
  checked before their contents enter SQLite or the content store.
- Source preview is provenance and inventory only. Do not display ratings,
  trust levels, reputation, or risk scoring without a new accepted spec.

## Architecture

The workspace uses pnpm, TypeScript, Electron, Vite, React, Node, and SQLite:

- `apps/desktop`: Electron main process, Vite React renderer, preload IPC.
- `packages/shared`: shared types, IPC contracts, validators, constants.
- `packages/core`: domain services for skills, versions, imports, collections,
  source preview, sync, and plugins.
- `packages/db`: SQLite schema, migrations, repositories, fixtures.
- `packages/adapters`: read-only Codex, Claude, Gemini, OpenCode, and Agents
  adapters.

See `docs/architecture.md`, `docs/sync-model.md`, `docs/plugin-api.md`, and
`docs/maintainer-guide.md` for the current design baseline.

## Development Commands

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:desktop
pnpm release:smoke
pnpm release:checksums
pnpm release:inventory
```

The CI workflow runs the same install, lint, typecheck, test, and build
commands so local and hosted verification stay aligned.

## Privacy Defaults

OpenHub keeps skill contents on the user's machine by default. Skill text, file
contents, paths, tokens, and local configuration are not collected by the
project. Network access is reserved for explicit user actions such as Git
import, source preview, optional sync, or plugin folder workflows that declare
the required permission.

See `SECURITY.md` for vulnerability reporting and security boundaries.

## Roadmap

The current roadmap has been collapsed around inventory-first behavior:

- Repository foundation, tooling, and Electron shell.
- SQLite source of truth.
- Read-only agent root detection and skill indexing.
- Local/Git/ZIP import into SQLite and the content-addressed store.
- Discover source preview before import.
- Version history, file diff, and collections.
- Optional offline-first sync.
- Constrained plugin runtime.
- Packaging, release checks, and maintainer operations.

See `docs/roadmap.md` for acceptance gates.

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, `SECURITY.md`, and the docs under `docs/` before opening
a pull request.

## License

OpenHub is licensed under the MIT License. See `LICENSE`.
