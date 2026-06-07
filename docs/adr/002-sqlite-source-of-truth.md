# ADR 002: SQLite Source Of Truth

Status: accepted

## Context

Agent skill directories can be edited by users and by multiple tools. Treating
those directories as the only state would make history, search, source preview,
collections, sync, and plugin workflows unreliable.

## Decision

SQLite is the authoritative local source of truth for skills, versions, files,
indexed locations, sync state, and plugin state. Agent directories are read-only
inventory inputs in the current runtime.

## Consequences

All write workflows must persist domain state in SQLite and the content store.
Current workflows must not write to real user agent roots. Tests should use
in-memory SQLite or temporary directories.

## Verification

Migration tests, repository tests, import tests, indexing tests, sync tests, and
release smoke checks must pass.
