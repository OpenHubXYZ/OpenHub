# Testing

Testing follows the current inventory-first roadmap. The test suite should
prove local data safety, typed IPC, import staging, read-only indexing, sync
defaults, plugin constraints, and release packaging.

## Command Gates

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI must run the same gates.

## Shell And IPC Coverage

- Electron `BrowserWindow` options keep `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true`.
- The renderer shell displays OpenHub and stable Home, Inventory, Sources, and
  Settings navigation.
- The shared IPC contract validates retained channels and rejects unknown
  channels.
- Static renderer search must not find direct Node, filesystem, SQLite, or
  `ipcRenderer` access.

## Database Coverage

- Migrations run from empty database to latest and are idempotent.
- Current domain tables and the `skill_search` FTS5 table exist.
- Removed deploy/trust tables stay absent from the current schema.
- Repository tests cover create, list, update, FTS search, facets, indexed
  locations, and delete behavior.
- Test data uses `:memory:` SQLite databases or temp directories.
- App data directory tests inject fake home paths and do not touch real user
  directories.

## Library Indexing Coverage

- Fixture roots for `.codex/skills`, `.claude/skills`, `.gemini/skills`,
  `.opencode/skills`, and `.agents/skills` scan successfully.
- Missing `SKILL.md` and malformed metadata produce explainable scan errors.
- Indexed library rows preserve skill name, source agent, path, and visibility
  status.
- IPC contract tests cover `library.scan`, `library.list`, `library.search`,
  `library.facets`, `library.favorite`, and `library.detail`.
- Renderer tests cover empty, indexed, search result, selected detail, file
  tree, and `SKILL.md` preview states.
- Desktop runtime tests scan a detected local fixture root through typed IPC and
  then list the indexed inventory rows.

## Import Coverage

- Local folder, Git URL, and ZIP fixtures import into SQLite and the
  content-addressed blob store.
- ZIP slip and symlink escape fixtures are rejected before they can leave the
  staging boundary.
- Desktop runtime tests import local, Git, and ZIP fixtures through IPC and
  prove they are searchable inventory records.
- Renderer tests cover local inventory refresh and source preview actions.

## Discover Source Coverage

- Discover is rendered as source preview, not a marketplace.
- Runtime UI must not show ratings, trending, source reputation, trust levels,
  or risk scores.
- Adding a local or Git source records source metadata without importing skills
  or fetching a remote catalog by default.
- Source preview scans the configured source and caches candidate rows before
  import.
- First-launch coverage confirms detected local roots are shown before the
  workspace opens.
- Preview operations report candidate names, paths, tags, and verified metadata
  and do not write agent-root files.

## Version And Collection Coverage

- Identical support file contents dedupe to a single `blob_objects` row.
- Content-changing imports create new skill versions.
- Version diffs classify added, modified, and deleted files.
- Version compare reports file-level changes without writing external roots.
- Collections group local skill records.
- Renderer tests cover inventory rows and collection state where exposed.

## Sync Coverage

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
- Renderer tests cover disabled-by-default sync state in Settings.

## Plugin Coverage

- Manifest validation rejects missing fields, unknown permissions, unknown
  capabilities, incompatible API versions, unsafe entry paths, and integrity
  mismatches.
- Plugins with declared permissions cannot be enabled until those permissions
  have explicit active grants.
- The restricted host API registers only declared adapter, importer, and sync
  driver capabilities.
- Malicious fixtures with filesystem, network, process, dynamic import, or
  shell escape patterns are blocked before registration.
- Disabling a plugin removes its capabilities from the runtime registry.
- Renderer tests cover plugin disabled-default state and registry counters.

## Release Readiness Coverage

- Release readiness tests verify packaging scripts, checksum script, dependency
  inventory script, release smoke script, platform packaging target config,
  community health files, and README Quick Start coverage.
- `pnpm package:desktop` builds the workspace and writes a current-platform
  unpacked desktop payload under `out/packages`.
- `pnpm release:checksums` writes sha256 checksums for the generated package
  payload.
- `pnpm release:inventory` writes a dependency inventory for root and workspace
  package manifests.
- `pnpm release:smoke` verifies package entrypoints, packaged main startup under
  the Electron runtime, privacy defaults, database migrations, local/Git/ZIP
  import, FTS search, inventory flow, first-launch wizard, OS-backed
  credential-store boundary, sync-disabled default, plugin-disabled default,
  desktop runtime IPC coverage, and redacted release logs.

## Unit Test Targets

- `SKILL.md` parser.
- SQLite migrations.
- Repository create, list, update, search, facets, indexed location, and delete
  behavior.
- Path sanitizer.
- Agent adapter rules.
- Diff engine.
- IPC payload validation.
- Plugin manifest validation.
- Plugin host permission and registry behavior.
- Release readiness script and packaging config coverage.
- Maintainer operations documentation coverage.

## Integration Test Targets

- Fixture root scanning for supported agents.
- Local folder import.
- Git import.
- ZIP import.
- FTS library search and skill detail aggregation.
- Discover source preview and first-launch root detection.
- Version diff and compare.
- Optional sync push/pull.
- Plugin enable/disable with fixture roots.
- Current-platform package payload smoke.
- Maintainer workflow and ADR coverage.
- Large skill indexing.

## E2E And Smoke Targets

- First launch.
- Agent detection.
- Import a skill.
- Preview a source.
- Search inventory.
- Optional sync remains disabled until a profile is enabled.
- Plugins remain disabled until permissions are authorized and the plugin is
  enabled.
- Plugin adapter, importer, and sync driver providers appear only after
  explicit permission grant and enablement.
- Checksums and dependency inventory are generated for release artifacts.

## Security Fixtures

Security fixtures still cover platform boundaries:

- path traversal
- symlink escape
- ZIP slip
- token redaction
- renderer no direct Node, filesystem, or SQLite access
