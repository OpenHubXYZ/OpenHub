# Inventory UI Implementation Plan

This file supersedes the previous mockup implementation plan. The old mockups
for Deploy, Trust, Security, Usage, and Reviews are historical design inputs
only and are not current product scope.

## Goal

Implement and maintain the renderer as a focused local inventory workspace:

- Home
- Inventory
- Sources
- Settings

The UI must use live `workspace.state` data, typed preload APIs, and local
runtime evidence. It must not expose agent-root deploy actions, trust levels,
source reputation, risk scoring, security-review queues, policy packs, usage
analytics, or review workflows.

## Scope

Required:

- Map retained IPC state into a compact renderer view model.
- Show first-run steps for root detection, inventory scan, and source preview.
- Keep Inventory searchable and backed by indexed/imported skills.
- Let Sources add and preview local/Git sources before import.
- Show Settings state for roots, sync, and plugins.
- Preserve renderer privilege isolation.

Out of scope:

- Writing files into agent roots.
- Scoring, blocking, or approving skills.
- Marketplace ratings or source reputation.
- Usage analytics and review queues.

## Acceptance

- Renderer tests cover Home, Inventory, Sources, Settings, navigation, empty
  states, search, source preview, root scan actions, and plugin registry state.
- Runtime tests prove `workspace.state`, root scan, local/Git/ZIP import,
  source preview, and plugin/sync defaults through temp app-data only.
- Static checks prove renderer code has no direct Node, filesystem, SQLite, or
  `ipcRenderer` access.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
