# Computer Use Full App Test Plan

This plan verifies the current inventory-first desktop app. It supersedes the
older full-app plan that covered removed Deploy and Trust surfaces.

## Baseline

Before browser or Computer Use testing, record:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use a temporary app-data directory and synthetic roots. Do not use real user
agent directories for write tests.

## Test 1: First Launch And Navigation

Verify:

- The app opens to Home.
- Navigation contains Home, Inventory, Sources, and Settings.
- The renderer has no direct Node, filesystem, SQLite, or `ipcRenderer` access.
- No Deploy, Trust, Security, Usage, or Reviews navigation is present.

## Test 2: Root Detection And Inventory Scan

Create synthetic `.codex/skills`, `.claude/skills`, `.gemini/skills`,
`.opencode/skills`, and `.agents/skills` roots with small `SKILL.md` fixtures.

Verify:

- Settings shows detected roots.
- Running scan indexes fixture skills.
- Inventory lists skill name, source agent, path, and visibility status.
- No files are written into agent roots by the scan.

## Test 3: Local Import

Import a synthetic local skill folder.

Verify:

- The import appears in workspace state.
- Inventory search finds the imported skill.
- Skill detail and version data are available through runtime tests.
- No deploy action or target-root picker appears.

## Test 4: Source Preview

Add a local or Git source containing synthetic skills and run preview.

Verify:

- Sources shows candidate skills before import.
- Preview does not write to agent roots.
- The UI does not show ratings, reputation, trust levels, risk status, or
  approval prompts.

## Test 5: Settings Defaults

Verify:

- Sync is disabled until a profile is explicitly created and enabled.
- Plugins are disabled until permissions are authorized and the plugin is
  enabled.
- Logs and visible diagnostics avoid secrets, full skill contents, and sensitive
  local paths.

## Acceptance

- Computer Use evidence covers launch, navigation, root detection, scan, local
  import, source preview, Settings privacy checks, and absence of removed
  Deploy/Trust surfaces.
- Automated tests and release smoke cover lower-level Git import, ZIP import,
  version diff/compare, sync drivers, and plugin enable flows.
