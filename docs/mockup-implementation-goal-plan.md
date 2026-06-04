# TheOpenHub Mockup Implementation Goal Plan

> **For agentic workers:** This plan is designed for goal-sized execution. Use one goal per task, keep changes scoped to that task, and verify the listed acceptance criteria before starting the next task.

**Goal:** Implement the seven desktop mockup pages in `docs/design/mockups/` as the runnable TheOpenHub Electron renderer experience.

**Architecture:** Treat the PNGs as the visual source of truth and the current Electron main process as the privileged runtime boundary. The renderer should use shared React layout components and typed UI view models derived from `workspace.state`; only missing durable domains such as local usage and review queues should add SQLite-backed state.

**Tech Stack:** Electron, React, TypeScript, Vite, SQLite via `better-sqlite3`, Vitest, Testing Library, ESLint, pnpm.

---

## Scope And Constraints

- Source mockups: `docs/design/mockups/dashboard.png`, `discover.png`, `installs.png`, `usage.png`, `reviews.png`, `security.png`, `settings.png`.
- Library is intentionally not included in the mockup set, but must remain usable and visually consistent with the new shell.
- Renderer code must not directly access Node, filesystem, SQLite, or `ipcRenderer`.
- The app remains local-first: no telemetry, live catalog fetch, cloud account, or automatic sync is introduced by this plan.
- Existing uncommitted changes must be inspected before touching overlapping files and must not be reverted unless they are explicitly part of the current goal.

## Goal Tasks

### Goal 0: Baseline And Worktree Guard

**Goal prompt:**

```text
Prepare /Volumes/code/opc/theopenhub for mockup implementation. Inspect the current dirty worktree, record baseline verification output, and do not overwrite unrelated user changes.
```

**Implementation:**

- Run `git status --short --untracked-files=all`.
- Inspect dirty files before editing any overlap, especially `apps/desktop/src/main/main.ts`, `apps/desktop/vite.renderer.config.ts`, `packages/core/src/release-readiness.test.ts`, `apps/desktop/src/main/main-startup.test.ts`, and `docs/design/`.
- Run the cheapest baseline gates first: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Record exact failures if any baseline gate fails before implementation.

**Acceptance:**

- The implementer can list which dirty files are unrelated and which files are in scope.
- No unrelated dirty file is reverted or reformatted.
- Baseline command results are known before feature work starts.

### Goal 1: Shared Desktop Shell

**Goal prompt:**

```text
Replace the early renderer shell with the shared desktop shell shown in docs/design/mockups: fixed left navigation, top command bar, central workbench, right detail rail, and bottom runtime status.
```

**Implementation:**

- Create focused renderer components for sidebar, topbar, status bar, tabs, filters, metric cards, tables, pills, panels, bar charts, right rail, and page frame.
- Move page-independent mockup tokens from `docs/design/openhub-page-mockups.md` into renderer CSS or component constants.
- Add `lucide-react` for icons if no existing icon library is available.
- Keep cards at 8px radius or less and preserve the light local-first desktop console style.

**Acceptance:**

- At 1487x1058, the rendered app has the same shell structure as the mockups.
- Sidebar nav, top search/actions, right rail, and bottom status are visible without scrolling.
- Existing renderer tests pass after being updated for the new shell.
- Static checks still prove the renderer does not import Node, filesystem, SQLite, or `ipcRenderer`.

### Goal 2: Navigation And UI View Model

**Goal prompt:**

```text
Add typed page navigation and a renderer UI view model that maps the current workspace.state payload into display-ready data for Dashboard, Library, Discover, Installs, Usage, Reviews, Security, and Settings.
```

**Implementation:**

- Add a small page route state in the renderer; navigation changes content without reloading Electron.
- Add `workspace-view-model.ts` or equivalent focused module for UI-ready derived data.
- Use deterministic UI fixtures only for fields that are not yet persisted, and label them clearly in code as fixture-backed.
- Do not add a new IPC channel for presentational transformations that can be derived from existing `workspace.state`.

**Acceptance:**

- Tests cover all primary nav items and active page state.
- Dashboard, Library, Discover, Installs, Usage, Reviews, Security, and Settings each render a stable heading and right rail.
- Empty database state renders without crashes.
- Fixture-backed values are isolated from real persisted state and easy to remove later.

### Goal 3: Dashboard And Library

**Goal prompt:**

```text
Implement Dashboard from dashboard.png and keep Library functional inside the new shell.
```

**Implementation:**

- Dashboard shows local library health, agent coverage, recent activity, readiness queue, workspace health, agent roots, and next recommended action.
- Wire `Run scan` to the existing `scanAgentRoots` bridge.
- Library keeps the existing indexed skill rows: skill name, source agent, path, and install status.
- Derive counts from existing library, skills, security, sync, plugin, and management flow state where possible.

**Acceptance:**

- `Run scan` calls `window.theOpenHub.scanAgentRoots()` and refreshes visible workspace state.
- Library still renders indexed skills from `librarySkills`.
- Dashboard metrics do not require network or real user home scanning in tests.
- Renderer tests cover empty and populated Dashboard/Library states.

### Goal 4: Discover And Settings

**Goal prompt:**

