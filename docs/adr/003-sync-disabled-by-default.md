# ADR 003: Sync Disabled By Default

Status: accepted

## Context

Skill contents, local paths, and agent configuration can be sensitive. Sync is
useful, but automatic sync would violate the local-first privacy default.

## Decision

Sync is disabled by default. No sync activity runs without an enabled user
profile. Local SQLite writes happen before outbox enqueue, and remote drivers
move packages without bypassing the database.

## Consequences

Release checks must prove no sync profile is created automatically. New sync
drivers require explicit mode configuration, tests, and privacy review.

## Verification

Sync service tests must prove no-profile startup inactivity, push/pull behavior,
conflict lifecycle, and release privacy defaults.
