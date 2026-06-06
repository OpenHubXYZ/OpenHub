# OpenHub UI/UX Improvement Research

Date: 2026-06-06

## Scope

Product: OpenHub, a local-first desktop application for managing AI coding agent skills across Codex, Claude, Gemini, OpenCode, and other local agent environments.

Audience considered:

- Individual developers who already use multiple coding agents and want skills to be findable, safe, versioned, and reversible.
- Team leads who want a local, auditable way to distribute recommended skills and avoid unreviewed agent extensions.
- Security-conscious users who need to understand what a skill can read, write, execute, or exfiltrate before enabling it.

Research scope:

- Review the current repository product contract, renderer structure, and design mockups.
- Map current UI against user jobs and product-manager priorities.
- Check adjacent public signals from Codex, Claude Code, skills marketplaces, and AI-agent security research.
- Produce product recommendations only. No renderer implementation is included in this document.

Success criteria for this research:

- Identify the highest-leverage UI/UX problems with observed evidence.
- Separate repository facts, external signals, and inferred recommendations.
- Turn findings into a prioritized opportunity map that can become a follow-up UI spec.

## Implementation Follow-Through

The first Incremental Replace pass implements this research direction inside
the existing Electron/React renderer without adding SQLite migrations or public
IPC channels. Runtime UI now treats Discover as Source Preview, keeps preview
operations read-only with `writesPlanned=false` evidence, replaces generic
operational empty states with page-specific next actions, surfaces provenance
chips on first-run and decision surfaces, adds a Trust and Impact rail, presents
install apply as a visible-plan transaction, exposes agent compatibility rows,
and extends Help into contextual diagnostics.

The product contract remains: Source Preview is not a marketplace. Ratings,
trending, community reputation, and source catalog rows stay out of runtime UI
until live trusted source and reputation data exists.

## Executive Read

OpenHub's strongest product wedge is not "a marketplace for skills." The stronger wedge is a local trust and deployment cockpit for agent skills: what is installed, which agent can see it, what will be written, what changed, what is risky, and how to roll back. The current UI language already points there with SQLite source of truth, offline defaults, install plans, security center, reviews, sync, and plugins. The risk is that the product exposes too many operations as peer pages and tabs before the first user has formed a mental model.

The first-screen experience should therefore shift from a dashboard of system health to a task funnel: detect roots, scan/import skills, review trust, then install or roll back. Security and review should become part of every install/source decision, not only separate destinations. Discover should be framed as source preview and import, not as a marketplace unless live catalog trust, provenance, and freshness are fully represented. The right rail should become a decision rail for the selected object, with provenance, risk, write impact, and next action.

## Evidence Map

### Repository Evidence

- `README.md` states that OpenHub manages skills across Codex, Claude, Gemini, OpenCode, and other local environments, with SQLite as local source of truth and agent directories as projections.
- The same README says Phase 10 includes root scanning, imports, install/uninstall, rollback, security rescans, exemptions, sync conflicts, plugin state, and Discover previews.
- `docs/design/openhub-page-mockups.md` defines a dense local-first desktop console with fixed sidebar, top command bar, right detail rail, bottom status bar, and primary pages for Dashboard, Discover, Installs, Usage, Reviews, Security, and Settings.
- The design contract explicitly says source catalog cards, source updates, community signal, and no-preload visual samples remain fixture-backed until a separate local source-sync feature is approved.
- `workspace-view-model.ts` now maps empty runtime state to empty Discover/source/community rows instead of surfacing fake marketplace data.
- Renderer tests explicitly guard against visible mock or fixture-backed rows in empty runtime pages.
- Current uncommitted UI work adds collapsible sidebar and a help drawer. That improves navigation ergonomics, but the help drawer remains static documentation rather than contextual task guidance.

### External Public Signals

- Anthropic's Claude Code skills docs position skills as reusable instructions and supporting files that extend an agent, with optional tool restrictions and plugin namespacing.
- Anthropic's user-facing help notes that skills may include or instruct Claude to install third-party packages and software.
- OpenAI Codex issue #10430 reports user confusion when skills were physically moved to `~/.agents/skills` but did not appear in Codex.
- OpenAI Codex issue #22078 reports a local marketplace plugin that looked healthy on disk and in config, but whose skills were not exposed in fresh Codex sessions.
- Public user posts around skill marketplaces repeatedly describe scattered skill folders, manual GitHub hunting, unclear quality, unclear version freshness, and desire to preview `SKILL.md` before install.
- GitGuardian warns that AI coding tools can expose secrets through prompts, file reads, commands, and MCP calls; their MCP ecosystem scan found secret exposure in public server repositories.
- NSA's MCP security guidance calls out malicious tool descriptions, prompt injection, data exfiltration, and systemic risks in chained agent workflows.

