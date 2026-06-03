# Security Policy

TheOpenHub Skills Studio manages local skill files that may contain sensitive
workflow details. Security and privacy are product requirements, not add-ons.

## Privacy Rule

The project does not collect skill contents. Skill text, file contents, local
paths, tokens, credentials, and agent configuration stay on the user's machine
by default. Any future network feature must be explicit, opt-in, documented,
and testable.

## Reporting Vulnerabilities

Please do not open public issues for vulnerabilities that expose private data,
path traversal, credential handling, install bypasses, plugin escapes, or
security scan bypasses.

Use the private vulnerability reporting channel on GitHub if available for this
repository. If it is not enabled yet, email the maintainers listed in
`GOVERNANCE.md` with:

- Affected version or commit.
- Steps to reproduce.
- Expected and actual impact.
- Any proof of concept, redacted where needed.
- Whether the issue is already public.

Maintainers should acknowledge receipt within 5 business days and provide a
triage result or status update within 10 business days.

## Supported Versions

No released versions exist yet. Before the first public release, security fixes
apply to the default branch.

## Security Boundaries

- Renderer code must not directly access Node, the filesystem, or SQLite.
- Privileged work must go through typed preload IPC and main-process services.
- Imported folders, Git repositories, and archives must be staged in isolated
  temporary directories before installation.
- Paths must be canonicalized and checked against target boundaries.
- ZIP slip, path traversal, and symlink escape attempts must be rejected.
- Credentials must be stored in the operating system keychain, not SQLite,
  localStorage, plain JSON, or logs.
- Sync and plugins must be disabled by default.
- Sync profiles must not upload skill contents unless the user explicitly
  enables a profile and chooses a remote. Remote authentication references must
  point to keychain-backed credentials when implemented.
- Plugins must declare capabilities and permissions, pass entry integrity
  checks, and receive explicit authorization before enabling.
- Plugin entries must not receive filesystem, network, shell, process, or
  SQLite APIs through the host. The Phase 8 host is a constrained governance
  boundary, not a complete sandbox for arbitrary untrusted JavaScript.
- Logs must redact secrets, full skill contents, and sensitive path fragments.

## Security Scanning Limits

The Security Center can identify risky patterns and block high-risk installs,
but it is not an execution sandbox guarantee. Users should still review skills
before installing them into agent environments.

The initial ruleset checks for dangerous shell commands, external data
transfer, sensitive file reads, path traversal references, executable scripts,
and oversized files. Low- and medium-risk findings are warnings. High and
critical findings block install by default unless a scoped exemption with a
reason is active.
