# TheOpenHub High-Standard Open-Source Development Plan

## Summary

- Goal: turn the empty repository into a complete open-source desktop project: an Electron + React + Node + SQLite local-first Skills manager.
- Open-source standard: MIT License, clear contribution workflow, CI, test matrix, security policy, release notes, architecture docs, issue/PR templates, and reproducible release process.
- Execution model: each phase is an independent goal run. A phase must pass acceptance, be documented, and be committed before the next phase starts.
- Product constraints: SQLite is the local source of truth; agent directories are deployment projections; the app is offline by default; the renderer cannot directly access Node, fs, or SQLite; sync and plugins are opt-in and constrained.

## Goal Contract

Every goal must:

- Read `references/2026-06-03-electron-react-node-sqlite-development-plan.md` and `references/deep-research-report.md` first.
- Implement only the current phase; do not pre-build later-phase features.
- Update the matching docs, tests, and acceptance evidence.
- Run the phase acceptance commands before committing.
- Maintain open-source quality: readable docs, reproducible commands, diagnosable errors, typed public interfaces, and tests for public contracts.

## Phase 0: Open-Source Repo Foundation

Goal prompt:

```text
Prepare /Volumes/code/opc/theopenhub as a high-standard MIT open-source project. Fix repo hygiene, make references trackable, add community health files, baseline docs, and project metadata without implementing product features.
```

Implementation:

- Determine whether `.git/index.lock` is stale; remove it only if no git process owns it.
- Adjust `.gitignore` so `references/*.md` is trackable while dependencies, build outputs, caches, generated databases, and packaged artifacts stay ignored.
- Add MIT `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md`, and `CHANGELOG.md`.
- Add `.github` community files: issue templates, pull request template, bug report, feature request, security note, and discussion guidance.
- Add `docs/architecture.md`, `docs/roadmap.md`, `docs/development.md`, `docs/testing.md`, and `docs/release.md`.

Acceptance:

- `git status --short --untracked-files=all` shows references and open-source files.
- README explains product positioning, development commands, privacy defaults, and current project status.
- SECURITY documents vulnerability reporting and the privacy rule that skill contents are not collected.
- Docs explain the Electron + React + Node + SQLite choice and phased roadmap.
- The first commit contains only repo foundation and documentation, not unreviewed product code.

## Phase 1: Workspace, Tooling, CI Baseline

Goal prompt:

```text
Scaffold the pnpm TypeScript workspace, Electron + React app shell, shared packages, baseline tests, linting, formatting, and GitHub Actions CI for an open-source desktop project.
```

Implementation:

- Create workspace packages: `apps/desktop`, `packages/shared`, `packages/core`, `packages/db`, and `packages/adapters`.
- Configure Electron + Vite + React app shell with `contextIsolation: true` and `nodeIntegration: false`.
- Configure TypeScript, Vitest, ESLint, Prettier, and baseline package scripts.
- Add GitHub Actions for install, lint, typecheck, test, and build.
- Document dependency policy: lockfile must be committed and dependency changes must explain purpose and risk.

Acceptance:

- `pnpm install` succeeds and creates a committed lockfile.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- `pnpm dev` starts a desktop shell showing the product name and an empty state.
- CI commands match README and local scripts.
- Renderer has no direct Node, fs, or SQLite access.

## Phase 2: SQLite Domain Foundation

Goal prompt:

```text
Implement the local SQLite foundation with migrations, repositories, typed domain models, fixtures, and tests. SQLite must be the authoritative local state.
```

Implementation:

- Use a Node SQLite access layer, preferably `better-sqlite3`, isolated in `packages/db`.
- Add migrations for skills, skill versions, skill files, blob objects, agents, agent roots, installations, sources, collections, and security scans.
- Add repository/service boundaries and app data directory resolution.
- Add an FTS5 migration for skill name, description, tags, and file path search.
- Update `docs/architecture.md` with the SQLite source-of-truth and agent projection model.

Acceptance:

- Migrations are idempotent from an empty database to latest.
- Repository tests cover create, list, update, search, and delete paths.
- Tests do not write to real user directories.
- A test skill can be inserted, queried, and found through FTS search.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Phase 3: Agent Detection And Library Indexing

