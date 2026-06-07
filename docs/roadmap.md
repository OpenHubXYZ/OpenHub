# Roadmap

The current roadmap is skills-first. Historical planning documents in
`references/` remain useful context, but the current product no longer includes
agent-root deploy workflows, trust scoring, policy packs, or review queues.
Root writes are limited to explicit app-owned copy/symlink install plans.

## Phase 0: Open-Source Repository Foundation

- Track planning references.
- Add MIT license, community health files, and baseline docs.

Acceptance: open-source files are visible and docs explain status, privacy,
architecture, and roadmap.

## Phase 1: Workspace, Tooling, CI Baseline

- Scaffold pnpm workspace.
- Add Electron + Vite + React shell.
- Add TypeScript, Vitest, ESLint, Prettier, and GitHub Actions.

Acceptance: install, lint, typecheck, test, build, and dev shell work locally.

## Phase 2: SQLite Domain Foundation

- Add migrations and repositories.
- Add fixtures and FTS5 search.
- Document SQLite source of truth.

Acceptance: idempotent migrations and repository tests pass without writing to
real user directories.

## Phase 3: Agent Detection And Library Indexing

- Add Codex, Claude, Gemini, OpenCode, and Agents adapters.
- Parse `SKILL.md` files.
- Expose Skills search, Skill Detail, and Settings roots UI.

Acceptance: fixture roots scan, malformed files produce explainable errors, and
IPC library search/detail tests pass.

## Phase 4: Import Into Local Skills Library

- Add local folder, Git, and ZIP importers.
- Add path sanitization and isolated staging.
- Store imported file contents in the content-addressed store.

Acceptance: fixture imports, ZIP slip rejection, symlink escape rejection,
search, detail, and renderer import state tests pass.

## Phase 4.5: Marketplace Sources And Root-Aware Installs

- Add local and Git source configuration.
- Cache source preview listings.
- Keep first launch focused on common local root detection.
- Route non-standard directories through ordinary local folder, Git, ZIP, TAR,
  sparse-Git, or mirror imports when supported.
- Add copy/symlink install plans for imported skills.
- Add app-owned uninstall that removes only recorded installation files.

Acceptance: adding a source performs no network or import writes by itself,
preview reports candidate skills before import, first-launch root detection is
read-only, install conflicts require explicit overwrite confirmation, uninstall
preserves user-created files, and no account, telemetry, remote catalog fetch,
trust level, or risk score is required by default.

## Phase 5: Version History, Blob Store, Collections

- Extend content-addressed file storage with version creation, file diff,
  compare, and collections.

Acceptance: dedupe, versioning, diff, compare, and collection tests pass.

## Phase 6: Offline-First Sync

- Add disabled-by-default sync profiles, outbox, inbox, shared folder sync, Git
  sync, mock REST interface, and conflict center.

Acceptance: no profile means no sync activity, shared-folder and Git fixture
sync work through explicit push/pull actions, credentials are represented by
`auth_ref`, and conflict lifecycle tests pass.

## Phase 7: Plugin Runtime And Extension APIs

- Add manifest validation, constrained host API, permissions, and plugin UI.

Acceptance: unauthorized plugins cannot enable, unsafe entries and integrity
mismatches fail visibly, registered adapter/importer/sync capabilities appear
only after enablement, disabling a plugin removes them from the registry, and
example plugin contract tests pass.

## Phase 8: Packaging, Release, OSS Launch

- Add desktop packaging, smoke tests, release checklist, checksums, dependency
  inventory, and launch README.

Acceptance: current-platform package build and smoke coverage for search,
local/Git/ZIP import, skills flow, marketplace source preview, sync disabled
default, and plugin disabled default pass.

## Phase 9: Maintainer Operations

- Add ADRs, triage policy, maintainer guide, dependency update policy, security
  response playbook, fixture contribution rules, contributor recipes, and
  public roadmap workflow.

Acceptance: maintainers can triage, release, handle security intake, and guide
contributors through adapters, importers, sync drivers, and fixtures.
