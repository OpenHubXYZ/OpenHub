# Dependency Policy

Dependency changes require a risk note and verification evidence.

## Required Risk Note

- Why the dependency is needed.
- Whether it runs in renderer, main process, core service, build tooling, tests,
  or release tooling.
- Security and maintenance risk.
- Bundle, native install, or platform impact.
- Replacement or removal plan if the dependency becomes unmaintained.

## Verification

Run:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:desktop
pnpm release:smoke
```

Native dependencies must be listed in `package.json#pnpm.onlyBuiltDependencies`
and justified in the pull request.

## Updates

- Patch updates can be batched when tests pass.
- Minor updates need a changelog note when behavior or release output changes.
- Major updates need a maintainer review and, when architecture changes, an ADR.
