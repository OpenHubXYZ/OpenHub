# Repository Guidelines

## Project Structure & Module Organization
This repository is currently in the planning stage. The only project-specific material lives under `references/`, which contains the research report and the Electron + React + Node + SQLite development plan. Treat those files as planning inputs, not runtime code.

When implementation begins, follow the planned pnpm TypeScript workspace layout:
- `apps/desktop`: Electron main process, Vite/React renderer, preload IPC.
- `packages/core`: domain services for skills, versions, imports, installs, and security.
- `packages/db`: SQLite schema, migrations, and data access.
- `packages/adapters`: Codex, Claude, Gemini, OpenCode, and other agent adapters.
- `packages/shared`: shared types, IPC contracts, validators, and constants.

## Build, Test, and Development Commands
No executable project scripts are checked in yet. Do not report build, test, or app verification until `package.json` and workspace config exist. Once the scaffold lands, standardize these commands:
- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run the Electron desktop app in development mode.
- `pnpm build`: build all workspace packages and desktop bundles.
- `pnpm test`: run unit and integration tests.
- `pnpm lint` / `pnpm typecheck`: enforce style and TypeScript contracts.

## Coding Style & Naming Conventions
Use TypeScript for app and package code. Prefer strict types, explicit IPC payload schemas, and small modules with domain-oriented names. Use 2-space indentation for TypeScript, React, JSON, and Markdown. Name React components in `PascalCase`, hooks as `useThing`, services as `thing-service.ts`, and tests as `*.test.ts` or `*.test.tsx`.

## Testing Guidelines
Planned coverage should include unit tests for `SKILL.md` parsing, migrations, path sanitization, adapter rules, diff logic, security rules, and IPC validation. Add integration tests for local/Git/ZIP imports, install/uninstall, rollback, export/import, and large skill indexing. Add E2E coverage for first launch, agent detection, import, security blocking, installation scope, and sync conflicts.

## Commit & Pull Request Guidelines
This repository has no commit history yet, so use Conventional Commits from the first implementation commit, for example `feat: scaffold desktop workspace` or `test: cover path sanitizer`. Pull requests should include scope, verification commands, screenshots for UI changes, linked issue/spec references, and any security or migration impact.

## Security & Configuration Tips
Keep the app local-first by default. Renderer code must not access Node or the filesystem directly; route privileged work through typed preload IPC. Canonicalize paths, isolate ZIP/Git imports before installation, store secrets only in the OS keychain, and keep SQLite as the local source of truth.
