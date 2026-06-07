# Stitch Skill Library Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Stitch Skill Library Manager artifacts into the current OpenHub desktop app as a live, local-first skill management workspace.

**Architecture:** Keep the existing Electron + React + TypeScript + SQLite architecture. Treat SQLite and typed preload IPC as the source of truth, and use the Stitch files as visual and information-architecture input, not as fixture data or a new runtime boundary.

**Tech Stack:** Electron, React 19, Vite, TypeScript, Zod IPC contracts, better-sqlite3, Vitest, Testing Library, lucide-react.

---

## Verified Inputs

- Design source: `docs/design/stitch_skill_library_manager/skill_manager_1..5/`.
- Requirements source: `docs/design/stitch_skill_library_manager/skill_manager_requirements.txt`.
- Design system source: `docs/design/stitch_skill_library_manager/technical_proficiency_framework/DESIGN.md`.
- Current renderer entry: `apps/desktop/src/renderer/App.tsx`.
- Current renderer style entry: `apps/desktop/src/renderer/app.css`.
- Current view-model entry: `apps/desktop/src/renderer/workspace-view-model.ts`.
- Current contracts: `packages/shared/src/ipc-contracts.ts`.
- Current runtime dispatch: `apps/desktop/src/main/desktop-runtime.ts`.
- Current SQLite migrations: `packages/db/src/migrations.ts`.

## Scope Decisions

- Keep the product brand `OpenHub`. `SkillManager` in the Stitch mockups is visual placeholder copy.
- Keep local-first behavior. No account, telemetry, remote catalog fetch, or cloud community feed is introduced by this plan.
- Convert visible `Home` copy to `Dashboard` only if all docs and renderer tests are updated in the same task. The route key can stay `home` to minimize churn.
- Keep Marketplace as source preview, import, and app-owned install. Do not show ratings, trending, reputation, trust levels, risk scores, or install-count claims in runtime UI.
- Build Skill Detail from `library.detail`, version data, local files, favorite state, and install state. Do not add a `Run Test Task` command because skill execution is explicitly outside the Stitch PRD.
- Analytics requires a new local activity/event schema before UI work. If implemented, it tracks OpenHub actions such as scan, preview, import, install, uninstall, favorite, and detail-open. It must not claim skill execution telemetry unless a separate accepted spec adds execution.
- Reviews and community ratings are not part of the first implementation. A community backend, identity model, moderation policy, abuse handling, and privacy review would be required before that scope can start.
- Existing dirty worktree changes are implementation baseline, not part of this plan. The executor must inspect them before editing shared files.

## File Structure

- Create: `docs/design/stitch_skill_library_manager/IMPLEMENTATION_SCOPE.md`
  - Records how each Stitch screen maps to current OpenHub runtime scope.
- Modify: `docs/mockup-implementation-goal-plan.md`
  - Updates current UI plan to reference the Stitch implementation scope.
- Modify: `docs/design/openhub-page-mockups.md`
  - Records the Dashboard naming decision and marketplace guardrails.
- Modify: `docs/computer-use-full-app-test-goal-plan.md`
  - Updates manual verification expectations after Dashboard/detail changes.
- Modify: `apps/desktop/src/renderer/workspace-view-model.ts`
  - Produces dashboard labels, summary models, selected detail summaries, and empty states from live state.
- Modify: `apps/desktop/src/renderer/App.tsx`
  - Implements shell, Dashboard, Skills/Marketplace, Skill Detail, Settings, and optional Activity UI.
- Modify: `apps/desktop/src/renderer/app.css`
  - Adds Stitch-derived design tokens and responsive layout rules.
- Modify: `apps/desktop/src/renderer/App.test.tsx`
  - Verifies user-visible flows, copy boundaries, actions, and absence of forbidden surfaces.
- Modify: `apps/desktop/src/renderer/app-css.test.ts`
  - Verifies viewport containment, token usage, responsive layout, and no forbidden CSS fragments.
- Modify: `apps/desktop/src/renderer/workspace-view-model.test.ts`
  - Verifies state-derived models and no fixture-backed data.
- Optional Phase 2 modify: `packages/db/src/migrations.ts`
  - Adds local activity events if Analytics is accepted.