Goal prompt:

```text
Implement agent adapters and local library indexing. Detect common agent skill roots, parse SKILL.md files, index them into SQLite, and expose the library through typed IPC and a React Library screen.
```

Implementation:

- Define `AgentAdapter.detectRoots/listInstalled/install/uninstall/verify`.
- Add initial adapters for Codex, Claude, Gemini, and OpenCode.
- Implement `SKILL.md` parsing plus a clear malformed-file error model.
- Implement scanning tasks that read agent roots, write SQLite records, and preserve source, install status, and file summaries.
- Add minimal Library, Skill Detail, and Settings/Agent Roots UI.

Acceptance:

- Fixture roots for `.codex/skills`, `.claude/skills`, `.gemini/skills`, and `.opencode/skills` scan successfully.
- Missing or malformed `SKILL.md` files do not crash scanning and produce explainable errors.
- Library UI shows skill name, source agent, path, and install status.
- IPC contract tests cover library queries.
- `pnpm test` and `pnpm typecheck` pass.

## Phase 4: P0 Import, Export, Install, Uninstall

Goal prompt:

```text
Build the P0 management loop: local folder import, Git import, ZIP import, export package, install, uninstall, conflict detection, and safe path handling.
```

Implementation:

- Implement local folder, Git URL, and ZIP importers. All inputs first enter an isolated temporary directory.
- Implement path sanitizer checks: canonicalize, symlink escape, zip slip, and target boundary checks.
- Implement install plans with target agent root, scope, conflict state, and file write list.
- Use copy projection for install; uninstall removes only files recorded by this app.
- Export portable packages containing manifest, files, and hashes.

Acceptance:

- Local, Git, and ZIP fixtures import and write SQLite records.
- Zip slip, path traversal, and out-of-bound symlink fixtures are rejected.
- Conflicting installs generate a plan and do not overwrite automatically.
- Installed files appear in the target agent root; uninstall does not delete unknown user files.
- UI supports Import, Install Plan, and install result flow.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Phase 5: Security Center And Governance

Goal prompt:

```text
Implement the Security Center and governance layer: pre-install scanning, batch rescans, risk scoring, rules, exemptions, and install blocking for high-risk skills.
```

Implementation:

- Define `SecurityRule` and security scan result schema.
- Add initial rules for dangerous shell commands, external data transfer, sensitive file reads, path traversal, executable scripts, and oversized files.
- Block high-risk pre-install scans by default; allow recorded exemptions.
- Add Security Center UI for scan queue, risk score, rule details, history, and exemptions.
- Update `SECURITY.md` and add `docs/security-model.md`.

Acceptance:

- High-risk fixtures are blocked before install.
- Low- and medium-risk fixtures can be installed with warnings.
- Exemptions include reason, timestamp, and scope, and can be revoked.
- Batch rescans do not create noisy duplicate records.
- Rule engine, blocking policy, and exemption lifecycle tests pass.
- Docs explain that security scanning is not an execution sandbox guarantee.

## Phase 6: Version History, Blob Store, Collections

Goal prompt:

```text
Add P1 governance capabilities: content-addressed blob store, version history, file diffs, rollback, collections, and batch operations.
```

Implementation:

- Store file contents in a content-addressed blob store; SQLite stores hash, size, and content type.
- Generate a `SkillVersion` for every import or content-changing operation.
- Implement file added/modified/deleted diff and rollback.
- Implement collections, batch install, batch uninstall, and batch export.
- Add History, Diff, and Collections UI.

Acceptance:

- Identical file contents are stored once.
- Skill changes create new versions; old versions can be viewed, diffed, and rolled back.
- Rollback makes agent root file hashes match the target version.
- Collections can be batch-exported and imported again.
- Large fixture scan and diff operations do not block the renderer.
- Tests cover blob dedupe, versioning, diff, rollback, and collections.

## Phase 7: Offline-First Sync

Goal prompt:

```text
Implement optional offline-first sync without breaking local-first behavior. Add sync profiles, outbox/inbox, conflict detection, shared-folder sync, Git sync, and a Sync Center UI.
```

Implementation:

