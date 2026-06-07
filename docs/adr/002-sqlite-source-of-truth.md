# ADR 002: SQLite Source Of Truth

Status: accepted

## Context

Agent skill directories can be edited by users and by multiple tools. Treating
those directories as the only state would make history, search, source preview,
collections, sync, and plugin workflows unreliable.

## Decision

SQLite is the authoritative local source of truth for skills, versions, files,
indexed locations, installations, sync state, and plugin state. Agent
directories are read-only for scanning by default; root writes require explicit
app-owned copy/symlink install plans.

## Consequences

All write workflows must persist domain state in SQLite and the content store.
Install workflows must write only planned target files or symlinks and uninstall
only recorded app-owned files. Tests should use in-memory SQLite or temporary
directories.

## Verification

Migration tests, repository tests, import tests, indexing tests, sync tests, and
release smoke checks must pass.
