# Maintainer Guide

This guide gives maintainers one path to triage issues, prepare releases, and
handle security intake.

## Weekly Triage

- Review new issues, discussions, and pull requests.
- Apply labels from `docs/issue-labels.md`.
- Escalate `priority:p0` bugs, security reports, migration risks, and renderer
  privilege changes.
- Ask for a failing test or reproduction when behavior is unclear.
- Close duplicates only after linking the canonical issue.

## Pull Requests

- Require a clear scope, linked issue or roadmap phase, verification commands,
  and security/privacy/release impact.
- Require screenshots or browser smoke evidence for renderer changes.
- Require migration notes for schema changes.
- Require ADR updates for major architecture decisions.

## Releases

- Run the release checklist in `docs/release.md`.
- Confirm `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm package:desktop`, and `pnpm release:smoke`.
- Generate checksums and dependency inventory.
- Review release smoke logs for redaction.
- Confirm signing and notarization status before publishing public installers.

## Security Intake

- Follow `docs/security-response-playbook.md` for private vulnerability intake.
- Keep security reports private until a fix or mitigation is ready.
- Track disclosure timing and user impact.

## Roadmap

- Keep `docs/roadmap.md` and `references/` aligned with completed phases.
- Record public roadmap updates through `docs/roadmap-workflow.md`.
