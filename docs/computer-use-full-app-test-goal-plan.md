# Computer Use Full App Test Plan

This plan verifies the current skills-first desktop app. It supersedes the
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

- The app opens to Dashboard.
- Navigation contains Dashboard, Skills, and Settings.
- The renderer has no direct Node, filesystem, SQLite, or `ipcRenderer` access.
- No Deploy, Trust, Security, Usage, or Reviews navigation is present.

## Test 2: Root Detection And Skills Scan

Create synthetic `.codex/skills`, `.claude/skills`, `.gemini/skills`,
`.opencode/skills`, and `.agents/skills` roots with small `SKILL.md` fixtures.

Verify:

- Settings shows detected roots.
- Running scan indexes fixture skills.
- Skills lists skill name, source agent, path, visibility status, root metadata,
  and ownership.
- No files are written into agent roots by the scan.

## Test 3: Local Import

Import a synthetic local skill folder.

Verify:

- The import appears in workspace state.
- Skills search finds the imported skill.
- Skill detail and version data are available through runtime tests.
- No Deploy or Trust workflow appears.

## Test 4: Marketplace Source Preview And Install

Add a local or Git source containing synthetic skills and run preview.

Verify:

- Settings manages the configured source.
- Skills > Marketplace shows candidate skills before import.
- Preview does not write to agent roots.
- Import writes to SQLite and the content store.
- Installing requires an explicit target root and copy/symlink projection mode.
- Conflicts require explicit overwrite confirmation.
- Uninstall removes only app-owned installed files.
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
  import, marketplace source preview, app-owned install/uninstall, Settings
  privacy checks, and absence of removed
  Deploy/Trust surfaces.
- Automated tests and release smoke cover lower-level Git import, ZIP import,
  version diff/compare, sync drivers, and plugin enable flows.
