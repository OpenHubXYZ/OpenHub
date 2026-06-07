# ADR 004: Plugin Permissions

Status: accepted

## Context

Plugins let contributors add adapters, importers, and sync drivers. They also
introduce risk if they receive broad filesystem, network, or process access.

## Decision

Plugins are disabled by default. Every plugin must declare capabilities and
permissions in its manifest, pass entry integrity checks, and receive explicit
permission authorization before enablement. The host exposes registration
methods only.

## Consequences

The host is a constrained capability boundary, not a complete sandbox.
Maintainers must review plugin code and permission requests before enabling or
publishing plugins.

## Verification

Plugin tests must prove manifest validation, explicit permission authorization,
malicious entry blocking, declared capability registration, and disabled
capability removal.
