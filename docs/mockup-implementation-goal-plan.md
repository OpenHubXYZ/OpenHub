# Skills UI Implementation Plan

This file supersedes the previous mockup implementation plan. The old mockups
for Deploy, Trust, Security, Usage, and Reviews are historical design inputs
only and are not current product scope.

## Goal

Implement and maintain the renderer as a focused local skills workspace:

- Dashboard
- Skills
- Settings

The Stitch Skill Library Manager artifacts under
`docs/design/stitch_skill_library_manager/` are now the visual reference for this
workspace. Their Dashboard, Marketplace, Skill Detail, and Settings patterns are
in scope when backed by current local runtime data. Their Analytics and
Reviews/Ratings concepts require a separate accepted spec before runtime UI
appears.

The UI must use live `workspace.state` data, typed preload APIs, and local
runtime evidence. It must not expose trust levels, source reputation, risk
scoring, security-review queues, policy packs, usage analytics, or review
workflows.

## Scope

Required:

- Map retained IPC state into a compact renderer view model.
- Show first-run steps for root detection, skills scan, and marketplace source
  preview.
- Keep Skills searchable and backed by indexed/imported skills.
- Let Settings manage roots and marketplace sources.
- Let Skills > Marketplace preview local/Git sources, import candidates, and
  install imported skills into selected roots.
- Show Settings state for roots, marketplace sources, sync, and plugins.
- Preserve renderer privilege isolation.

Out of scope:

- Arbitrary file editing in agent roots outside app-owned install plans.
- Scoring, blocking, or approving skills.
- Marketplace ratings or source reputation.
- Usage analytics and review queues.

## Acceptance

- Renderer tests cover Dashboard, Skills, Settings, navigation, empty states, search,
  source preview, root/source management actions, install confirmation, and
  plugin registry state.
- Runtime tests prove `workspace.state`, root scan, local/Git/ZIP import,
  source preview, app-owned install/uninstall, and plugin/sync defaults through
  temp app-data only.
- Static checks prove renderer code has no direct Node, filesystem, SQLite, or
  `ipcRenderer` access.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
