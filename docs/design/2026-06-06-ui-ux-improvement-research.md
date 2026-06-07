# OpenHub UI/UX Direction

Date: 2026-06-06

## Update

This research note has been amended after the product scope changed. OpenHub is
now a skills-first desktop app. Prior recommendations that centered on deploy
transactions, trust scoring, security-review queues, usage analytics, or review
workflows are superseded.

## Current Product Wedge

OpenHub should help a developer answer:

- What local skills do I have?
- Which agent roots were detected?
- Which skills are indexed or imported?
- What files does a skill contain?
- What changed between versions?
- What source candidates can I preview before import?
- Which imported skills have app-owned installs in agent roots?
- Are sync and plugins disabled unless I explicitly enable them?

## UX Priorities

1. Make the first-run path stateful: detect roots, scan skills, preview a
   marketplace source.
2. Keep Skills dense, searchable, and grouped by agent/root.
3. Keep Skills > Marketplace framed as preview-before-import/install, without
   ratings or reputation.
4. Keep Settings focused on roots, marketplace sources, sync disabled-default,
   and plugin registry state.
5. Remove navigation and copy for Deploy, Trust, Installs, Security, Usage, and
   Reviews from current runtime UI.

## Design Guardrails

- Do not show ratings, trending, source reputation, trust levels, risk scores,
  policy results, or approval states.
- Do not imply arbitrary root writes; root writes require explicit app-owned
  copy/symlink install plans.
- Label local state provenance when it matters.
- Use concise controls and avoid explanatory feature text inside the app.
- Prefer stable table and toolbar dimensions over decorative dashboard cards.
