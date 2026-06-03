# Roadmap

This roadmap mirrors the high-standard development plan in `references/`.
Each phase must pass acceptance before the next phase expands product scope.

## Phase 0: Open-Source Repository Foundation

- Track planning references.
- Add MIT license, community health files, and baseline docs.
- Keep the repository documentation-only with no product code.

Acceptance: `git status --short --untracked-files=all` shows references and
open-source files, and docs explain status, privacy, architecture, and roadmap.

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

- Add Codex, Claude, Gemini, and OpenCode adapters.
- Parse `SKILL.md` files.
- Expose Library, Skill Detail, and Settings roots UI.

Acceptance: fixture roots scan, malformed files produce explainable errors, and
IPC library tests pass.

## Phase 4: Import, Export, Install, Uninstall

- Add local folder, Git, and ZIP importers.
- Add path sanitization, conflict planning, copy projection, uninstall, and
  portable export packages.

Acceptance: fixture imports, security rejection fixtures, install plans,
uninstall safety, and UI flows pass.

## Phase 5: Security Center And Governance

- Add security rule engine, risk scoring, scan history, exemptions, and install
  blocking.

Acceptance: high-risk fixtures block before install and exemption lifecycle
tests pass.

## Phase 6: Version History, Blob Store, Collections

- Add content-addressed file storage, version creation, diff, rollback,
  collections, and batch operations.

Acceptance: dedupe, versioning, diff, rollback, and collection tests pass.

## Phase 7: Offline-First Sync

- Add disabled-by-default sync profiles, outbox, inbox, shared folder sync, Git
  sync, mock REST interface, and conflict center.

Acceptance: no profile means no sync activity, fixture sync works, and conflict
lifecycle tests pass.

## Phase 8: Plugin Runtime And Extension APIs

- Add manifest validation, constrained host API, permissions, and plugin UI.

Acceptance: unauthorized plugins cannot access agent roots or network APIs, and
example plugin contract tests pass.

## Phase 9: Packaging, Release, OSS Launch

- Add desktop packaging, smoke tests, release checklist, checksums, dependency
  inventory, and launch README.

Acceptance: current-platform package build and Phase 4 smoke flow pass.

## Phase 10: Maintainer Operations

- Add ADRs, triage policy, maintainer guide, dependency update policy, security
  response playbook, and fixture contribution rules.

Acceptance: maintainers can triage, release, handle security intake, and guide
contributors through adapters, rules, sync drivers, and fixtures.
