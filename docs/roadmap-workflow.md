# Roadmap Workflow

The public roadmap lives in `docs/roadmap.md` and is backed by the planning
references under `references/`.

## Update Flow

1. Open an issue or discussion describing the proposed roadmap change.
2. Label it with area, type, and priority.
3. Link relevant ADRs or create a new ADR for major architecture changes.
4. Update `docs/roadmap.md`, related docs, and `CHANGELOG.md` in the same pull
   request.
5. Include verification commands and release impact.

## Status Rules

- Planned work stays in future phases.
- Completed work must have tests, docs, and a commit.
- Deferred work needs an issue link and a clear reason.
- Security or privacy changes require maintainer review before roadmap
  publication.
