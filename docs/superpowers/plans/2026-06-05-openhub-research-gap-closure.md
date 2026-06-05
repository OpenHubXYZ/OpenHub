# OpenHub Research-Report Gap Closure Plan

## Summary

Implement the remaining high-value gaps from `references/deep-research-report.md` in goal-sized phases. Keep the current local-first Electron + React + TypeScript + SQLite architecture. Do not introduce mandatory cloud accounts, telemetry, or remote marketplace dependencies.

Current verified baseline: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Public Interfaces And Defaults

- [ ] Add typed IPC only through `packages/shared/src/ipc-contracts.ts`, preload wrappers, and `desktop-runtime.ts`.
- [ ] Keep SQLite as source of truth; agent directories remain projections.
- [ ] Default install projection remains copy-based; symlink/hardlink/mirror become explicit install modes.
- [ ] Sync remains disabled by default; real REST sync is opt-in and uses `auth_ref`.
- [ ] Secrets must use OS keychain abstraction, never SQLite/plain JSON.
- [ ] Plugin v1 stays constrained; new SDK work expands contracts without giving plugins filesystem/network access by default.

## Goal 1: Goal-Runnable Plan Artifact

- [ ] Create this file under `docs/superpowers/plans/`.
- [ ] Use checkbox steps and goal-sized sections.
- [ ] Include the same task list, assumptions, and acceptance gates.
- [ ] Verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Acceptance:

