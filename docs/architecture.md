# Architecture

OpenHub is a local-first Electron desktop application for indexing and
organizing AI coding agent skills.

## Stack Choice

- Electron provides the desktop shell and main-process privilege boundary.
- React and Vite provide the renderer UI.
- Node in the main process handles filesystem, archive, Git, adapter, sync, and
  plugin work.
- SQLite is the local source of truth for domain state.
- TypeScript keeps IPC, services, adapters, and UI contracts typed.

## Process Boundaries

Renderer code is untrusted relative to local data and must not directly access
Node, the filesystem, SQLite, or `ipcRenderer`. The desktop shell uses:

- `contextIsolation: true`
- `nodeIntegration: false`
- typed preload IPC
- runtime validation for every IPC payload

The Electron main process owns privileged services:

- database access
- filesystem scanning
- archive extraction
- Git import
- keychain references for future credentials
- sync drivers
- plugin host APIs

The current runtime treats agent roots as read-only inventory inputs. It does
not deploy, uninstall, roll back, score, or block skills in external agent
directories.

## Workspace Layout

- `apps/desktop`: Electron main process, preload IPC, Vite React renderer.
- `packages/shared`: shared types, schemas, IPC contracts, constants.
- `packages/core`: domain services for parsing, indexing, imports, versions,
  collections, source preview, sync, and plugins.
- `packages/db`: SQLite migrations, repositories, fixtures.
- `packages/adapters`: built-in read-only agent adapters.

## Local Source Of Truth

SQLite stores the authoritative state:

- skills
- skill versions
- skill files
- blob metadata
- sources and Discover preview cache
- agents and roots
- indexed skill locations
- collections
- sync profiles and events
- plugin manifests and permissions

Agent directories can be scanned, but they are not the app's persistence layer
and are not mutated by current runtime workflows.

## Database Implementation

`packages/db` uses `better-sqlite3`. The migration runner applies migrations
transactionally and records them in `schema_migrations` so running from an empty
database to latest is idempotent.

Current schema areas:

- domain tables for skills, versions, files, blob objects, sources, agents,
  agent roots, indexed locations, and collections
- FTS5 search over skill name, description, tags, and file paths
- disabled-by-default sync profiles, outbox, inbox, conflict records, and
  events
- plugin manifests, declared permission grants, and plugin error logs
- Discover sources and cached preview rows for local/Git source listings

Repository tests use `:memory:` databases. They do not write to real user
directories or agent roots.

## Data Flow

1. Built-in adapters detect local skill roots for supported agents.
2. The scanner reads `SKILL.md` directories and records indexed locations in
   SQLite.
3. Importers stage local folders, Git repositories, or archives in isolated
   temporary directories.
4. Path checks reject traversal, ZIP slip, symlink escape, and writes outside
   allowed staging roots.
5. Parsed skill metadata and file hashes are written to SQLite.
6. File contents are stored in a content-addressed blob store.
7. Version, diff, collection, source preview, sync, and plugin workflows read
   from the same local SQLite state.

## Runtime IPC Integration

`apps/desktop/src/main/desktop-runtime.ts` opens the app data SQLite database,
runs migrations, creates the content store, and dispatches typed IPC channels
through shared Zod contracts.

Runtime channels currently cover:

- `workspace.state`: aggregate app, library, import, version, collection, sync,
  plugin, and source-preview state.
- `app.info`, `app.onboarding.get`, and `app.onboarding.complete`: app metadata
  and first-run state.
- `agentRoots.list`, `agentRoots.detect`, and `agentRoots.addProjectRoot`:
  detect and register local roots for indexing.
- `library.scan`, `library.list`, `library.search`, `library.facets`,
  `library.favorite`, and `library.detail`: scan roots, query inventory, and
  aggregate selected skill metadata and files.
- `import.localFolder`, `import.git`, and `import.zip`: stage and import local
  folders, Git URLs, and ZIP archives.
- `collection.create`: group local skill records.
- `version.list`, `version.diff`, and `version.compare`: inspect version
  history and file changes.
- `sync.startupPlan`, `sync.createProfile`, `sync.enqueueLocalChange`,
  `sync.push`, `sync.pull`, `sync.listConflicts`, and `sync.resolveConflict`:
  keep sync disabled by default and expose explicit profile, push/pull, and
  conflict operations.
- `plugins.centerState`, `plugins.install`, `plugins.authorizePermission`,
  `plugins.enable`, `plugins.disable`, and `plugins.registry`: add plugin
  folders, authorize declared permissions, enable/disable plugins, and inspect
  registered capabilities.
- `discover.addSource` and `discover.previewSource`: configure local/Git
  sources and preview candidates before import.

The preload bridge validates every response before exposing it to the renderer.

## Renderer Model

The renderer uses four primary pages:

- Home: metrics, first-run steps, and scan status.
- Inventory: indexed and imported skills.
- Sources: local/Git source preview.
- Settings: roots, sync status, and plugin registry.

Renderer code consumes typed preload APIs only. It must not reach into Node,
SQLite, the filesystem, or Electron IPC directly.

## Offline And Sync

The app starts offline and performs no sync activity without a user-created
sync profile. Sync is an optional layer on top of local SQLite transactions,
outbox and inbox records, conflict objects, and explicit drivers.

Drivers exchange portable change packages; they do not bypass the database as
the local source of truth. Current drivers cover shared-folder package files,
Git-backed package commits, and a mock REST mode for contract tests.

Conflicts are stored with base, local, remote, status, and resolution payloads
so UI and future main-process workflows can require an explicit choice before
applying divergent remote state.

## Plugin Boundary

Plugins are constrained extensions for adapters, importers, and sync drivers.
They must declare capabilities and permissions in `plugin.json`, pass integrity
validation for their entry file, and receive explicit permission authorization
before enabling.

The v1 plugin host exposes registration methods only. It does not expose
filesystem, network, shell, process, or SQLite APIs to plugin code. The
implementation also preflights entry source for unsafe runtime escape patterns.
This is a capability boundary, not a substitute for reviewing untrusted plugin
code before enabling it.

## Source Preview

The Discover layer is local-first and preview-oriented:

- `discover_sources` stores configured local or Git sources.
- `discover_source_cache` stores preview rows for skill name, description,
  tags, path, and verified metadata.
- Adding a source does not import skills or write agent roots.
- Preview scans happen only when the user explicitly asks to preview.
- Non-standard directories are covered by ordinary import flows.

The runtime does not expose marketplace ratings, source reputation, trust
levels, or risk status.

## Release Readiness

Release readiness is verified by:

- workspace build, lint, typecheck, and test gates
- current-platform unpacked desktop packaging
- release smoke for package entrypoints, native SQLite runtime, database
  migrations, local/Git/ZIP import, inventory flow, source preview, sync
  disabled default, plugin disabled default, and renderer privilege boundaries
- checksum and dependency inventory scripts
- redacted release logs

## Maintainer Operations

Maintainer docs cover triage, release, private vulnerability intake, dependency
updates, fixture rules, contributor recipes, roadmap workflow, and ADRs.