Source URLs are listed at the end of this document.

## User Jobs

### Job 1: "What skills do I have, and which agents can use them?"

The user needs a unified inventory, not just a file tree. The UI must answer: detected roots, indexed skills, source agent, install target, scope, last verified time, broken roots, and which skills are not currently visible to each agent.

Current support: strong backend and renderer primitives exist: root detection, library rows, status bar, Settings agent roots, and Dashboard coverage.

Gap: the first-run path still makes the user infer whether scan, import, Discover, Library, Settings, or Security is the right next step.

### Job 2: "Can I trust this skill before I install it?"

The user needs provenance, file preview, security findings, permission implications, and reputation signal in one decision surface.

Current support: Security, Reviews, Discover profile, write preview, exemptions, and plugin permission concepts exist.

Gap: trust is distributed across Discover, Security, Reviews, Installs, and right rail cards. That is product-correct internally, but cognitively expensive for users.

### Job 3: "What exactly will OpenHub write?"

The user needs an install plan that feels like a transaction: target, files, conflicts, risk, policy result, apply button, and rollback point.

Current support: Installs page, write preview, conflict planning, app-owned uninstall, rollback, and file ownership records are central to the product contract.

Gap: the install plan should be treated as the primary conversion moment. It needs stronger before/after impact, not only table rows and rail metadata.

### Job 4: "How do I keep skills current without losing control?"

The user needs version freshness, update availability, diff, rollback, and optional sync boundaries.

Current support: version history, diffs, rollback, collections, sync disabled-by-default, and export/import exist.

Gap: update and version workflows are present but not yet framed as a coherent "change review" loop.

### Job 5: "How do I explain this to a team?"

The user needs a team baseline, exportable collection, policy pack, security exception trail, and exact local/offline guarantees.

Current support: collections, policy packs, team baselines, sync profiles, export/import, security playbook, and governance docs exist.

Gap: the UI should make "local-only vs shared" explicit at every point where a team workflow might imply network, account, or telemetry.

## Ranked UX Problems

### 1. First-run path is not yet a guided operational funnel

Severity: High
Confidence: High
Surface: First launch, Dashboard, top actions, Help

What breaks: Users who do not already understand OpenHub's architecture are dropped into a dense control surface. They need to know whether to scan roots, add a source, import a local skill, inspect Library, or review Security first.

Evidence: The repo has a first-launch wizard and help drawer, but the default workspace still exposes eight primary pages and many tabs. The help content lists workflows but does not drive the user through stateful next steps.

Recommended product move: Replace the first useful dashboard section with a stateful "Start here" task rail: detect roots, run scan, import/preview first skill, review risk, create install plan. Keep the dense dashboard for returning users.

### 2. Trust decisions are split across too many places

Severity: High
Confidence: High
Surface: Discover, Library detail, Installs, Security, Reviews, right rail

What breaks: A user evaluating one skill must mentally stitch together source trust, risk findings, file preview, install writes, review status, and exemptions.

Evidence: Current pages model these concepts separately; external signals show skill/package provenance and hidden behavior are a core pain point and security risk.

Recommended product move: Introduce a reusable "Trust and impact rail" for any selected source, skill, version, plugin, or install plan. It should always show provenance, signature/hash state, risk, capabilities, planned writes, last scan, and recommended next action.

### 3. Discover looks like a marketplace before source truth is complete

Severity: High
Confidence: Medium
Surface: Discover

What breaks: Marketplace-like cards, ratings, featured/trending tabs, and community signals create an expectation of live reputation data. The design contract says some of this remains fixture-backed until separate source sync exists.

Evidence: `docs/design/openhub-page-mockups.md` explicitly marks source catalog cards, source updates, community signal, and visual samples as fixture-backed pending future source sync. Current view model removes these from empty runtime state.

Recommended product move: Rename the first version of Discover to "Sources" or "Source Preview." Lead with local/Git source configuration, preview before import, signature/hash/provenance, and "no writes until install plan." Add marketplace language only after live trust data exists.

### 4. The app's state provenance is still too implicit

Severity: High
Confidence: High
Surface: Dashboard, status bar, right rail, tables

What breaks: Users need to know whether a number is from runtime SQLite, local cache, configured source preview, mock/test data, or future network sync. Without that, local-first trust erodes.

Evidence: The product relies on SQLite as truth, but design mockups and tests reveal an active effort to remove visible fixture rows from empty runtime pages.

Recommended product move: Use compact provenance chips on data-heavy panels: `SQLite`, `local cache`, `source preview`, `not scanned`, `sync disabled`, `network off`. Avoid generic "All good" when no scan/import has happened.