- Keep sync disabled by default; require explicit `SyncProfile` creation.
- Add SQLite tables for outbox, inbox, sync events, and conflicts.
- Implement shared-folder sync and Git sync; define self-hosted REST as an interface with a mock driver only.
- Add a conflict center that shows local, remote, and base versions and lets users choose a resolution.
- Update docs for privacy and sync boundaries.

Acceptance:

- With no sync profile, the app starts no sync activity.
- Shared-folder fixture can push and pull changes.
- Git sync fixture can commit and pull change packages.
- Conflict fixtures enter Sync Center and can be resolved.
- Local writes land in SQLite before entering outbox.
- Driver contract, conflict lifecycle, and offline behavior tests pass.

## Phase 8: Plugin Runtime And Extension APIs

Goal prompt:

```text
Implement a constrained plugin system for adapters, importers, security rules, and sync drivers with manifest validation, permissions, signatures-ready metadata, and UI management.
```

Implementation:

- Define plugin manifest fields: id, name, version, entry, capabilities, permissions, and integrity.
- Support plugin types for agent adapter, importer, security rule, and sync driver.
- Give plugins no broad fs or network permissions by default; require explicit declared permissions and user authorization.
- Use JS module plugins plus a restricted host API for v1; do not support arbitrary shell execution.
- Add Plugins UI for install, enable/disable, permission review, and error logs.

Acceptance:

- Manifest validation covers missing fields, unknown permissions, and incompatible versions.
- Unauthorized plugins cannot read/write agent dirs or access network APIs.
- An example plugin adds a mock agent adapter and passes contract tests.
- Malicious fixtures cannot escape the host API.
- Disabling a plugin removes its capabilities from registry and UI.
- Plugin API docs are sufficient for a third party to implement a minimal adapter.

## Phase 9: Packaging, Release, OSS Launch

Goal prompt:

```text
Harden TheOpenHub Skills Studio for public open-source release: packaging, checksums, changelog, release docs, privacy checks, smoke tests, and launch-quality repository presentation.
```

Implementation:

- Configure desktop packaging for macOS, Windows, and Linux.
- Add release smoke tests for package startup, database migration, first launch detection, and fixture import/install.
- Maintain `CHANGELOG.md`, release checklist, version policy, and rollback instructions.
- Generate release artifact checksums; add SBOM or dependency inventory.
- Complete README with screenshots, features, architecture summary, privacy statement, and contribution guide.

Acceptance:

- Package build succeeds on the current platform.
- Packaged app completes the Phase 4 core smoke flow.
- Release checklist covers signing, verification, rollback, and privacy checks.
- Logs contain no token, full skill content, or unredacted sensitive paths.
- README lets a new contributor run the dev environment within 15 minutes.
- GitHub community health files are complete.

## Phase 10: Maintainer Operations And Long-Term Quality

Goal prompt:

```text
Add maintainer-grade project operations: triage policy, roadmap workflow, dependency maintenance, architectural decision records, contributor onboarding, and quality gates for future releases.
```

Implementation:

- Add ADR template and first ADRs for Electron selection, SQLite source of truth, plugin permissions, and sync disabled by default.
- Add issue labels documentation, triage policy, and maintainer guide.
- Add dependency update policy and security response playbook.
- Add fixture contribution rules to avoid committing sensitive real skill contents.
- Add public roadmap update workflow.

Acceptance:

- A new maintainer can use the guide to triage issues, prepare releases, and handle security intake.
- Every major architecture decision has an ADR.
- Dependency upgrades have documented test and risk requirements.
- Contributor docs explain how to add an adapter, security rule, sync driver, and fixture.
- The repository meets complete open-source project standards, not merely runnable-code standards.

## Final Acceptance

- Phases 0-4 complete: the product has a usable local Skills management loop.
- Phases 5-8 complete: the product has governance, history, sync, and plugin capabilities.
- Phases 9-10 complete: the project is ready for public release and long-term open-source maintenance.
- Long-term required checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and desktop build smoke.
- Non-negotiable constraints remain intact: MIT open source, local-first behavior, SQLite source of truth, agent directory projection, no renderer Node/fs direct access, sync disabled by default, and constrained plugin permissions.
