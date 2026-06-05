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
- IPC contract tests cover `library.scan`, `library.list`, `library.search`,
  and `library.detail`.
- Renderer tests cover empty, indexed, search result, selected detail, file tree,
  and `SKILL.md` preview states.
- Desktop runtime tests scan a detected local Codex fixture root through typed
  IPC and then list the indexed installed projection.

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
- Desktop runtime tests import local, Git, and ZIP fixtures through IPC, create
  an install plan, apply the plan, verify copied files on disk, export skill and
  collection packages, uninstall app-owned files, and then list runtime state.
- Renderer tests cover interactive agent-root scan, local/Git/ZIP import,
  install plan, install result, skill export, and collection controls.

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
  history, rescans, and exemption create/revoke actions.

## Phase 6 History And Collections Coverage

- Identical support file contents dedupe to a single `blob_objects` row.
- Content-changing operations create new skill versions.
- Version diffs classify added, modified, and deleted files.
- Rollback rewrites installed app-owned files to match the target version and
  removes files that only existed in newer versions.
- Collections can be batch-exported to a portable package and imported into a
  fresh database.
- Renderer tests cover History, Diff, and Collections state.

## Discover Source And Migration Coverage

- Adding a local or Git source records source metadata without importing skills
  or fetching a remote catalog by default.
- Source preview scans the configured source and caches candidate rows before
  import.
- Migration preview fixtures cover OpenSkills, Skills-Manager, SkillHub, and
  skills-manager-client layouts.
- Preview operations report candidate names, paths, tags, and risk status and
  do not write agent-root files.
- Renderer tests cover source add, source preview, and migration preview
  actions through preload IPC.

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
- Renderer tests cover creating an opt-in sync profile and explicit push/pull
  actions through preload IPC.

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
  logs, plus install, permission authorization, enable, disable, and registry
  counters.

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
- `pnpm release:smoke` verifies package entrypoints, packaged main startup under
  the Electron runtime, privacy defaults, database migrations, local/Git/ZIP
  import, advanced TAR/sparse-Git/mirror import UI, signed export UI, FTS
  search, skill export, install, app-owned uninstall, first-launch wizard,
  OS-backed credential-store boundary, sync-disabled default, plugin-disabled
  default, sync conflict center, policy/baseline UI, plugin provider workflows,
  desktop runtime IPC coverage, and redacted release logs.

## Phase 10 Maintainer Operations Coverage

- Maintainer operations tests verify ADR template and accepted ADRs for
  Electron, SQLite source of truth, sync disabled by default, and plugin
  permissions.
- Governance docs cover maintainer guide, triage policy, issue labels,
  dependency policy, security response playbook, fixture contribution rules, and
  public roadmap workflow.
- Contributor recipes explain how to add an adapter, security rule, sync driver,
  and fixture.
- CI runs package and release smoke gates after lint, typecheck, test, and
  build.

## Mockup Renderer Coverage

- Renderer tests cover the shared desktop shell, primary page navigation,
  Dashboard, Library, Discover, Installs, Usage, Reviews, Security, and
  Settings headings plus right rails.
- Browser verification uses the local renderer target at 1487 x 1058 and checks
  Dashboard, Discover, Usage, Reviews, and Security screenshots for visible
  shell structure, first-screen content, status bar overflow, and console/network
  health.
- `usage_events`, `review_items`, and `review_notes` are SQLite-backed local
  state. Runtime tests prove import, agent scan, install plan creation, install
  application, and security scan append usage events under temp app-data
  directories only.
- High and medium security scan findings generate review queue items without
  applying or approving install plans. Review status transitions are explicit
  repository calls.
- In the web-only renderer target, source catalog, community signal, visual
  usage samples, and mockup source rows remain fixture-backed so the static
  mockup pages can be visually verified without live network, user home scans,
  or Electron preload APIs.

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
- Maintainer operations documentation coverage.
- Runtime-backed usage and review center state before fixture-backed renderer
  rows.

## Integration Test Targets

- Fixture root scanning for Codex, Claude, Gemini, and OpenCode.
- Local folder import.
- Git import.
- ZIP import.
- FTS library search and skill detail aggregation.
- Install and uninstall safety.
- Export and re-import.
- Discover source preview and migration preview.
- Rollback.
- Optional sync push/pull.
- Plugin enable/disable with fixture roots.
- Current-platform package payload smoke.
- Maintainer workflow and ADR coverage.
- Large skill indexing.

## E2E And Smoke Targets

- First launch.
- Agent detection.
- Import a skill.
- Security scan blocks a high-risk skill.
- Install to personal and project scopes.
- Resolve a sync conflict after sync exists.
- Packaged main startup smoke completes local/Git/ZIP import, search, export,
  install, and app-owned uninstall under the Electron runtime.
- Optional sync remains disabled until a profile is enabled.
- Plugins remain disabled until permissions are authorized and the plugin is
  enabled.
- Plugin adapter, importer, security rule, and sync driver providers appear only
  after explicit permission grant and enablement.
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