- Optional Phase 2 modify: `packages/shared/src/ipc-contracts.ts`
  - Adds typed activity summary contracts if Analytics is accepted.
- Optional Phase 2 modify: `apps/desktop/src/preload/preload.ts`
  - Exposes activity IPC if Analytics is accepted.
- Optional Phase 2 modify: `apps/desktop/src/main/desktop-runtime.ts`
  - Records local activity events if Analytics is accepted.

## Task 1: Scope Contract And Docs Alignment

**Files:**
- Create: `docs/design/stitch_skill_library_manager/IMPLEMENTATION_SCOPE.md`
- Modify: `docs/mockup-implementation-goal-plan.md`
- Modify: `docs/design/openhub-page-mockups.md`
- Modify: `docs/computer-use-full-app-test-goal-plan.md`

- [ ] **Step 1: Create the Stitch implementation scope doc**

Write this content:

```markdown
# Stitch Skill Library Manager Implementation Scope

## Purpose

These Stitch artifacts are the visual and information-architecture source for the
OpenHub skills workspace refresh. They do not replace the current local-first
runtime, SQLite source of truth, typed preload IPC boundary, or agent-root write
safety rules.

## Screen Mapping

| Stitch artifact | OpenHub target | Runtime data source |
| --- | --- | --- |
| `skill_manager_1` Dashboard | Dashboard page, route key can remain `home` | `workspace.state`, `library.list`, agent roots, discover sources |
| `skill_manager_2` Marketplace | Marketplace source preview/import/install surface | `discover.*`, `import.*`, `install.*`, `workspace.state` |
| `skill_manager_3` Skill detail | Selected skill detail view or detail panel | `library.detail`, `version.*`, `library.setFavorite` |
| `skill_manager_4` Usage Analytics | Deferred local activity analytics | New accepted spec plus local activity schema |
| `skill_manager_5` Settings | Settings page refresh | `settings.*`, `agentRoots.*`, `discover.*`, `sync.*`, `plugins.*` |

## Product Guardrails

- Runtime UI must not show marketplace ratings, reputation, trust levels, risk
  scores, review queues, public community feedback, or telemetry sharing.
- Marketplace means local/Git source preview before import and explicit
  app-owned install into selected roots.
- Skill execution is out of scope. Any analytics page must label data as local
  OpenHub activity unless a separate accepted spec adds execution events.
- Agent roots remain indexing inputs by default. Writes require explicit
  copy/symlink install plans and app-owned uninstall records.
```

- [ ] **Step 2: Update current UI plan**

Add a short "Stitch refresh" paragraph to `docs/mockup-implementation-goal-plan.md` after the Goal section:

```markdown
The Stitch Skill Library Manager artifacts under
`docs/design/stitch_skill_library_manager/` are now the visual reference for this
workspace. Their Dashboard, Marketplace, Skill Detail, and Settings patterns are
in scope when backed by current local runtime data. Their Analytics and
Reviews/Ratings concepts require a separate accepted spec before runtime UI
appears.
```

- [ ] **Step 3: Update design page mockup doc**

In `docs/design/openhub-page-mockups.md`, update Current Navigation if the visible label changes:

```markdown
- Dashboard
- Skills
- Settings
```

Keep this guardrail text in the same file:

```markdown
Marketplace remains source preview, import, and app-owned install. It must not
display ratings, source reputation, trending rank, trust levels, or risk scores.
```

- [ ] **Step 4: Update manual full-app test plan**

In `docs/computer-use-full-app-test-goal-plan.md`, replace Home assertions with Dashboard assertions only if the UI label changes:

```markdown
- The app opens to Dashboard.
- Navigation contains Dashboard, Skills, and Settings.
```

- [ ] **Step 5: Verify docs boundaries**

Run:

```sh
rg -n "ratings|reputation|trust levels|risk scores|Usage Analytics|Reviews" docs/mockup-implementation-goal-plan.md docs/design/openhub-page-mockups.md docs/computer-use-full-app-test-goal-plan.md docs/design/stitch_skill_library_manager/IMPLEMENTATION_SCOPE.md
```

Expected: matches appear only in explicit guardrail or deferred-scope text.

## Task 2: Stitch Design Tokens And Shell Layout

