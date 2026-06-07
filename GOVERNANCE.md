# Governance

OpenHub is an MIT licensed open-source project stewarded by maintainers.

## Decision Principles

Technical decisions should preserve:

- Local-first behavior.
- SQLite as the local source of truth.
- Clear renderer and main-process privilege separation.
- Reproducible builds and tests.
- Minimal permissions for sync and plugins.
- Read-only treatment of agent roots unless a future accepted spec changes that
  boundary.
- Contributor-visible documentation for major architecture choices.

## Maintainer Responsibilities

Maintainers are responsible for:

- Reviewing pull requests and security reports.
- Keeping the roadmap and release notes current.
- Enforcing the code of conduct.
- Requiring tests for public contracts.
- Documenting architecture decisions that affect contributors.
- Avoiding accidental collection of private skill contents or user paths.
- Following `docs/maintainer-guide.md` for triage, releases, and security
  intake.

## Decision Process

Small implementation decisions can be made in pull requests. Larger decisions
should be captured in docs or ADRs under `docs/adr/` before implementation,
including:

- Storage model changes.
- Renderer privilege changes.
- Plugin permission changes.
- Sync protocol changes.
- Import, indexing, or source-preview behavior changes.
- Any future deploy, trust scoring, reputation, scanner, policy, or review
  workflow.
- Release and signing policy changes.

When maintainers disagree, prefer the option that is safer, easier to test, and
more reversible.

## Security Handling

Security reports follow `SECURITY.md`. Public disclosure should wait until a
fix or mitigation is available, unless the issue is already public or active
exploitation requires faster communication.

Operational policies:

- Triage: `docs/triage-policy.md`
- Labels: `docs/issue-labels.md`
- Dependency updates: `docs/dependency-policy.md`
- Security response: `docs/security-response-playbook.md`
- Roadmap changes: `docs/roadmap-workflow.md`
