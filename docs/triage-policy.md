# Triage Policy

Triage should produce a clear owner, severity, next action, and label set.

## Priorities

- `priority:p0`: data loss, install bypass, renderer privilege escape,
  security exposure, release blocker.
- `priority:p1`: broken core workflow, migration defect, high-risk regression.
- `priority:p2`: important usability or compatibility problem.
- `priority:p3`: polish, docs, non-blocking cleanup.

## Flow

1. Confirm the report has environment, steps, expected behavior, and actual
   behavior.
2. Reproduce locally or mark `needs:reproduction`.
3. Apply area, type, and priority labels.
4. Link to a roadmap phase or ADR when architecture is involved.
5. Assign an owner or mark `needs:maintainer`.

Security issues should move to private vulnerability handling instead of public
issue discussion.