```text
Implement Discover and Settings from their mockups using local-first source, agent-root, sync, plugin, database, and privacy state.
```

**Implementation:**

- Discover shows featured source cards, filters, source updates, selected source profile, recommended collection, and import preview.
- Settings shows detected agent roots, offline-first sync, plugin runtime, database/privacy, current defaults, sync preview, and plugin request.
- Source catalog content remains local/cache/fixture-backed until a separate source sync feature is approved.

**Acceptance:**

- Discover filter controls render stable selected values and do not perform live network requests.
- Settings reflects known app defaults: node integration off, context isolation on, sync profile none, telemetry none, plugin grants manual.
- Database path and detected roots use runtime state when available and safe placeholder text only in tests/fixtures.
- Tests cover both pages and their right-rail summaries.

### Goal 5: Installs And Security

**Goal prompt:**

```text
Implement Installs and Security pages with existing install planning, install application, and security scanning workflows wired through typed preload APIs.
```

**Implementation:**

- Installs shows pending plans, installed/conflict/export/uninstall tabs, write preview, result stream, export packages, and safety rule.
- Security shows risk score, open findings, active exemptions, blocked installs, scan queue, rule details, exemption lifecycle, policy summary, finding excerpt, and recommended action.
- Reuse existing install and security services through current typed IPC.

**Acceptance:**

- Creating and applying an install plan still uses `createInstallPlan` and `applyInstallPlan`.
- Running a security scan still uses `scanSkill`.
- High and critical findings remain blocked unless a scoped exemption exists.
- Tests cover clean, conflict, warning, and blocked visual states.

### Goal 6: Local Usage Events

**Goal prompt:**

```text
Persist local-only usage signals in SQLite and implement the Usage page from usage.png without adding telemetry or cloud analytics.
```

**Implementation:**

- Add migration `007_review_usage_events` or equivalent for `usage_events`.
- Add a repository/service API for recording local events.
- Record events for existing local actions: import, agent scan, install plan creation, install application, security scan, export, and plugin actions that already exist.
- Render metrics, daily activity bars, top skills, agent split, privacy boundary, activity heatmap summary, and recent usage.

**Acceptance:**

- Migration is idempotent from an empty database and an existing Phase 10 database.
- Runtime tests prove events are recorded only under temp `dataDirectory`.
- Usage page shows local metrics with no network calls and no telemetry endpoint.
- Privacy copy explicitly states usage comes from local SQLite records.

### Goal 7: Review Queue

**Goal prompt:**

```text
Persist review queue state and implement the Reviews page from reviews.png for imported skill changes, security findings, source trust decisions, and install conflicts.
```

**Implementation:**

- Extend the same migration or a focused follow-up migration with review items and review notes.
- Generate review items from high/medium security findings, install conflicts, and changed skill versions.
- Render review queue, review notes, community signal, decision checklist, changed files, and reviewer action rail.
- Keep approvals explicit; a review state change must not apply an install plan automatically.

**Acceptance:**

- Tests cover review item generation, note rendering, selected row rail content, and status transitions.
- High-risk review items visibly preserve install blocking.
- Reviews page handles empty state and populated state.
- No install is approved or applied implicitly by opening or updating a review.

### Goal 8: Interaction Polish

**Goal prompt:**

```text
Make first-screen controls across the implemented mockup pages behave consistently and remain stable at desktop sizes.
```

**Implementation:**

- Add row selection, tab state, filter state, Ctrl+K search focus, disabled/available action states, collapse/help visual states, and stable overflow handling.
- Ensure long paths, skill names, excerpts, and table values truncate or wrap cleanly.
- Use accessible roles and labels for buttons, nav, filters, tables, and search.

**Acceptance:**

- Keyboard and click tests cover primary controls.
- No text overlaps at 1487x1058.
- A smaller desktop viewport still keeps navigation, content, and rail coherent.
- Buttons and table rows do not resize the layout during hover/focus/selection.

### Goal 9: Visual QA And Release Gates

**Goal prompt:**

```text
Verify every implemented page against docs/design/mockups, update docs for the UI contract, and run the full workspace release gates.
```

**Implementation:**

- Start the local desktop/web renderer target used for visual verification.
- Capture Dashboard, Discover, Installs, Usage, Reviews, Security, and Settings at 1487x1058.
- Compare each screenshot against its corresponding PNG for shell structure, page content, spacing, right rail, and bottom status.
- Update `docs/testing.md` and design docs with the new UI verification contract and fixture boundaries.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm package:desktop`, and `pnpm release:smoke`.

**Acceptance:**

- Seven current screenshots exist or are attached in the verification notes.
- Each page visibly matches the corresponding mockup's shell, information architecture, and first-screen content.
- All listed commands pass, or any blocker is documented with exact command output and the smallest follow-up action.
- Docs explain which values are real runtime state and which remain fixture-backed pending future source/review/usage work.

## Final Acceptance For The Whole Plan

- All seven mockup pages are implemented in the running desktop renderer.
- Library remains functional and visually consistent.
- Renderer privilege boundaries remain intact.
- SQLite remains the local source of truth for durable state.
- Usage and review additions are local-only, tested, and documented.
- Full workspace verification and release smoke gates pass or have exact documented blockers.