### 5. Navigation mirrors internal modules more than user lifecycle

Severity: Medium
Confidence: High
Surface: Sidebar and tabs

What breaks: Dashboard, Library, Discover, Installs, Usage, Reviews, Security, Settings is understandable to builders, but users are trying to complete lifecycle jobs: find, evaluate, install, govern, recover.

Evidence: The app exposes eight pages and 35 page tabs. Public user complaints around skills focus on scattered locations, versions, previews, and safe install, not on module boundaries.

Recommended product move: Keep the current pages, but make the dashboard lifecycle-oriented: Inventory, Source preview, Trust review, Install plan, Rollback/export. Use pages as deep workspaces, not first-run navigation requirements.

### 6. Empty states are technically safe but not product-complete

Severity: Medium
Confidence: High
Surface: all empty runtime pages

What breaks: Removing fake rows is correct, but "No records yet" alone does not tell a user why the page is empty or what action will create durable state.

Evidence: `DataTable` falls back to "No records yet." Tests block fixture rows. That protects truthfulness, but creates thin UX on first use.

Recommended product move: Replace generic empty tables with domain empty states: "No sources previewed. Add a local folder or Git URL to preview candidates. No files are written." Each empty state needs one primary action and one local-first reassurance.

### 7. Cross-agent compatibility is under-explained

Severity: Medium
Confidence: Medium
Surface: Library detail, install plan, status bar, Settings roots

What breaks: Users need to understand whether a skill written for one ecosystem will behave well in another, especially across Codex, Claude, Gemini, and OpenCode.

Evidence: External issues show physically present skills may still fail to load. The repository has adapters and roots, but UI should make compatibility and visibility explicit.

Recommended product move: Add a compatibility matrix to skill detail and install plan: agent, root, visibility status, skill format support, warnings, and required manual action.

### 8. Help is static, but users need contextual recovery

Severity: Medium
Confidence: Medium
Surface: Help drawer, right rail, failed actions

What breaks: Static help explains concepts, but users often need recovery steps: why a root is manual, why a skill is not visible, why an install is blocked, what an exemption means.

Evidence: Current uncommitted help drawer summarizes five workflows. External Codex issues show "configured but not visible" cases are hard to diagnose.

Recommended product move: Keep the drawer, but add contextual diagnostics from selected state: root not found, plugin enabled but skills not exposed, source preview failed, blocked install, stale version, sync conflict.

## Product Direction

Recommended positioning:

> OpenHub is the local control plane for AI agent skills: inventory, preview, trust, install, review, rollback, and export across every local coding agent.

This is sharper than "desktop skills manager" because it makes trust and reversibility the reason to use the app.

## Proposed UI/UX Improvements

### A. Home as an operational command center

Make Dashboard task-based:

- Start here: Detect roots, Run scan, Add source/import skill, Review risk, Create install plan.
- Workspace health: only show metrics after the underlying data exists.
- Next action: one primary action, one explanation, one link to evidence.
- Recent activity: hide or replace with setup tasks until real usage events exist.

Acceptance:

- On a fresh install, a user can identify the next action within 10 seconds.
- No page shows fake marketplace or activity rows when runtime state is empty.
- Every card explains the local data source or absence of data.

### B. Source Preview instead of early marketplace Discover

Make the first Discover version honest and useful:

- Add source: local folder, Git URL, ZIP/TAR, mirror.
- Preview candidates before import.
- Show source trust: local, Git remote, signed, allowlisted, unknown.
- Show "writes nothing yet" until install plan.
- Keep featured/trending/community sections disabled or hidden until live trusted source sync exists.

Acceptance:

- A user can preview a source and decide not to import without any agent-root writes.
- Every source row has provenance, freshness, and trust state.
- Marketplace-style ratings are absent unless backed by real persisted source data.

### C. Skill detail as the main decision object

Make one selected skill the center of action:

- Overview: name, description, source, tags, supported agents.
- Files: `SKILL.md`, support files, executable/script markers.
- Trust: scan score, findings, signature/hash, source provenance.
- Install: compatible targets, writes, conflicts, policy result.
- Versions: current, available, diff, rollback point.
- Usage: local-only launches, installs, exports, reviews.

Acceptance:

- A user can answer "should I install this?" from one screen.
- Security, review, and install status are visible together.
- "Open in agent root" and "Install" actions are disabled or explained when unsafe.

### D. Install plan as a reviewable transaction

Make install a stepper or modal-sized focused workspace:

1. Choose target agent and scope.
2. Review planned writes and conflicts.
3. Review security result and policy decision.
4. Apply or cancel.
5. Show rollback/export result.

Acceptance:

