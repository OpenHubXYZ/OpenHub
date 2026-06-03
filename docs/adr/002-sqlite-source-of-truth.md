# ADR 002: SQLite Source Of Truth

Status: accepted

## Context

Agent skill directories can be edited by users and by multiple tools. Treating
those directories as the only state would make uninstall, rollback, history,
security scans, and sync unreliable.

## Decision

SQLite is the authoritative local source of truth for skills, versions, files,
installations, scans, sync state, and plugin state. Agent directories are
deployment projections recorded by app-owned metadata.

## Consequences

All write workflows must persist domain state before projecting files into
agent roots. Tests should use in-memory SQLite or temporary directories and
must not write to real user agent roots.

## Verification

Migration tests, repository tests, install/uninstall tests, rollback tests,
sync tests, and release smoke checks must pass.
