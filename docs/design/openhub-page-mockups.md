# TheOpenHub Page Mockups

## Goal

Create implementation-ready static page mockups for every primary navigation
page except Library, using the provided Library screenshot as the visual
baseline.

## Scope

- Dashboard
- Discover
- Installs
- Usage
- Reviews
- Security
- Settings

Library is intentionally excluded because the reference screenshot already
defines that surface, including the table density, search bar, right detail
panel, bottom status bar, and primary navigation treatment.

## Visual Baseline

- Desktop frame: 1487 x 1058, matching the supplied reference image.
- Shell: fixed left sidebar, top command bar, content workspace, bottom status
  bar.
- Style: light local-first desktop console, dense but readable tables, 6-8px
  radius, restrained blue accents, subtle row separators, compact controls.
- Product vocabulary: local skills, agent roots, sources, reviews, risk,
  installs, usage, security scans, sync, plugins, and offline-by-default state.

## Acceptance

- Each page renders as a standalone PNG in `docs/design/mockups/`.
- All mockups share the reference shell: brand, sidebar, top search/actions,
  and bottom runtime status.
- Page content maps to documented product surfaces and current runtime domains.
- Text remains inside its containers at the target desktop size.
- The source mockups can be re-rendered with the bundled Codex Python runtime:
  `/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
  docs/design/render-openhub-mockups.py`.

## Runtime Implementation Contract

- The Electron renderer uses the mockups as the first-screen visual source of
  truth and receives runtime data only through typed preload IPC.
- `workspace.state` is the renderer contract for local library rows, management
  flow, security center, usage center, review center, sync center, plugin state,
  and app metadata.
- The Discover navigation target is framed in runtime as Source Preview. It
  leads with local/Git source configuration, preview candidates, provenance,
  freshness, trust state, and `writesPlanned=false`; marketplace language is
  deferred until live trusted source/reputation data exists.
- Data-heavy runtime panels show compact provenance chips such as `SQLite`,
  `runtime`, `source preview`, `not scanned`, `sync disabled`, `network off`,
  and `manual root`.
- Runtime operational empty states must be domain-specific and action-oriented;
  generic `No records yet.` copy is not acceptable for tables or panels that
  drive scans, previews, reviews, installs, sync, or security decisions.
- `usage_events`, `review_items`, and `review_notes` are durable SQLite state.
  Import, agent scan, install plan creation, install application, and security
  scan actions append local-only usage records.
- High and medium security scan findings can create review queue items, but
  opening or updating review state does not approve or apply an install plan.
- Static mockups can remain illustrative, but runtime renderer state must not
  expose source catalog, ratings, trending, community signal, or visual sample
  fixture rows from empty local state.

## Artifacts

- Source: `docs/design/openhub-page-mockups.html`
- Renderer: `docs/design/render-openhub-mockups.py`
- Output directory: `docs/design/mockups/`
