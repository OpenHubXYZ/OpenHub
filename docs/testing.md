# Testing

Testing follows the roadmap phases. Phase 1 introduces the baseline command
gates and shell contract tests.

## Phase 0 Checks

```sh
git status --short --untracked-files=all
```

Expected evidence:

- `references/*.md` are trackable.
- Open-source files are visible.
- No product source code is included.

## Phase 1 Command Gates

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI must run the same gates.

## Phase 1 Contract Coverage

- Electron `BrowserWindow` options keep `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true`.
- The renderer shell displays the product name and empty library state.
- The shared IPC contract validates the `app.info` channel and rejects unknown
  channels.
- Static renderer search must not find direct Node, filesystem, SQLite, or
  `ipcRenderer` access.

## Phase 2 Database Coverage

- Migrations run from empty database to latest and are idempotent.
- Required domain tables and the `skill_search` FTS5 table exist.
- Repository tests cover create, list, update, FTS search, and delete.
- Test data uses `:memory:` SQLite databases.
- App data directory tests inject fake home paths and do not touch real user
  directories.

## Phase 3 Library Indexing Coverage

- Fixture roots for `.codex/skills`, `.claude/skills`, `.gemini/skills`, and
  `.opencode/skills` scan successfully.
- Missing `SKILL.md` and malformed metadata produce explainable scan errors.
- Indexed library rows preserve skill name, source agent, path, and install
  status.
- IPC contract tests cover `library.list`.
- Renderer tests cover both empty and indexed library states.

## Phase 4 Import And Install Coverage

- Local folder, Git URL, and ZIP fixtures import into SQLite and the
  content-addressed blob store.
- ZIP slip and symlink escape fixtures are rejected before they can leave the
  staging boundary.
- Install plans report existing-file conflicts before writing to an agent root.
- Clean install plans copy blobs into the target root and record app-owned file
  paths.
- Uninstall removes recorded files only and leaves unknown user files in place.
- Export writes a portable package with `manifest.json`, file paths, and
  SHA-256 hashes.
- Renderer tests cover the import queue, install plan, and install result flow
  panels.

## Phase 5 Security Governance Coverage

- Rule engine tests cover dangerous shell commands, external data transfer,
  sensitive file reads, path traversal references, executable scripts, and
  oversized files through the initial ruleset.
- High-risk fixtures are blocked before install.
- Medium-risk fixtures can install and return warnings.
- Security exemptions include reason, timestamp, and scope, and revoked
  exemptions no longer allow blocked installs.
- Batch rescans upsert the version/ruleset scan row instead of creating noisy
  duplicates.
- Renderer tests cover Security Center queue, risk score, rule details,
  history, and exemptions.

## Phase 6 History And Collections Coverage

- Identical support file contents dedupe to a single `blob_objects` row.
- Content-changing operations create new skill versions.
- Version diffs classify added, modified, and deleted files.
- Rollback rewrites installed app-owned files to match the target version and
  removes files that only existed in newer versions.
- Collections can be batch-exported to a portable package and imported into a
  fresh database.
- Renderer tests cover History, Diff, and Collections state.

## Phase 7 Offline-First Sync Coverage

- With no sync profile, startup planning returns no sync activity and leaves
  outbox/events empty.
- Local changes are queued only after the referenced local skill version exists
  in SQLite.
- Shared-folder sync writes queued package JSON and pulls inbox package JSON
  without applying remote state directly to skill tables.
- Git sync initializes a package repository, commits queued packages, and pulls
  package records back.
- Conflict lifecycle tests open a base/local/remote conflict and record an
  explicit resolution.
- Renderer tests cover Sync Center profiles, outbox, inbox, and conflicts.

## Phase 8 Plugin Runtime Coverage

- Manifest validation rejects missing fields, unknown permissions, unknown
  capabilities, incompatible API versions, unsafe entry paths, and integrity
  mismatches.
- Plugins with declared permissions cannot be enabled until those permissions
  have explicit active grants.
- The restricted host API registers only declared capabilities.
- An example plugin adds a mock agent adapter through the host API.
- Malicious fixtures with filesystem, network, process, dynamic import, or
  shell escape patterns are blocked before registration.
- Disabling a plugin removes its capabilities from the runtime registry.
- Renderer tests cover Plugins status, capabilities, permissions, and error
  logs.

## Phase 9 Release Readiness Coverage

- Release readiness tests verify packaging scripts, checksum script, dependency
  inventory script, release smoke script, platform packaging target config,
  community health files, and README Quick Start coverage.
- `pnpm package:desktop` builds the workspace and writes a current-platform
  unpacked desktop payload under `out/packages`.
- `pnpm release:checksums` writes sha256 checksums for the generated package
  payload.
- `pnpm release:inventory` writes a dependency inventory for root and workspace
  package manifests.
- `pnpm release:smoke` verifies package entrypoints, privacy defaults, database
  migrations, the Phase 4 import/install flow, first-launch window options, and
  redacted release logs.

## Unit Test Targets

- `SKILL.md` parser.
- SQLite migrations.
- Repository create, list, update, search, and delete behavior.
- Path sanitizer.
- Agent adapter rules.
- Diff engine.
- Security rules.
- IPC payload validation.
- Plugin manifest validation.
- Plugin host permission and registry behavior.
- Release readiness script and packaging config coverage.

## Integration Test Targets

- Fixture root scanning for Codex, Claude, Gemini, and OpenCode.
- Local folder import.
- Git import.
- ZIP import.
- Install and uninstall safety.
- Export and re-import.
- Rollback.
- Optional sync push/pull.
- Plugin enable/disable with fixture roots.
- Current-platform package payload smoke.
- Large skill indexing.

## E2E And Smoke Targets

- First launch.
- Agent detection.
- Import a skill.
- Security scan blocks a high-risk skill.
- Install to personal and project scopes.
- Resolve a sync conflict after sync exists.
- Packaged app starts and completes the Phase 4 core flow.
- Optional sync remains disabled until a profile is enabled.
- Plugins remain disabled until permissions are authorized and the plugin is
  enabled.
- Checksums and dependency inventory are generated for release artifacts.

## Security Fixtures

Security tests must cover:

- path traversal
- symlink escape
- ZIP slip
- command injection patterns
- sensitive file reads
- token redaction
- renderer no direct Node, filesystem, or SQLite access