- [ ] File exists under `docs/superpowers/plans/`.
- [ ] Uses checkbox steps and goal-sized sections.
- [ ] Includes this same task list, assumptions, and acceptance gates.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` still pass.

## Goal 2: First Launch And Migration Wizard

- [ ] Implement a first-launch flow for agent detection, existing skill roots, migration preview, and explicit import.
- [ ] Show the first-launch wizard before the normal dashboard for fresh app state.
- [ ] Detect Codex, Claude, Gemini, and OpenCode roots and read-only migration candidates.
- [ ] Preview OpenSkills, Skills-Manager, SkillHub, and skills-manager-client imports.
- [ ] Require explicit user action before import.
- [ ] Keep previews read-only against agent roots.

Acceptance:

- [ ] Fresh app state shows first-launch wizard before normal dashboard.
- [ ] Wizard detects Codex, Claude, Gemini, OpenCode roots and read-only migration candidates.
- [ ] OpenSkills, Skills-Manager, SkillHub, and skills-manager-client previews can be imported only after explicit user action.
- [ ] No agent root writes occur during preview.
- [ ] Tests cover fresh launch, skipped wizard, preview-only migration, and confirmed migration import.

## Goal 3: Project Roots And Multi-Target Install

- [ ] Add project-level roots for Codex, Claude, Gemini, and OpenCode.
- [ ] Support one skill installed to multiple selected roots.
- [ ] Report conflicts per target and block only affected targets.
- [ ] Preserve app-owned uninstall safety.

Acceptance:

- [ ] User can add project roots for Codex, Claude, Gemini, and OpenCode.
- [ ] Install plan supports one skill to multiple selected roots.
- [ ] Conflicts are reported per target and block only affected targets.
- [ ] Existing app-owned uninstall safety still holds.
- [ ] Tests cover user root, project root, multi-target clean install, mixed conflict, and uninstall.

## Goal 4: Install Projection Modes

- [ ] Add explicit projection modes: `copy`, `symlink`, `hardlink`, and `mirror-export`.
- [ ] Keep `copy` as the default.
- [ ] Reject `symlink` and `hardlink` when they escape root or are unsupported.
- [ ] Make `mirror-export` write an agent-compatible directory without active installation records.
- [ ] Expose projection mode in install flow.

Acceptance:

- [ ] `copy` remains default.
- [ ] `symlink` and `hardlink` are rejected when they escape root or are unsupported by platform/filesystem.
- [ ] `mirror-export` writes an agent-compatible directory without recording it as an active installation.
- [ ] UI exposes projection mode in install flow.
- [ ] Tests cover mode validation, path safety, install records, and rollback behavior.

## Goal 5: Import Coverage Expansion

- [ ] Add TAR import.
- [ ] Add Git sparse clone import.
- [ ] Add offline mirror import.
- [ ] Reject TAR path traversal and unsafe links.
- [ ] Verify mirror manifests and hashes.

Acceptance:

- [ ] Import service supports `tar`, `git-sparse`, and `mirror`.
- [ ] TAR rejects path traversal and unsafe links.
- [ ] Git sparse clone accepts repo URL plus skill subpath and imports only that path.
- [ ] Mirror import reads an OpenHub export directory with manifest/hash verification.
- [ ] Tests cover valid imports plus zip-slip/tar-slip/symlink escape rejection.

## Goal 6: Keychain-Backed Secret References

- [ ] Introduce OS keychain adapter for sync/plugin credentials.
- [ ] Store only `auth_ref` in SQLite for `sync.createProfile`.
- [ ] Add settings operations to create, inspect masked, and delete credential refs.
- [ ] Prove secrets are absent from SQLite rows, logs, and workspace state.

Acceptance:

- [ ] `sync.createProfile` stores only `auth_ref` in SQLite.
- [ ] Secret material is written through keychain adapter or test in-memory adapter.
- [ ] Settings can create, inspect masked, and delete credential refs.
- [ ] Tests prove tokens are absent from SQLite rows, logs, and workspace state.

## Goal 7: Real Opt-In REST Sync Driver

- [ ] Replace `mock-rest` product path with a real self-hosted REST driver.
- [ ] Keep the mock driver available for tests.
- [ ] Support push, pull, auth ref lookup, and remote event IDs.
- [ ] Keep sync disabled by default.
- [ ] Route pulled packages into inbox without mutating skill tables automatically.
- [ ] Surface conflicts explicitly in Sync Center.

Acceptance:

- [ ] REST sync supports push, pull, auth ref lookup, and remote event IDs.
- [ ] Disabled default remains unchanged.
- [ ] Pulled packages enter inbox and do not mutate skill tables automatically.
- [ ] Conflict detection is explicit and visible in Sync Center.
- [ ] Tests cover disabled default, authenticated push/pull, duplicate pull ignore, and conflict lifecycle.

## Goal 8: Conflict Application And Three-Way Merge

- [ ] Implement explicit apply/merge actions for sync conflicts.
- [ ] Support field-level local/remote/manual metadata choices.
- [ ] Create parallel draft versions for file conflicts.
- [ ] Represent delete conflicts as soft-delete records with recovery.
- [ ] Require explicit confirmation before applying a resolution.

Acceptance:

- [ ] Metadata conflicts support field-level local/remote/manual choice.
- [ ] File conflicts create parallel draft versions, not silent overwrites.
- [ ] Delete conflicts become soft-delete records with recovery.
- [ ] UI requires explicit confirmation before applying a resolution.
- [ ] Tests cover metadata merge, file conflict draft creation, delete conflict recovery, and audit events.

## Goal 9: Drafts, Release Channels, Signed Archives

- [ ] Add version draft workflow.
- [ ] Add release channels `stable`, `beta`, and `local`.
- [ ] Export signed archives with manifest, file hashes, and signature metadata.
- [ ] Verify hashes on import and report unsigned/signed/untrusted status.

Acceptance:

- [ ] Skill versions can be created as draft or released.
- [ ] Release channels support `stable`, `beta`, and `local`.
- [ ] Signed archive export writes manifest, file hashes, and signature metadata.
- [ ] Import verifies hashes and reports unsigned/signed/untrusted status.
- [ ] Tests cover draft creation, release promotion, signature verification, tampered archive rejection, and unsigned warning.

## Goal 10: Search, Favorites, And Usage Productization

- [ ] Add favorite and unfavorite actions.
- [ ] Add favorites filter.
- [ ] Derive recent usage only from local `usage_events`.
- [ ] Include skill content snippets in full-text search.
- [ ] Do not add remote embeddings.

Acceptance:

- [ ] Users can favorite/unfavorite skills and filter by favorites.
- [ ] Recent usage is derived only from local `usage_events`.
- [ ] Full-text search includes skill content snippets, not just metadata/path.
- [ ] Semantic search is not added unless implemented locally; no remote embeddings.
- [ ] Tests cover favorites persistence, recent usage ordering, search by content, and privacy boundary.

## Goal 11: Plugin SDK V1.1

- [ ] Expand plugin contracts from registration-only to constrained executable providers.
- [ ] Invoke adapters/importers/security rules/sync drivers through host-mediated APIs.
- [ ] Require declared permissions and active grants.
- [ ] Prevent plugin access to Node globals, filesystem, shell, process, or network.
- [ ] Disable capabilities when plugins are disabled.

Acceptance:

- [ ] Plugin adapters/importers/security rules/sync drivers can be invoked through host-mediated APIs.
- [ ] Capabilities require declared permissions and active grants.
- [ ] Plugin execution cannot access Node globals, filesystem, shell, process, or network directly.
- [ ] Disabling plugin removes capabilities and prevents invocation.
- [ ] Tests cover successful provider invocation, missing permission rejection, unsafe source rejection, and disable cleanup.

## Goal 12: Policy Packs And Team Baseline Packages

- [ ] Implement local policy packs.
- [ ] Implement team baseline exports without cloud dependency.
- [ ] Preview baseline changes before apply.
- [ ] Never write agent roots automatically when applying baselines.

Acceptance:

- [ ] Policy pack can define allowed sources, blocked rules, required scan level, and approved plugins.
- [ ] Team baseline package can include collections, policy pack, and root templates.
- [ ] Import previews baseline changes before applying.
- [ ] Applying baseline never writes to agent roots automatically.
- [ ] Tests cover policy enforcement, baseline export/import, preview-only behavior, and blocked install.

## Goal 13: Release-Grade Packaging Closure

- [ ] Finish current-platform release readiness.
- [ ] Keep public release blocked unless signing/notarization status is explicitly recorded.
- [ ] Add CI jobs for lint, typecheck, test, build, package smoke, and checksum generation.
- [ ] Document unsigned local package vs signed public installer.

Acceptance:

- [ ] Current-platform `pnpm package:desktop`, `pnpm release:smoke`, `pnpm release:checksums`, and `pnpm release:inventory` pass.
- [ ] Release docs distinguish unsigned local package from signed public installer.
- [ ] CI has jobs for lint, typecheck, test, build, package smoke, and checksum generation.
- [ ] Public release remains blocked unless signing/notarization status is explicitly recorded.
- [ ] Tests cover release config and smoke script expectations.

## Test Plan

Run after every goal:

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`

Additional goal-specific checks:

- [ ] UI goals: renderer tests for new flows and state.
- [ ] Import/security goals: malicious fixture tests.
- [ ] Sync goals: shared-folder, git, REST test driver, and conflict tests.
- [ ] Packaging goal: `pnpm package:desktop && pnpm release:smoke && pnpm release:checksums && pnpm release:inventory`.

## Assumptions

- [ ] Implement all remaining report gaps as local-first features unless the report explicitly marks them advanced/cloud optional.
- [ ] Do not add public marketplace operations or forced accounts.
- [ ] Do not introduce telemetry.
- [ ] Keep Electron/React/Node/SQLite stack; no Tauri rewrite.
- [ ] Treat current dirty working tree as the implementation baseline.
