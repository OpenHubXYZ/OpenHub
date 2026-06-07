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
