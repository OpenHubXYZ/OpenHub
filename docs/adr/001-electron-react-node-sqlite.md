# ADR 001: Electron React Node SQLite

Status: accepted

## Context

The product needs a local desktop shell, a typed UI, privileged filesystem and
Git operations, and a durable local database. The planning references compare
Electron and Tauri; the first open-source implementation needs the fastest
path to a TypeScript workspace with mature desktop tooling.

## Decision

Use Electron for the desktop shell, React and Vite for the renderer, Node for
privileged main-process services, and SQLite for local persistence.

## Consequences

Renderer code must remain unprivileged with `contextIsolation`, no direct Node
integration, and typed preload IPC. Native packaging and signing remain release
work, while development benefits from a single TypeScript toolchain.

## Verification

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm package:desktop`, and `pnpm release:smoke`.
