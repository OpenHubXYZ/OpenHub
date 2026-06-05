# Security Model

OpenHub is a local-first skills manager. Its security model is
designed to reduce accidental unsafe installs and make risky choices auditable.
It is not an execution sandbox.

## Boundaries

- Renderer code cannot directly access Node, the filesystem, SQLite, or
  `ipcRenderer`.
- Imports are staged before parsing or installation.
- Paths are canonicalized before root-boundary decisions.
- Agent directories are projections; SQLite records the app-owned files.
- Security scans run before install writes.
- High and critical findings block installs unless a scoped exemption exists.
- Sync and plugins are disabled by default.
- Plugins register capabilities through a restricted host API and require
  explicit permission authorization before enabling.

## Initial Ruleset

The Phase 5 ruleset scans skill files for:

- dangerous shell commands
- external data transfer
- sensitive file reads
- path traversal references
- executable scripts
- oversized files

The scanner records findings and a score in SQLite. Batch rescans update the
same skill-version and ruleset record instead of producing duplicate history
noise.

## Exemptions

Exemptions are scoped to a skill and install scope. Each exemption records a
reason and creation timestamp. Revoking an exemption immediately makes the
policy evaluate the skill normally again.

## Security Center Actions

The renderer exposes security operations through typed preload IPC only:

- rescan one selected skill or all indexed skills
- view finding detail for a skill, scan, or rule
- create a scoped exemption with a reason
- revoke an exemption
- show high and critical block reasons before an install writes files

Repeated scans for the same skill version and ruleset update the existing scan
record, so history stays readable while the latest policy result remains
auditable.

## Limitations

Security scanning is pattern-based. It can miss obfuscated or novel behavior,
and it cannot prevent a trusted agent from executing installed skill content.
The Phase 8 plugin host reduces exposed APIs and blocks obvious escape patterns,
but it is not a complete sandbox for arbitrary untrusted JavaScript. Users and
maintainers should treat scan results and plugin host checks as governance
signals, not as runtime containment guarantees.
