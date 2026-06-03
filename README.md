# TheOpenHub Skills Studio

TheOpenHub Skills Studio is an MIT-licensed, local-first desktop
application for managing AI coding agent skills across Codex, Claude, Gemini,
OpenCode, and other local agent environments.

The product goal is not another file browser. The app treats SQLite as the
authoritative local source of truth, keep agent skill directories as deployment
projections, and provide import, install, uninstall, version history, security
review, optional sync, and constrained plugin capabilities.

## Current Status

This repository is in Phase 10: maintainer operations and long-term quality. The desktop
shell renders the product name, empty/indexed library states, the P0
import/install flow state, and Security Center state for queue, risk, findings,
history, exemptions, version history, diffs, collections, Sync Center state, and
Plugins state.
The Electron main process now wires typed runtime IPC to the local app data
SQLite database and content store for agent-root scanning, local folder import,
install plan creation, install application, security scans, sync startup state,
and plugin center state.
`packages/db` has idempotent SQLite migrations, required domain tables, FTS5
skill search, app data directory resolution, installation file ownership
records, security scan records, active exemption records, sync profiles,
outbox, inbox, conflicts, events, plugin manifests, plugin permission grants,
plugin errors, and repository tests.
`packages/adapters` detects Codex, Claude, Gemini, and OpenCode skill roots.
`packages/core` parses `SKILL.md`, indexes fixture roots into SQLite, and
records explainable scan errors. It now imports local folders, Git repositories,
and ZIP archives through isolated staging directories, writes file blobs to a
content-addressed store, creates conflict-aware install plans, projects files by
copy into agent roots, uninstalls only app-owned files, and exports portable
packages with file hashes. It also scans skills before install, scores security
findings, blocks high-risk installs by default, and allows scoped exemptions
that can be revoked. It now creates new skill versions for content-changing
operations, diffs version files, rolls installed projections back to older
versions, and batch-exports/imports collections. Sync is disabled unless a user
creates an enabled profile, stores local writes before outbox enqueue, supports
shared-folder, Git, and mock REST package drivers, and records conflicts for
explicit resolution. Plugins are disabled by default, validate manifest fields
and entry integrity, require declared permissions to be explicitly authorized,
register capabilities through a restricted host API, and remove capabilities
from the registry when disabled. The repository now includes current-platform
desktop packaging, release checksums, dependency inventory generation, release
smoke checks, launch-ready contributor onboarding, maintainer triage policy,
ADRs, dependency policy, fixture rules, security response playbook, and public
roadmap workflow.

The tracked planning inputs are:

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
pnpm release:inventory
```

Generated release artifacts are written under `out/`, which is ignored by Git.

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

## Architecture

The workspace uses pnpm, TypeScript, Electron, Vite, React, Node, and
SQLite:

- `apps/desktop`: Electron main process, Vite React renderer, preload IPC.
- `packages/shared`: shared types, IPC contracts, validators, constants.
- `packages/core`: domain services for skills, versions, imports, installs,
  security, sync, and plugins.
- `packages/db`: SQLite schema, migrations, repositories, fixtures.
- `packages/adapters`: Codex, Claude, Gemini, OpenCode, and future adapters.

See `docs/architecture.md`, `docs/sync-model.md`, `docs/plugin-api.md`, and
`docs/maintainer-guide.md` for the design baseline, sync model, plugin API,
security boundaries, and maintainer workflow.

## Development Commands

The standard commands are:

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:desktop
pnpm release:smoke
```

The CI workflow runs the same install, lint, typecheck, test, and build
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

Contributions are welcome. Please read
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and the docs under
`docs/` before opening a pull request.

## License

TheOpenHub Skills Studio is licensed under the MIT License. See `LICENSE`.
