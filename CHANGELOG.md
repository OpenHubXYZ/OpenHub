# Changelog

All notable changes to TheOpenHub Skills Studio will be documented in this
file.

The format follows Keep a Changelog and the project uses semantic versioning
after the first release.

## Unreleased

### Added

- Open-source repository foundation.
- MIT license.
- Community health files.
- Architecture, development, testing, release, and roadmap documentation.
- Trackable planning references.
- pnpm TypeScript workspace.
- Electron, Vite, and React desktop shell.
- Baseline shared, core, database, and adapters packages.
- Vitest, ESLint, Prettier, and GitHub Actions CI baseline.
- Typed shell IPC contract tests and renderer empty-state smoke coverage.
- SQLite migration runner with Phase 2 domain schema.
- FTS5 skill search table.
- Skill repository create, list, update, search, and delete coverage.
- App data directory resolver tests that avoid real user directories.
- Codex, Claude, Gemini, and OpenCode root detection adapters.
- `SKILL.md` parser with explainable malformed-file errors.
- Agent library scanner that indexes fixture roots into SQLite.
- Library list IPC contract and renderer rows for indexed skills.
- Installation file ownership migration for safe uninstall bookkeeping.
- Content-addressed blob store for imported skill files.
- Local folder, Git URL, and ZIP import services with isolated staging.
- Path safety checks for root boundaries, symlink escape, and ZIP slip.
- Conflict-aware install plans with copy projection into agent roots.
- Uninstall service that removes only app-recorded files.
- Portable skill export packages with manifest, files, and SHA-256 hashes.
- Renderer import queue, install plan, and install result flow panels.
- Security rule engine with initial command, network, sensitive-file, traversal,
  executable-script, and oversized-file rules.
- Pre-install security policy that blocks high-risk skills unless an active
  scoped exemption exists.
- Security exemption migration with reason, timestamp, scope, and revocation.
- Batch rescan upsert behavior that avoids duplicate scan records per ruleset.
- Renderer Security Center queue, score, findings, history, and exemptions panel.
- Skill version service for content-changing versions, version listing, file
  diffs, and installation rollback.
- Collection service for collection creation, batch export packages, and
  collection import into a fresh database.
- Renderer History, Diff, and Collections state panel.
- Sync state migration for profiles, outbox, inbox, conflicts, and events.
- Optional sync service with disabled-by-default startup planning,
  shared-folder, Git, and mock REST package drivers, and conflict open/resolve
  lifecycle.
- Renderer Sync Center profiles, outbox, inbox, and conflicts panel.
- Plugin runtime migration for manifests, permission grants, and error logs.
- Plugin service with manifest validation, sha256 entry integrity, explicit
  permission grants, restricted host registration, malicious entry blocking, and
  enable/disable registry behavior.
- Renderer Plugins status, capabilities, permissions, and error logs panel.
- Plugin API documentation for minimal adapter plugins.
- Desktop packaging target config for macOS, Windows, and Linux.
- Current-platform package script for reproducible unpacked desktop payloads.
- Release checksum, dependency inventory, and redacted smoke-test scripts.
- README Quick Start and release-readiness documentation for contributor
  onboarding.
- ADR template and accepted ADRs for Electron, SQLite source of truth, sync
  defaults, and plugin permissions.
- Maintainer guide, triage policy, issue labels, dependency policy, security
  response playbook, fixture contribution rules, roadmap workflow, and
  contributor recipes.
- CI package and release smoke gates for long-term quality.
- Desktop runtime IPC wiring for app data SQLite, content storage, agent-root
  scanning, local folder import, install plans, install application, security
  scans, sync startup state, and plugin center state.
- Renderer controls for agent-root scanning, local folder import, install plan
  creation, and install application through the preload bridge.
- Release smoke coverage for desktop runtime IPC import/install/library flows.
