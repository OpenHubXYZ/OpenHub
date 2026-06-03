# Architecture

TheOpenHub Skills Studio is planned as a local-first Electron desktop
application for managing AI coding agent skills.

## Stack Choice

The repository planning documents select Electron + React + Node + SQLite for
the first implementation:

- Electron provides the desktop shell and main-process boundary.
- React and Vite provide the renderer UI.
- Node in the main process handles filesystem, archive, Git, and adapter work.
- SQLite is the local source of truth for domain state.
- TypeScript keeps IPC, services, adapters, and UI contracts typed.

The alternative Tauri path remains useful background from the research report,
but this project's implementation plan intentionally adopts the Electron
alternative for the initial open-source project.

## Process Boundaries

Renderer code is untrusted relative to local data and must not directly access
Node, the filesystem, or SQLite. The planned desktop shell must use:

- `contextIsolation: true`
- `nodeIntegration: false`
- typed preload IPC
- runtime validation for every IPC payload

The Electron main process owns privileged services:

- database access
- filesystem scanning
- archive extraction
- Git import
- agent directory writes
- keychain access
- security scanning
- sync and plugin host APIs

## Workspace Layout

Planned packages:

- `apps/desktop`: Electron main process, preload IPC, Vite React renderer.
- `packages/shared`: shared types, schemas, IPC contracts, constants.
- `packages/core`: domain services and policies.
- `packages/db`: SQLite migrations, repositories, fixtures.
- `packages/adapters`: built-in agent adapters.

## Local Source Of Truth

SQLite stores the authoritative state:

- skills
- skill versions
- skill files
- blob metadata
- sources
- agents and roots
- installations
- collections
- security scans
- sync profiles and events
- plugin manifests and permissions

Agent directories are deployment projections. The app records what it writes so
uninstall and rollback can avoid deleting unknown user files.

## Phase 2 Database Implementation

The Phase 2 implementation lives in `packages/db` and uses `better-sqlite3`.
The migration runner applies migrations transactionally and records them in
`schema_migrations` so running from an empty database to latest is idempotent.

Implemented migrations:

- `001_domain_schema`: skills, skill versions, skill files, blob objects,
  sources, agents, agent roots, installations, collections, collection items,
  security scans, and security findings.
- `002_skill_search_fts`: FTS5 search over skill name, description, tags, and
  file paths.

Repository tests use `:memory:` databases. They do not write to real user
directories or agent roots.

## Data Flow

1. Importers stage local folders, Git repositories, or archives in isolated
   temporary directories.
2. Path checks reject traversal, ZIP slip, symlink escape, and writes outside
   allowed roots.
3. Parsed skill metadata and file hashes are written to SQLite.
4. File contents are stored in a content-addressed blob store.
5. Installation creates a plan, runs security checks, resolves conflicts, then
   projects files into an agent root.
6. Verification compares recorded hashes with target files.

## Offline And Sync

The app starts offline and performs no sync activity without a user-created
sync profile. Sync is planned as an optional layer on top of local SQLite
transactions, outbox and inbox records, conflict objects, and explicit drivers.

## Plugin Boundary

Plugins are planned as constrained extensions for adapters, importers, security
rules, and sync drivers. They must declare permissions and should not receive
broad filesystem or network access by default.
