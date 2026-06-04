# Architecture

OpenHub is a local-first Electron desktop
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
Node, the filesystem, or SQLite. The desktop shell uses:

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

Workspace packages:

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
- `003_installation_files`: app-owned install file records used by uninstall
  and rollback-safe file projection.
- `004_security_exemptions`: unique security scan records per version/ruleset
  plus scoped exemptions with reason, timestamp, and revocation.
- `005_sync_state`: disabled-by-default sync profiles, local outbox, remote
  inbox, conflict records, and sync events.
- `006_plugin_runtime`: plugin manifests, declared permission grants, and
  plugin error logs.

Repository tests use `:memory:` databases. They do not write to real user
directories or agent roots.

## Data Flow

1. Importers stage local folders, Git repositories, or archives in isolated
   temporary directories.
2. Path checks reject traversal, ZIP slip, symlink escape, and writes outside
   allowed roots.
3. Parsed skill metadata and file hashes are written to SQLite.
4. File contents are stored in a content-addressed blob store.
5. Installation creates a plan, reports conflicts, then clean plans project
   files into an agent root and record app-owned targets.
6. Later security and verification phases will compare recorded hashes with
   target files before broader release gates.

## Runtime IPC Integration

The desktop runtime uses the Electron main process as the only privileged
process. `apps/desktop/src/main/desktop-runtime.ts` opens the app data SQLite
database, runs migrations, creates the content store, and dispatches typed IPC
channels through shared Zod contracts.

Runtime channels currently cover:

- `workspace.state`: aggregate app, library, management, security, governance,
  sync, and plugin panel state.
- `library.scan` and `library.list`: scan detected Codex, Claude, Gemini, and
  OpenCode roots, then list indexed installed projections.
- `import.localFolder`: stage and import a local skill directory.
- `install.createPlan` and `install.applyPlan`: create conflict-aware copy
  projection plans and apply clean plans.
- `security.scan`: scan the latest skill version and persist findings.
- `sync.startupPlan`: prove sync remains disabled without an enabled profile.
- `plugins.centerState`: expose constrained plugin runtime state.

The preload bridge validates every response before exposing it to the renderer.
Renderer code still has no direct Node, filesystem, SQLite, or `ipcRenderer`
access.

## Offline And Sync

The app starts offline and performs no sync activity without a user-created
sync profile. Phase 7 implements sync as an optional layer on top of local
SQLite transactions, outbox and inbox records, conflict objects, and explicit
drivers.

Local writes must exist in SQLite before they can be queued in `sync_outbox`.
Drivers exchange portable change packages; they do not bypass the database as
the local source of truth. The first drivers cover shared-folder package files
and Git-backed package commits. A mock REST mode exists for service contracts
and conflict lifecycle tests without introducing live network behavior.

Conflicts are stored in `sync_conflicts` with base, local, remote, status, and
resolution payloads so UI and future main-process workflows can require an
explicit choice before applying divergent remote state.

## Plugin Boundary

Plugins are constrained extensions for adapters, importers, security rules, and
sync drivers. They must declare capabilities and permissions in `plugin.json`,
pass integrity validation for their entry file, and receive explicit permission
authorization before enabling.

Phase 8 executes the v1 plugin entry through a restricted host API that exposes
registration methods only. It does not expose filesystem, network, shell,
process, or SQLite APIs to plugin code. The implementation also preflights
entry source for unsafe runtime escape patterns. This is a governance and
capability boundary, not a substitute for reviewing untrusted plugin code before
installation.

## Phase 3 Agent Indexing

The Phase 3 implementation adds a read-only indexing path:

- `packages/adapters` defines `AgentAdapter` and built-in adapters for Codex,
  Claude, Gemini, and OpenCode.
- Built-in adapters detect default user skill roots under the provided home
  directory and list installed skill directories that contain `SKILL.md`.
- `packages/core` parses YAML frontmatter from `SKILL.md` and returns
  explainable errors for missing or malformed metadata.
- The scanner reads fixture roots, writes skills, versions, files, agents,
  roots, and installation records into SQLite, and keeps invalid skills as scan
  errors instead of crashing.
- `library.list` is a typed IPC channel for renderer library queries.

## Phase 4 Import And Install Loop

The Phase 4 implementation adds the first write-capable management loop while
keeping SQLite authoritative:

- `packages/core` stages local folders, Git clones, and ZIP archives under an
  isolated temp directory before parsing `SKILL.md`.
- `path-safety` canonicalizes roots and candidate paths, rejects symlink escape,
  and rejects ZIP entries with absolute paths or `..` traversal.
- `content-store` writes file contents by SHA-256 hash so database blob metadata
  and file bytes stay linked.
- Install planning computes target root, skill directory, writes, and conflict
  state before any agent directory write occurs.
- Install application copies blobs into the agent root and records every
  app-owned target file in `installation_files`.
- Uninstall deletes only those recorded file paths and leaves unknown user files
  in place.
- Export writes `manifest.json` plus a `files/` tree containing the skill files
  and recorded hashes.
- The renderer shows the P0 import queue, install plan, and install result
  state without direct Node, filesystem, SQLite, or `ipcRenderer` access.

## Phase 5 Security Governance

The Phase 5 implementation adds pre-install security governance:

- `security-service` defines `SecurityRule`, scan results, findings, risk
  scoring, and install policy results.
- Initial rules cover dangerous shell commands, external data transfer,
  sensitive file reads, path traversal references, executable scripts, and
  oversized files.
- Scans are recorded in `security_scans` and `security_findings`; rescans use a
  stable version/ruleset key so repeated batch rescans update existing records
  instead of creating noisy duplicates.
- `createInstallService()` evaluates the current security policy before writing
  files. High and critical results are blocked by default.
- Scoped exemptions are recorded in `security_exemptions` with reason and
  timestamp and can be revoked. Active exemptions allow a blocked install for
  the matching skill and scope.
- Low and medium findings are returned as install warnings.
- The renderer can display Security Center state for scan queue, risk score,
  rule details, scan history, and exemptions without privileged access.

## Phase 6 History And Collections

The Phase 6 implementation adds governance history on top of the existing
content-addressed blob store:

- `version-service` creates new `skill_versions` rows for content-changing
  operations, writes `skill_files`, and dedupes identical blob hashes through
  `blob_objects`.
- Version listing exposes newest-first history.
- File diffs classify added, modified, and deleted paths by comparing version
  file hashes.
- Installation rollback rewrites only the app-owned projection for a target
  installation and version, removes files that are no longer in the target
  version, and updates install file ownership records.
- `collection-service` creates collections, exports all latest skill files in a
  portable package, and imports that package into a fresh SQLite database.
- The renderer can display History, Diff, and Collections state without
  privileged access.

## Phase 7 Offline-First Sync

The Phase 7 implementation keeps sync opt-in and local-first:

- `sync_profiles` controls mode, remote location, enabled state, and last sync
  timestamp. No profile means no startup sync activity.
- `sync_outbox` records local entity changes after the local entity exists in
  SQLite.
- `sync_inbox` records pulled remote packages with a unique remote event key per
  profile.
- `sync_events` captures inbound, outbound, and conflict lifecycle events.
- `sync_conflicts` stores local, remote, and base payloads until an explicit
  resolution is recorded.
- `sync-service` exposes shared-folder, Git, and mock REST mode contracts. The
  shared-folder driver writes package JSON to an outbox directory and reads
  inbox package JSON. The Git driver initializes a package repository, writes
  package files, commits queued changes, and reads package files back.
- The renderer can display Sync Center state for profiles, outbox, inbox, and
  conflicts without privileged access.

## Phase 8 Plugin Runtime

The Phase 8 implementation adds a disabled-by-default plugin management layer:

- `plugin_manifests` stores manifest metadata, capabilities, permissions,
  integrity metadata, root path, status, and enabled state.
- `plugin_permission_grants` records explicit permission authorizations with a
  reason and revocation slot.
- `plugin_errors` records host execution, unsafe entry, and permission errors
  for Plugins UI review.
- `plugin-service` validates required manifest fields, supported API version,
  known capability types, known permissions, safe entry paths, and sha256 entry
  integrity.
- Enabling a plugin requires all declared permissions to have active grants.
- The restricted host API supports registration for agent adapters, importers,
  security rules, and sync drivers. Each registration must match a declared
  capability.
- Disabling a plugin removes its capabilities from the in-memory registry and
  marks it disabled in SQLite.
- The renderer can display Plugins state for install status, capabilities,
  permissions, and error logs without privileged access.

## Phase 9 Release Packaging

The Phase 9 implementation adds release-readiness tooling without checking in
generated artifacts:

- `config/desktop-packaging.json` records product identity and macOS, Windows,
  and Linux package target metadata.
- `package:desktop` builds the workspace and writes a current-platform unpacked
  payload under `out/packages`.
- The package payload includes renderer, main, preload, package metadata,
  runtime external dependencies, Electron ABI native SQLite runtime, license,
  changelog, README, security policy, and a release manifest.
- The release manifest records entrypoints and privacy defaults: no telemetry,
  no automatic sync profile, and no automatically enabled plugin.
- `release:checksums` writes sha256 checksums for package payload files.
- `release:inventory` writes a dependency inventory for root and workspace
  package manifests.
- `release:smoke` validates package entrypoints, packaged main startup under
  the Electron runtime, privacy defaults, database migration coverage, Phase 4
  import/install smoke, first-launch window options, and redacted release logs.

## Phase 10 Maintainer Operations

The Phase 10 implementation adds long-term open-source operating structure:

- ADRs under `docs/adr/` capture major architecture decisions.
- `docs/maintainer-guide.md` gives maintainers a single triage, release, and
  security intake workflow.
- `docs/triage-policy.md` and `docs/issue-labels.md` standardize issue intake.
- `docs/dependency-policy.md` defines dependency risk notes and required
  verification.
- `docs/security-response-playbook.md` defines private vulnerability handling.
- `docs/fixture-contribution.md` prevents committing real skill contents,
  tokens, user paths, or agent snapshots.
- `docs/roadmap-workflow.md` keeps roadmap changes public and reviewable.
- `docs/contributor-recipes.md` teaches safe adapter, security rule, sync
  driver, and fixture contributions.
- CI now includes desktop packaging and release smoke gates.