**Files:**
- Modify: `apps/desktop/src/renderer/app.css`
- Modify: `apps/desktop/src/renderer/app-css.test.ts`
- Modify: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Add failing CSS token tests**

Add assertions to `app-css.test.ts`:

```ts
it('defines Stitch-derived OpenHub design tokens', async () => {
  const css = await readFile(cssPath, 'utf8');

  expect(cssBlock(css, ':root')).toContain('--oh-surface: #f7f9fb;');
  expect(cssBlock(css, ':root')).toContain('--oh-sidebar: #131b2e;');
  expect(cssBlock(css, ':root')).toContain('--oh-action: #0058be;');
  expect(cssBlock(css, ':root')).toContain('--oh-border: #c6c6cd;');
  expect(cssBlock(css, ':root')).toContain('--oh-radius: 8px;');
});
```

Run:

```sh
pnpm test -- apps/desktop/src/renderer/app-css.test.ts
```

Expected: FAIL because the variables are not defined yet.

- [ ] **Step 2: Add design variables**

At the top of `app.css`, extend `:root`:

```css
:root {
  --oh-surface: #f7f9fb;
  --oh-surface-muted: #eceef0;
  --oh-panel: #ffffff;
  --oh-sidebar: #131b2e;
  --oh-sidebar-muted: #7c839b;
  --oh-text: #191c1e;
  --oh-text-muted: #45464d;
  --oh-action: #0058be;
  --oh-action-strong: #2170e4;
  --oh-success: #10b981;
  --oh-warning: #f59e0b;
  --oh-error: #ba1a1a;
  --oh-border: #c6c6cd;
  --oh-border-soft: #e0e3e5;
  --oh-radius: 8px;
  --oh-sidebar-width: 260px;
  --oh-gutter: 24px;
  color: var(--oh-text);
  background: var(--oh-surface);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

- [ ] **Step 3: Convert shell colors and dimensions to variables**

Replace shell-level hard-coded colors in `.screen`, `.sidebar`, `.topbar`, `.workspace`, `.panel`, `.metric`, `.tag`, `.status`, `.tab-list`, `.table-row`, `.form-grid`, and responsive rules with the variables from Step 2. Keep `letter-spacing: 0` on headings and do not introduce viewport-based font scaling.

- [ ] **Step 4: Keep icon-first controls**

In `App.tsx`, keep lucide icons for navigation and command buttons. If adding Dashboard-specific actions, use existing icons:

```ts
import { FolderSearch, Home, Library, Plug, RefreshCw, Search, Settings, Star } from 'lucide-react';
```

Do not add text-only icon substitutes when a lucide icon exists.

- [ ] **Step 5: Verify layout containment**

Run:

```sh
pnpm test -- apps/desktop/src/renderer/app-css.test.ts
```

Expected: PASS. The tests still prove no document scrollbars, no `100vw`, responsive split collapse, and compact label clipping.

## Task 3: Dashboard Refresh From Live State

**Files:**
- Modify: `apps/desktop/src/renderer/workspace-view-model.ts`
- Modify: `apps/desktop/src/renderer/workspace-view-model.test.ts`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing view-model tests for Dashboard labels**

Update `workspace-view-model.test.ts`:

```ts
it('labels the primary workbench page as Dashboard while preserving local state metrics', () => {
  const viewModel = createWorkspaceViewModel(createEmptyWorkspaceState());

  expect(viewModel.navItems.map((item) => item.label)).toEqual([
    'Dashboard',
    'Skills',
    'Settings'
  ]);
  expect(viewModel.dashboard.metrics.map((metric) => metric.label)).toEqual([
    'Library skills',
    'Root locations',
    'App-owned installs'
  ]);
});
```

Run:

```sh
pnpm test -- apps/desktop/src/renderer/workspace-view-model.test.ts
```

Expected: FAIL because the current label is `Home`.

- [ ] **Step 2: Update view-model labels**

In `createWorkspaceViewModel`, keep the key `home` but change the label:

```ts
navItems: [
  { key: 'home', label: 'Dashboard' },
  { key: 'skills', label: 'Skills' },
  { key: 'settings', label: 'Settings' }
]
```

Keep view-model metrics limited to values available in `DesktopWorkspaceState`:

```ts
metrics: [
  {
    label: 'Library skills',
    value: String(state.skills.length || state.librarySkills.length),
    detail: 'SQLite library'
  },
  {
    label: 'Root locations',
    value: String(new Set(state.librarySkills.map((skill) => skill.rootPath)).size),
    detail: 'Indexed roots'
  },
  {
    label: 'App-owned installs',
    value: String(state.librarySkills.filter((skill) => skill.ownership === 'app-owned').length),
    detail: 'Managed projections'
  }
]
```

- [ ] **Step 3: Update renderer page title and Dashboard metrics**

In `App.tsx`:

```ts
function titleForPage(page: PageKey): string {
  return {
    home: 'Dashboard',
    skills: 'Skills',
    settings: 'Settings'
  }[page];
}
```

Keep Dashboard cards in `homeMetrics` because `App` has access to `agentRoots` and `discoverSources`:

```ts
const homeMetrics = useMemo(
  () => [
    {
      label: 'Library skills',
      value: String(state.skills.length || state.librarySkills.length),
      detail: 'SQLite library'
    },
    {
      label: 'Root locations',
      value: String(new Set(state.librarySkills.map((skill) => skill.rootPath)).size),
      detail: 'Indexed roots'
    },
    {
      label: 'Local roots',
      value: String(agentRoots.length),
      detail: 'Detected roots'
    },
    {
      label: 'Marketplace sources',
      value: String(discoverSources.length),
      detail: 'Configured sources'
    },
    {
      label: 'App-owned installs',
      value: String(state.librarySkills.filter((skill) => skill.ownership === 'app-owned').length),
      detail: 'Managed files'
    }
  ],
  [agentRoots.length, discoverSources.length, state.librarySkills, state.skills.length]
);
```

- [ ] **Step 4: Update renderer tests**

In `App.test.tsx`, update first-screen assertions:

```ts
expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
```

Keep negative assertions:

```ts
expect(screen.queryByRole('button', { name: 'Deploy' })).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Trust' })).not.toBeInTheDocument();
expect(screen.queryByText(/ratings|reputation|risk score/i)).not.toBeInTheDocument();
```

- [ ] **Step 5: Verify Dashboard behavior**

Run:

```sh
pnpm test -- apps/desktop/src/renderer/workspace-view-model.test.ts apps/desktop/src/renderer/App.test.tsx
```

Expected: PASS. Dashboard shows only metrics derived from `DesktopWorkspaceState` and local roots/sources.

## Task 4: Marketplace Cards And Filters Without Reputation Data

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/app.css`