- No write action happens before the plan is visible.
- Users see exact path impact and app-owned uninstall boundary.
- Blocked/high-risk plans require explicit review or scoped exemption.

### E. Unify Security and Reviews into a governance loop

Keep both pages if useful, but frame them as one workflow:

- Security creates findings and policy decisions.
- Reviews tracks human decisions, notes, exemptions, and change approvals.
- Install stays blocked until governance state permits it.

Acceptance:

- Opening a review item never applies an install.
- A finding shows the install/source/skill it affects.
- Exemptions show scope, reason, age, revocation action, and affected installs.

### F. Make provenance visible everywhere

Use concise chips:

- `SQLite`
- `runtime`
- `local cache`
- `source preview`
- `not scanned`
- `sync disabled`
- `network off`
- `manual root`

Acceptance:

- Every metric or table with operational consequences has a provenance label.
- Empty state copy names the missing prerequisite.
- The status bar reports "last scan: never" instead of implying healthy state without evidence.

## Opportunity Map

### Fix this week

- Convert generic empty tables into task-specific empty states.
- Replace "All good" style status with evidence-backed status.
- Add provenance chips to Dashboard, Discover/Sources, Installs, Security, and right rail.
- Make Dashboard first-run task funnel the primary initial surface.
- Rename or reframe Discover to Source Preview unless live source trust exists.

### Fix this quarter

- Build the reusable Trust and Impact rail.
- Add compatibility matrix to skill detail/install plan.
- Turn install plan into a focused transaction review.
- Add contextual diagnostics for "skill exists but not visible," "root manual," "blocked install," and "source preview failed."
- Unify Security and Reviews into a clear governance loop.

### Needs deeper research

- Whether target users prefer a lifecycle nav grouping or the current module nav.
- Which source trust labels users understand without training.
- Whether marketplace-style discovery should be in v1, or deferred until signed/curated sources are real.
- What minimum preview is enough before install: `SKILL.md` only, all files, diff, security excerpt, or all of the above.
- Team baseline sharing: export package, Git sync, shared folder, or REST sync first.

## User Research Plan

Run five moderated usability tasks with developers who use at least two coding agents:

1. Fresh install: "Find your local agent skill roots and run the first scan."
2. Source preview: "Add a Git source, inspect one skill, and decide whether to import it."
3. Trust decision: "Find why this skill is blocked and what evidence caused the block."
4. Install transaction: "Install a low-risk skill to Codex and explain what files will be written."
5. Recovery: "Roll back or uninstall a skill without deleting files OpenHub does not own."

Success signals:

- User can state where data came from.
- User can identify whether network/sync is active.
- User can explain why a write is safe or blocked.
- User can recover from a failed or blocked plan.
- User does not need docs to understand the first action.

## Risks And Boundaries

- This research did not run a live Electron session. It used repository files, existing screenshots/mockups, and current renderer code.
- Public external signals are from adjacent products and ecosystems, not OpenHub users, because OpenHub is local project code and not a launched public product.
- Some renderer files had pre-existing uncommitted changes when this research was written. This document treats them as current local state but does not modify them.
- Security sources around MCP and AI coding tools are broader than skills alone. They are relevant because OpenHub's value proposition includes local extension governance and plugin/source trust.

## Source Map

Repository sources:

- `README.md`
- `docs/architecture.md`
- `docs/design/openhub-page-mockups.md`
- `docs/mockup-implementation-goal-plan.md`
- `docs/testing.md`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/workspace-view-model.ts`
- `apps/desktop/src/renderer/App.test.tsx`

Public sources checked:

- Anthropic Claude Code skills docs: https://code.claude.com/docs/en/skills
- Anthropic Skills help center: https://support.claude.com/en/articles/12512180-use-skills-in-claude
- OpenAI Codex issue #10430, skills not loaded from `~/.agents/skills`: https://github.com/openai/codex/issues/10430
- OpenAI Codex issue #22078, local marketplace plugin enabled but skills not exposed: https://github.com/openai/codex/issues/22078
- Reddit user post, marketplace for `SKILL.md` skills because GitHub hunting was tedious: https://www.reddit.com/r/claude/comments/1rkjqjf/i_built_a_marketplace_for_skillmd_skills_because/
- Reddit user post, skills scattered across folders and no easy version visibility: https://www.reddit.com/r/vibecoding/comments/1rzbisl/i_built_a_skills_marketplace_for_forge_manage/
- GitGuardian secret scanning for AI coding tools: https://docs.gitguardian.com/ggshield-docs/integrations/ai-coding-tools/secret-scanning-for-ai-coding-tools
- GitGuardian MCP secret leak research: https://blog.gitguardian.com/a-look-into-the-secrets-of-mcp/
- NSA MCP security design considerations: https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf
