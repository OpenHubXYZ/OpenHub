# Sync Model

Phase 7 implements optional offline-first sync without changing the local-first
default. A fresh database has no enabled sync profiles and performs no sync
startup work.

## State Tables

- `sync_profiles`: opt-in profiles with mode, remote location, enabled state,
  and last synced timestamp.
- `sync_outbox`: local change packages queued only after the local SQLite entity
  already exists.
- `sync_inbox`: pulled remote packages keyed by profile and remote event ID so
  duplicate pulls are ignored.
- `sync_conflicts`: base, local, remote, status, and resolution payloads for
  divergent state that needs explicit user resolution.
- `sync_events`: append-only inbound, outbound, and conflict lifecycle events.

## Drivers

The core service uses driver contracts so storage transport stays separate from
local domain state.

- `shared-folder`: writes JSON packages to a profile outbox directory and reads
  JSON packages from an inbox directory.
- `git`: writes JSON packages into a local Git repository, commits queued
  changes, and reads package files back for pull tests.
- `mock-rest`: reserves the mode for REST interface contracts and conflict
  lifecycle tests. No live network driver is enabled in Phase 7.

## User Workflow

Sync is surfaced in Settings as an explicit action center:

- create a disabled or enabled profile for `shared-folder`, `git`, or
  `mock-rest`
- enqueue a local change only after the local entity exists in SQLite
- push queued packages to the selected profile
- pull remote packages into `sync_inbox`
- list open conflicts and record an explicit resolution

The desktop app does not auto-start sync on a fresh database. Startup planning
returns `shouldStart: false` until at least one profile is enabled.

## Boundaries

- Sync is disabled until a profile is created and enabled.
- SQLite remains the local source of truth; drivers move packages but do not
  apply remote state directly to skill tables.
- Local writes are persisted before outbox enqueue.
- Conflict resolution records the chosen resolution before future workflows can
  apply it.
- Credentials and remote authentication references are represented as `auth_ref`
  values. Secrets must stay outside plaintext SQLite and use the OS keychain
  when implemented.