- [ ] **Step 1: Write failing tests for Stitch-style marketplace cards**

Add a renderer test:

```ts
it('renders marketplace candidates as preview cards without rating or reputation copy', async () => {
  render(
    <App
      initialAgentRoots={[createRoot('/tmp/.codex/skills')]}
      initialPreviewSkills={[
        {
          name: 'Preview Helper',
          description: 'Preview only',
          tags: ['automation', 'codex'],
          path: '/tmp/source/preview-helper'
        }
      ]}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));

  const candidate = screen.getByRole('article', { name: 'Preview Helper' });
  expect(within(candidate).getByText('automation')).toBeInTheDocument();
  expect(within(candidate).getByText('/tmp/source/preview-helper')).toBeInTheDocument();
  expect(within(candidate).queryByText(/rating|reviews|installs|reputation|trending/i)).not.toBeInTheDocument();
});
```

Run:

```sh
pnpm test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: FAIL because marketplace candidate articles do not yet have an accessible name and tag chips.

- [ ] **Step 2: Update candidate markup**

In `MarketplaceTab`, render each preview candidate with an accessible article:

```tsx
<article key={skill.path} className="candidate skill-card" aria-label={skill.name}>
  <div className="candidate-heading">
    <strong>{skill.name}</strong>
    <span className="tag">preview</span>
  </div>
  <span>{skill.path}</span>
  <p>{skill.description}</p>
  <div className="tag-row" aria-label={`${skill.name} tags`}>
    {skill.tags.map((tag) => (
      <span className="tag tag-neutral" key={tag}>
        {tag}
      </span>
    ))}
  </div>
  <div className="candidate-actions">
    ...
  </div>
