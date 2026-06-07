# Security Model

OpenHub is a local-first skills inventory. Its security model protects local
data, renderer privileges, import staging, optional sync, and plugin execution.
It does not include a Trust Center, source reputation score, security scan
queue, or deploy-time blocking workflow.

## Boundaries

- Renderer code cannot directly access Node, the filesystem, SQLite, or
  `ipcRenderer`.
- Privileged work goes through typed preload IPC and main-process services.
- Imports are staged before parsing.
- Paths are canonicalized before root-boundary decisions.
- ZIP slip, path traversal, and symlink escape attempts are rejected.
- Agent directories are read-only inventory inputs in the current runtime.
- Sync and plugins are disabled by default.
- Plugins register capabilities through a restricted host API and require
  explicit permission authorization before enabling.
- Logs must redact secrets, full skill contents, and sensitive path fragments.

## Import Safety

Local folders, Git repositories, and ZIP archives are copied or extracted into
isolated staging directories before `SKILL.md` parsing and content-store writes.
Only canonical paths inside the staged root can be imported.

The content-addressed store records imported file bytes by hash, and SQLite
stores skill metadata, versions, file records, indexed locations, source
previews, sync state, and plugin state.

## Plugin Limits

The plugin host exposes registration methods only for declared capabilities. It
does not provide filesystem, network, shell, process, or SQLite APIs to plugin
entry code. Source preflight blocks obvious escape patterns, but this is not a
complete JavaScript sandbox.

## Limitations

OpenHub does not decide whether a skill is safe to run inside an external agent.
Users and maintainers should inspect skill content directly before relying on
it. Any future scanner, source reputation system, or deploy workflow requires a
new accepted spec and tests before implementation.
