# Testing

Testing follows the roadmap phases. Phase 1 introduces the baseline command
gates and shell contract tests.

## Phase 0 Checks

```sh
git status --short --untracked-files=all
```

Expected evidence:

- `references/*.md` are trackable.
- Open-source files are visible.
- No product source code is included.

## Phase 1 Command Gates

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI must run the same gates.

## Phase 1 Contract Coverage

- Electron `BrowserWindow` options keep `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true`.
- The renderer shell displays the product name and empty library state.
- The shared IPC contract validates the `app.info` channel and rejects unknown
  channels.
- Static renderer search must not find direct Node, filesystem, SQLite, or
  `ipcRenderer` access.

## Phase 2 Database Coverage

- Migrations run from empty database to latest and are idempotent.
- Required domain tables and the `skill_search` FTS5 table exist.
- Repository tests cover create, list, update, FTS search, and delete.
- Test data uses `:memory:` SQLite databases.
- App data directory tests inject fake home paths and do not touch real user
  directories.

## Phase 3 Library Indexing Coverage

- Fixture roots for `.codex/skills`, `.claude/skills`, `.gemini/skills`, and
  `.opencode/skills` scan successfully.
- Missing `SKILL.md` and malformed metadata produce explainable scan errors.
- Indexed library rows preserve skill name, source agent, path, and install
  status.
- IPC contract tests cover `library.list`.
- Renderer tests cover both empty and indexed library states.

## Unit Test Targets

- `SKILL.md` parser.
- SQLite migrations.
- Repository create, list, update, search, and delete behavior.
- Path sanitizer.
- Agent adapter rules.
- Diff engine.
- Security rules.
- IPC payload validation.
- Plugin manifest validation.

## Integration Test Targets

- Fixture root scanning for Codex, Claude, Gemini, and OpenCode.
- Local folder import.
- Git import.
- ZIP import.
- Install and uninstall safety.
- Export and re-import.
- Rollback.
- Large skill indexing.

## E2E And Smoke Targets

- First launch.
- Agent detection.
- Import a skill.
- Security scan blocks a high-risk skill.
- Install to personal and project scopes.
- Resolve a sync conflict after sync exists.
- Packaged app starts and completes the Phase 4 core flow.

## Security Fixtures

Security tests must cover:

- path traversal
- symlink escape
- ZIP slip
- command injection patterns
- sensitive file reads
- token redaction
- renderer no direct Node, filesystem, or SQLite access
