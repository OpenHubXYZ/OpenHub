# OpenHub Computer Use Full-App Test Goal Plan

> **For agentic workers:** This plan is designed for goal-sized execution. Use one goal per test, operate the real Electron app with Computer Use, and verify the listed acceptance criteria before starting the next test.

**Goal:** Use Computer Use to test every user-visible OpenHub desktop app function in a real running app, with screenshot, log, filesystem, and SQLite evidence.

**Architecture:** Treat automated checks as health gates and Computer Use as the primary acceptance layer. Each test starts from a controlled temporary fixture environment, operates the app like a user, and records pass/fail evidence without changing product code.

**Tech Stack:** Electron, React, TypeScript, Vite, SQLite via `better-sqlite3`, pnpm, Vitest, Computer Use.

---

## Global Setup

Run from `/Volumes/code/opc/theopenhub`.

Before the first Computer Use test, record the baseline:

```sh
git status --short --untracked-files=all
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start each manual-test batch with a clean temporary root:

```sh
TEST_ROOT="$(mktemp -d /tmp/theopenhub-cu.XXXXXX)"
pnpm dev
```

Computer Use acceptance must confirm the visible app is the current OpenHub window, not a stale browser or old Electron window. Evidence for each goal must include screenshot paths, visible page state, relevant terminal output, and any filesystem or SQLite checks used to prove state changes.

Do not use real user agent directories for write tests. All import, install, scan, and security fixtures must live under `$TEST_ROOT`.

## Goal Tests

### Test 0: Baseline And Evidence Harness

**Goal prompt:**

```text
Prepare OpenHub for Computer Use full-app testing. Record worktree status, command gate results, temporary test root, screenshot/log naming conventions, and the evidence report format. Do not modify product code.
```

**Acceptance:**

- `git status --short --untracked-files=all` output is recorded.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass, or exact failures are captured before manual testing starts.
- A temporary `$TEST_ROOT` exists for fixtures and target agent roots.
- Evidence naming is fixed, for example `test-01-dashboard.png`, `test-04-install-target-tree.txt`, and `computer-use-test-report.md`.
- No repository source, config, or docs file is changed by this setup goal.

### Test 1: Launch, Shell, Navigation, Search

**Goal prompt:**

```text
Launch the OpenHub Electron dev app and use Computer Use to verify the desktop shell, all primary navigation pages, right detail rails, bottom status bar, and Ctrl+K search focus.
```

**Acceptance:**

- The visible window is OpenHub and the first screen shows Dashboard.
- Sidebar navigation contains Dashboard, Library, Discover, Installs, Usage, Reviews, Security, and Settings.
- Each primary page can be clicked and shows a matching heading, tabs, right rail, and bottom status bar.
- Navigation does not reload into a blank window, crash Electron, or lose the desktop shell.
- Ctrl+K focuses the search box labeled `Search local skills, sources, reviews`.
- Screenshots exist for all 8 pages.

### Test 2: Dashboard Agent Root Scan

**Goal prompt:**

```text
Create a temporary Codex skill fixture under the test home directory, click Dashboard Run scan with Computer Use, and verify the scanned skill appears in OpenHub state.
```

**Acceptance:**

- A fixture such as `$TEST_ROOT/home/.codex/skills/scanned-helper/SKILL.md` exists before the scan.
- The Dashboard `Run scan` button is enabled and clickable.
- After scanning, the UI shows `scanned-helper` either in Dashboard activity, Library, or indexed skill state.
- Indexed skill metrics or activity visibly change after scan.
- The scan does not write to or require real user home directories.
- Terminal logs show no IPC contract, preload, or schema error.

### Test 3: Library Local Import Flow

**Goal prompt:**

```text
Create a valid local skill fixture, import it from the Library page with Computer Use, and verify imported skill state in the UI and local runtime.
```

**Acceptance:**

- A fixture directory under `$TEST_ROOT` contains `SKILL.md` and at least one support file.
- Library contains an `Import source path` input and `Import local folder` action.
- Entering the fixture path and clicking import adds the skill name to Library or Import Queue.
- Import Queue shows status `imported`.
- The app does not perform network requests for local import.
- Empty import path does not crash or mutate state.

### Test 4: Install Plan And Apply

**Goal prompt:**

```text
Using an imported skill, create an install plan for a temporary Codex target root, apply the plan with Computer Use, and verify copy projection on disk and in the UI.
```

**Acceptance:**

- `Install target root` accepts a `$TEST_ROOT/codex-skills` path.
- `Create install plan` shows skill name, target root, conflict state, and planned write count.
- A clean plan reports `clean` conflict state.
- `Apply install plan` changes Install Result to `installed`.
- The target root contains copied skill files, including `SKILL.md`.
- Install result stream or Usage state records the install action.
- Only files owned by the app's install plan are written.

### Test 5: Conflict And Ownership Safety

**Goal prompt:**

```text
Pre-create a conflicting user file in the temporary install target, create an install plan, and verify OpenHub detects the conflict without overwriting user content.
```

**Acceptance:**

- A pre-existing target file is created before plan generation.
- The generated install plan reports `conflict`.
- The pre-existing file content remains unchanged.
- Reviews or Installs shows the conflict as needing explicit handling.
- No install result is recorded unless an apply action is explicitly performed.
- If the UI allows applying a conflict plan without warning or review state, record a blocking defect.

### Test 6: Security Scan And Review Blocking

**Goal prompt:**

```text
Import a high-risk skill fixture containing dangerous shell and sensitive file read text, run Security rescan with Computer Use, and verify blocking plus review queue generation.
```

**Acceptance:**

- The fixture includes high-risk content such as destructive shell command text and `~/.ssh/id_rsa` reference.
- Security `Run rescan` is enabled after a skill exists.
- Security page shows high or critical posture, nonzero findings, and blocked install state.
- Rule details include the dangerous finding category or rule name.
- Reviews contains an Open review item for the scanned skill.
- No install result is created for the high-risk skill without a scoped exemption.

### Test 7: Installs, Usage, Reviews State Pages

**Goal prompt:**

```text
After scan, import, install, conflict, and security actions, use Computer Use to verify Installs, Usage, and Reviews reflect local runtime state.
```

**Acceptance:**

- Installs shows pending plans, conflict state, install result stream, and export package area without crashing.
- Usage shows local metrics for scans, installs, and security scans.
- Usage text or rail states that data is local and not cloud telemetry.
- Reviews shows security or conflict items with risk/status columns.
- `New plan`, `Download CSV`, and `Start review` either perform a visible action or are recorded as enabled-no-op defects.
- Page screenshots show state after the actions, not only fixture-backed empty state.

### Test 8: Discover And Topbar Actions

**Goal prompt:**

```text
Use Computer Use to verify Discover page cards, filters, source update state, and topbar Import, Download, and More controls.
```

**Acceptance:**

- Discover shows source cards, selected filters, and source updates.
- Filter buttons are clickable and do not crash or corrupt the page.
- Discover does not trigger live network access during static browsing.
- Topbar Import, Download, and More controls either open a menu/visible state or are recorded as enabled-no-op defects.
- The page remains usable after navigating away and back.

### Test 9: Settings, Sync, Plugin, Privacy Boundaries

**Goal prompt:**

```text
Use Computer Use to verify Settings page agent roots, database/privacy rows, offline-first sync state, plugin runtime state, and Save changes behavior.
```

**Acceptance:**

- Settings shows detected agent roots, database/privacy, offline-first sync, and plugin runtime sections.
- Node integration is Off, context isolation is On, telemetry is None, sync is disabled by default, and plugin grants are manual or opt-in.
- Database path display does not leak unnecessary sensitive content beyond the app data location needed for debugging.
- `Save changes` either persists a visible setting or is recorded as an enabled-no-op defect.
- Sync and plugins do not auto-enable, auto-network, or grant permissions during page viewing.

### Test 10: Responsive, Visual, Accessibility Pass

**Goal prompt:**

```text
Use Computer Use to verify all OpenHub pages at 1487x1058, 1280x800, and 1024x768 desktop sizes for layout stability, visible focus, and accessible labels.
```

**Acceptance:**

- All 8 pages render without blank content at each viewport size.
- Sidebar, main content, right rail, and status bar remain coherent.
- Long paths, skill names, findings, and table values truncate or wrap without overlapping nearby UI.
- Keyboard focus is visible on primary buttons, nav, filters, and inputs.
- Main buttons and inputs have accessible names.
- Screenshots exist for each viewport family, with at least one full navigation pass at 1487x1058.

### Test 11: Packaged App Regression

**Goal prompt:**

```text
Package OpenHub, run release smoke, open the packaged app with Computer Use, and verify the minimum full-app flow outside the dev server.
```

**Acceptance:**

- `pnpm package:desktop` passes.
- `pnpm release:smoke` passes.
- Packaged app loads the built renderer, not the Vite dev server.
- Packaged app passes launch, navigation, local import, install plan, security scan, and Settings privacy checks.
- Release logs do not expose secrets or unexpected sensitive local paths.
- Any packaging-only failure includes exact command output and the smallest reproducible follow-up.

## Final Acceptance

- Every primary page has screenshot evidence.
- Computer Use covered scan, local import, install plan creation, install apply, conflict detection, and security scan.
- Discover, Installs, Usage, Reviews, Settings, Sync, and Plugins state were inspected from the real UI.
- All enabled controls either have a visible behavior or are listed as defects.
- Automated command gates and packaged smoke have explicit pass/fail results.
- The final report lists pass/fail per test, reproduction steps, screenshot paths, logs, filesystem evidence, and blocker severity.

## Assumptions

- This plan tests current user-visible desktop functionality. Lower-level Git import, ZIP import, export, rollback, sync driver, and plugin enable flows that are not exposed in the renderer are verified through existing automated tests and release smoke unless future UI adds direct controls.
- The local machine may not expose a standalone `goal` CLI. Each `Goal prompt` block is still written as an independent goal-sized command payload.
- Testing must not write into real Codex, Claude, Gemini, or OpenCode user directories.