</article>
```

- [ ] **Step 3: Add card CSS**

In `app.css`, add:

```css
.skill-card {
  display: grid;
  gap: 10px;
}

.candidate-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tag-row {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-neutral {
  background: var(--oh-surface-muted);
  color: var(--oh-text-muted);
}
```

- [ ] **Step 4: Keep import/install semantics unchanged**

Do not change `onPreview`, `onImport`, `onInstall`, `onConfirmOverwrite`, or `onUninstall` behavior in this task. This is a markup and styling task only.

- [ ] **Step 5: Verify marketplace behavior**

Run:

```sh
pnpm test -- apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/app-css.test.ts
```

Expected: PASS. Existing preview/import/install tests still pass, and candidate cards contain no rating/reputation language.

## Task 5: Skill Detail From `library.detail`

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/workspace-view-model.ts`
- Modify: `apps/desktop/src/renderer/workspace-view-model.test.ts`

- [ ] **Step 1: Write failing selected-detail test**

Add an App test:

```ts
it('opens a live skill detail view from an indexed skill row', async () => {
  const state = workspaceWithAgentSkill(createEmptyWorkspaceState(), {
    agentCode: 'codex',
    agentDisplayName: 'Codex',
    name: 'PDF Parser',
    rootPath: '/tmp/.codex/skills'
  });
  window.theOpenHub = {
    getWorkspaceState: vi.fn().mockResolvedValue(state),
    listAgentRoots: vi.fn().mockResolvedValue([]),
    listDiscoverSources: vi.fn().mockResolvedValue([]),
    getSkillDetail: vi.fn().mockResolvedValue({
      skill: {
        id: 'skill-pdf',
        versionId: 'version-pdf',
        slug: 'pdf-parser',
        name: 'PDF Parser',
        description: 'Parse PDFs',
        tags: ['documents'],
        versionNo: 2,
        favorite: false
      },
      source: { type: 'local', url: '/tmp/pdf-parser' },
      versions: [{ versionId: 'version-pdf', skillId: 'skill-pdf', versionNo: 2, changeSummary: 'Import', createdAt: '2026-06-07' }],
      files: [{ relativePath: 'SKILL.md', hash: 'hash-pdf', size: 120, kind: 'markdown' }],
      skillMarkdown: '# PDF Parser'
    })
  } as unknown as NonNullable<typeof window.theOpenHub>;

  render(<App initialState={state} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open PDF Parser details' }));

  expect(await screen.findByRole('heading', { name: 'PDF Parser' })).toBeInTheDocument();
  expect(screen.getByText('SKILL.md')).toBeInTheDocument();
  expect(screen.getByText('Version 2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /run test task/i })).not.toBeInTheDocument();
});
```

Run:

```sh
pnpm test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: FAIL because the Skills table does not expose an open-detail action.

- [ ] **Step 2: Add selected detail state**

In `App.tsx`, add state:

```ts
const [selectedSkillDetail, setSelectedSkillDetail] = useState<SkillDetail | null>(null);
```

Pass it into `createWorkspaceUxModel`:

```ts
selectedSkillDetail,
```

- [ ] **Step 3: Add detail loader**

In `App.tsx`, add:

```ts
async function openSkillDetail(skillId: string) {
  try {
    const detail = await window.theOpenHub?.getSkillDetail(skillId);
    if (detail) {
      setSelectedSkillDetail(detail);
      setStatusMessage(`Opened ${detail.skill.name}`);
    }
  } catch (error) {
    setStatusMessage(errorMessage(error), 'error');
  }
}
```

- [ ] **Step 4: Add row action**

In each indexed skill row, add:

```tsx
<button type="button" className="inline-action" aria-label={`Open ${skill.name} details`} onClick={() => void onOpenDetail(skill.id)}>
  Details
</button>
```

Keep uninstall visible for app-owned rows.

- [ ] **Step 5: Render detail panel or page section**

Add a `SkillDetailPanel` component that renders:

```tsx
function SkillDetailPanel({ detail }: { detail: SkillDetail | null }) {
  if (!detail) {
    return <p className="empty">Select a skill to inspect files and versions.</p>;
  }

  return (
    <section className="panel detail-panel" aria-label={`${detail.skill.name} details`}>
      <h2>{detail.skill.name}</h2>
      <p>{detail.skill.description}</p>
      <div className="tag-row">
        <span className="tag">Version {detail.skill.versionNo}</span>
        {detail.skill.tags.map((tag) => (
          <span className="tag tag-neutral" key={tag}>{tag}</span>
        ))}
      </div>
      <h3>Files</h3>
      {detail.files.map((file) => (
        <div className="key-row" key={file.relativePath}>
          <span>{file.kind}</span>
          <strong>{file.relativePath}</strong>
        </div>
      ))}
      <h3>Skill markdown</h3>
      <pre className="markdown-preview">{detail.skillMarkdown}</pre>
    </section>
  );
}
```

- [ ] **Step 6: Verify detail flow**

Run:

```sh
pnpm test -- apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/workspace-view-model.test.ts
```

Expected: PASS. Detail data comes from `getSkillDetail`; no execution, ratings, or review UI is introduced.

## Task 6: Favorites And Local Filters

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/workspace-view-model.ts`
- Modify: `apps/desktop/src/renderer/workspace-view-model.test.ts`

- [ ] **Step 1: Write failing favorite toggle test**

Add:

```ts
it('toggles a skill favorite through typed preload IPC', async () => {
  const state = workspaceWithSkills(createEmptyWorkspaceState());
  const setFavorite = vi.fn().mockResolvedValue({
    id: 'skill-prompt',
    versionId: 'version-prompt',
    name: 'Prompt Writer',
    description: 'Writes prompts',
    versionNo: 1,
    favorite: true
  });
  window.theOpenHub = {
    getWorkspaceState: vi.fn().mockResolvedValue(state),
    listAgentRoots: vi.fn().mockResolvedValue([]),
    listDiscoverSources: vi.fn().mockResolvedValue([]),
    setFavorite
  } as unknown as NonNullable<typeof window.theOpenHub>;

  render(<App initialState={state} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  fireEvent.click(screen.getByRole('button', { name: 'Favorite Prompt Writer' }));

  await waitFor(() => expect(setFavorite).toHaveBeenCalledWith(expect.any(String), true));
});
```

Expected initial run: FAIL because no favorite action exists in the row UI.

- [ ] **Step 2: Add favorite action to indexed rows**

Render:

```tsx
<button
  type="button"
  className="icon-action"
  aria-label={`${skill.favorite ? 'Unfavorite' : 'Favorite'} ${skill.name}`}
  onClick={() => void onToggleFavorite(skill)}
>
  <Star size={15} aria-hidden="true" />
</button>
```

- [ ] **Step 3: Add favorite handler**

In `App.tsx`:

```ts
async function toggleFavorite(skill: LibrarySkillSummary) {
  try {
    const updated = await window.theOpenHub?.setFavorite(skill.id, !skill.favorite);
    if (updated) {
      setState((current) => ({
        ...current,
        librarySkills: current.librarySkills.map((item) =>
          item.id === skill.id ? { ...item, favorite: Boolean(updated.favorite) } : item
        ),
        skills: current.skills.map((item) =>
          item.id === skill.id ? { ...item, favorite: Boolean(updated.favorite) } : item
        )
      }));
      setStatusMessage(updated.favorite ? `Favorited ${updated.name}` : `Unfavorited ${updated.name}`);
    }
  } catch (error) {
    setStatusMessage(errorMessage(error), 'error');
  }
}
```

- [ ] **Step 4: Add favorites-only filter**

Add `favoritesOnly` state and a compact toggle above skill rows:

```tsx
const [favoritesOnly, setFavoritesOnly] = useState(false);
```

Filter visible agent rows with:

```ts
const favoriteFilteredRows = favoritesOnly ? agentRows.filter((skill) => skill.favorite) : agentRows;
```

- [ ] **Step 5: Verify filters**

Run:

```sh
pnpm test -- apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/workspace-view-model.test.ts
```

Expected: PASS. Favorites persist through IPC and remain local-only.

## Task 7: Settings Refresh With Privacy Defaults

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/app.css`

- [ ] **Step 1: Write failing settings privacy test**

Add:

```ts
it('renders Settings without telemetry sharing or API key prompts', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

  expect(screen.getByRole('heading', { name: 'Local roots' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Marketplace sources' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Sync' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/share usage analytics|telemetry|crash reports/i)).not.toBeInTheDocument();
});
```

Expected initial run: PASS if current Settings already avoids those prompts; keep the test as a regression guard.

- [ ] **Step 2: Style Settings with Stitch panels**

Use the existing `split-two`, `panel`, `form-grid`, and `key-row` classes. Do not add nested cards. Add only section-level spacing:

```css
.settings-stack {
  display: grid;
  gap: 16px;
}
```

- [ ] **Step 3: Use existing settings IPC only where visible controls exist**

If adding update-checks or log-level controls, use existing preload methods:

```ts
await window.theOpenHub?.setUpdateChecks(enabled);
await window.theOpenHub?.setLogLevel(logLevel);
```

Do not store secrets in renderer state beyond form input state. Do not add a skills.sh API key field.

- [ ] **Step 4: Verify Settings**

Run:

```sh
pnpm test -- apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/app-css.test.ts
```

Expected: PASS. Settings remains roots, marketplace sources, sync status, plugins, and local app preferences.

## Task 8: Optional Phase 2 Local Activity Analytics

**Files:**
- Modify: `packages/db/src/migrations.ts`
- Modify: `packages/db/src/migrations.test.ts`
- Create: `packages/db/src/activity-repository.ts`
- Create: `packages/db/src/activity-repository.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/shared/src/ipc-contracts.ts`
- Modify: `packages/shared/src/ipc-contracts.test.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/vite-env.d.ts`
- Modify: `apps/desktop/src/main/desktop-runtime.ts`
- Modify: `apps/desktop/src/main/desktop-runtime.test.ts`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Confirm accepted scope**

Before this task starts, create or update a spec that explicitly says the Analytics page is local OpenHub activity analytics, not skill execution analytics and not telemetry sharing. Do not start this task without that spec.

- [ ] **Step 2: Write failing migration test**

In `migrations.test.ts`, add `activity_events` to expected tables and bump expected latest version to 11:

```ts
expect(firstRun.applied).toContain('011_local_activity_events');
expect(getCurrentSchemaVersion(db)).toBe(11);
expect(tableNames).toEqual(expect.arrayContaining(['activity_events']));
```

Expected: FAIL.

- [ ] **Step 3: Add migration**

Append migration 11:

```ts
{
  version: 11,
  name: '011_local_activity_events',
  up(database) {
    database.exec(`
      create table activity_events (
        id text primary key,
        skill_id text references skills(id) on delete set null,
        event_type text not null check(event_type in (
          'scan',
          'preview',
          'import',
          'install',
          'uninstall',
          'favorite',
          'detail-open'
        )),
        status text not null check(status in ('success', 'error')),
        duration_ms integer,
        metadata_json text not null default '{}',
        occurred_at text not null default current_timestamp
      );

      create index idx_activity_events_time on activity_events(occurred_at desc);
      create index idx_activity_events_skill on activity_events(skill_id, occurred_at desc);
    `);
  }
}
```

- [ ] **Step 4: Add repository**

Create `packages/db/src/activity-repository.ts` with:

```ts
import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export type ActivityEventType = 'scan' | 'preview' | 'import' | 'install' | 'uninstall' | 'favorite' | 'detail-open';
export type ActivityStatus = 'success' | 'error';

export interface RecordActivityInput {
  skillId?: string | null;
  eventType: ActivityEventType;
  status: ActivityStatus;
  durationMs?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ActivityEventSummary {
  id: string;
  skillId: string | null;
  eventType: ActivityEventType;
  status: ActivityStatus;
  durationMs: number | null;
  occurredAt: string;
}

export interface ActivityRepository {
  record(input: RecordActivityInput): ActivityEventSummary;
  listRecent(limit?: number): ActivityEventSummary[];
}

export function createActivityRepository(database: SqliteDatabase): ActivityRepository {
  function listRecent(limit = 20): ActivityEventSummary[] {
    return database
      .prepare(
        `
          select
            id,
            skill_id as skillId,
            event_type as eventType,
            status,
            duration_ms as durationMs,
            occurred_at as occurredAt
          from activity_events
          order by occurred_at desc
          limit @limit
        `
      )
      .all({ limit }) as ActivityEventSummary[];
  }

  return {
    record(input) {
      const id = randomUUID();
      database
        .prepare(
          `
            insert into activity_events
              (id, skill_id, event_type, status, duration_ms, metadata_json)
            values
              (@id, @skillId, @eventType, @status, @durationMs, @metadataJson)
          `
        )
        .run({
          id,
          skillId: input.skillId ?? null,
          eventType: input.eventType,
          status: input.status,
          durationMs: input.durationMs ?? null,
          metadataJson: JSON.stringify(input.metadata ?? {})
        });
      return listRecent(1)[0]!;
    },
    listRecent
  };
}
```

- [ ] **Step 5: Add IPC contracts**

Add schemas in `ipc-contracts.ts`:

```ts
const activityEventSummarySchema = z.object({
  id: z.string().min(1),
  skillId: z.string().min(1).nullable(),
  eventType: z.string().min(1),
  status: z.enum(['success', 'error']),
  durationMs: z.number().int().nonnegative().nullable(),
  occurredAt: z.string().min(1)
}).strict();

export type ActivityEventSummary = z.infer<typeof activityEventSummarySchema>;
```

Add contract:

```ts
activityRecent: {
  channel: 'activity.recent',
  request: z.object({ limit: z.number().int().positive().max(100).optional() }).strict(),
  response: z.array(activityEventSummarySchema)
}
```

- [ ] **Step 6: Wire runtime and renderer**

Expose `getRecentActivity(limit?: number)` through preload and `vite-env.d.ts`. In `desktop-runtime.ts`, dispatch `activity.recent` through `createActivityRepository(database).listRecent(limit)`.

- [ ] **Step 7: Render Activity Analytics only from local events**

If adding a visible page or section, label it `Activity`, not `Usage Analytics`, unless the accepted spec says otherwise. Render counts by event type and recent event rows from `activity.recent`. Do not add telemetry sharing settings.

- [ ] **Step 8: Verify Analytics**

Run:

```sh
pnpm test -- packages/db/src/migrations.test.ts packages/db/src/activity-repository.test.ts packages/shared/src/ipc-contracts.test.ts apps/desktop/src/main/desktop-runtime.test.ts apps/desktop/src/renderer/App.test.tsx
```

Expected: PASS. Activity events are local SQLite rows and contain no external telemetry behavior.

## Task 9: Browser/Desktop Visual Verification

**Files:**
- No source edits unless visual verification finds regressions.

- [ ] **Step 1: Run automated gates**

Run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 2: Start the dev app**

Run:

```sh
pnpm dev
```

Expected: Electron opens the desktop shell.

- [ ] **Step 3: Verify desktop surfaces manually**

Use a temporary app-data directory and synthetic roots. Verify:

- Dashboard opens first and has no fixture metrics such as `1,248`, `342h`, or `89%`.
- Navigation contains Dashboard, Skills, and Settings.
- Skills search, agent tabs, marketplace source preview, import, install, overwrite confirmation, and uninstall still work.
- Skill Detail opens from an indexed skill and shows files, versions, markdown, and favorite state.
- Settings shows local roots, marketplace sources, sync, plugins, and local app controls.
- Runtime UI does not show Deploy, Trust, Security Center, public Reviews, ratings, reputation, risk scores, or telemetry sharing.

- [ ] **Step 4: Run release-level smoke if UI and runtime changed**

Run:

```sh
pnpm package:desktop
pnpm release:smoke
```

Expected: both commands exit 0 on the current platform.

## Rollback Point

Before implementation, record:

```sh
git status --short
git rev-parse HEAD
```

If the implementation needs rollback, revert only files touched by the implementation task. Do not reset or discard pre-existing dirty changes.

## Acceptance Summary

- Stitch Dashboard, Marketplace, Skill Detail, and Settings are represented in the live app using real OpenHub state.
- The app remains local-first and renderer-isolated through typed preload IPC.
- No forbidden runtime surfaces or copy appear: Deploy, Trust, Security Center, public Reviews, ratings, source reputation, risk scores, telemetry sharing.
- Analytics appears only after a separate accepted local-activity spec and schema.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- For desktop packaging scope, `pnpm package:desktop` and `pnpm release:smoke` pass.
