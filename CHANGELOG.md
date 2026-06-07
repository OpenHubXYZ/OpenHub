# Changelog

All notable changes to OpenHub will be documented in this file.

The format follows Keep a Changelog and the project uses semantic versioning
after the first release.

## Unreleased

### Changed

- Recentered the product around local inventory instead of agent-root deploy
  workflows.
- Removed runtime Deploy surfaces, install/uninstall services, target planning,
  app-owned root write records, and rollback-to-root behavior.
- Removed Trust surfaces, security scan services, policy packs, team baselines,
  review queues, usage center state, risk scores, exemptions, and source trust
  metadata.
- Simplified the renderer to Home, Inventory, Sources, and Settings.
- Simplified desktop IPC, preload APIs, workspace state, and SQLite schema to
  retained inventory, import, source preview, version, collection, sync, and
  plugin workflows.
- Narrowed adapters to read-only root detection and `SKILL.md` indexing.
- Narrowed plugin capabilities to agent adapters, importers, and sync drivers.

### Added

- Open-source repository foundation.
- MIT license.
- Community health files.
- Architecture, development, testing, release, and roadmap documentation.
- Trackable historical planning references.
- pnpm TypeScript workspace.
- Electron, Vite, and React desktop shell.
- Shared, core, database, and adapters packages.
- Vitest, ESLint, Prettier, and GitHub Actions CI baseline.
- SQLite migration runner, FTS5 skill search, app-data resolver tests, and
  repository coverage.
- Codex, Claude, Gemini, OpenCode, and Agents root detection adapters.
- `SKILL.md` parser with explainable malformed-file errors.
- Agent library scanner that indexes fixture roots into SQLite.
- Local folder, Git URL, and ZIP import services with isolated staging.
- Path safety checks for root boundaries, symlink escape, and ZIP slip.
- Content-addressed blob store for imported skill files.
- Skill version listing, file diff, and compare services.
- Collection creation service.
- Discover source configuration and preview cache.
- Optional sync service with disabled-by-default startup planning,
  shared-folder, Git, and mock REST package drivers, and conflict lifecycle.
- Plugin runtime with manifest validation, sha256 entry integrity, explicit
  permission grants, restricted host registration, malicious entry blocking,
  and enable/disable registry behavior.
- Desktop packaging target config for macOS, Windows, and Linux.
- Current-platform package script for reproducible unpacked desktop payloads.
- Release checksum, dependency inventory, and redacted smoke-test scripts.
- ADR template and accepted ADRs for Electron, SQLite source of truth, sync
  defaults, and plugin permissions.
- Maintainer guide, triage policy, issue labels, dependency policy, security
  response playbook, fixture contribution rules, roadmap workflow, and
  contributor recipes.
