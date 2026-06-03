# Release

The project has no public release yet. This document defines the release
standard the project should meet before OSS launch.

## Versioning

Use semantic versioning after the first release:

- Patch: compatible bug fix.
- Minor: compatible feature.
- Major: breaking public contract, migration, plugin API, or storage change.

## Release Checklist

Before a release:

- Verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Run `pnpm package:desktop` and `pnpm release:smoke` on the current platform.
- Verify database migrations from empty and previous supported versions.
- Verify first launch and Phase 4 import/install/uninstall smoke flow.
- Verify optional sync remains disabled until a profile is enabled.
- Verify plugins remain disabled until permissions are authorized and the plugin
  is enabled.
- Review `out/release/*.log` for tokens, full skill contents, and sensitive
  paths.
- Update `CHANGELOG.md`.
- Generate checksums with `pnpm release:checksums`.
- Publish dependency inventory with `pnpm release:inventory` or replace it with
  a fuller SBOM before public release.
- Confirm signing and notarization status for each platform.
- Document rollback steps.

## Packaging Targets

Planned targets:

- macOS: unpacked directory and DMG target metadata.
- Windows: unpacked directory and NSIS target metadata.
- Linux: unpacked directory, AppImage, and deb target metadata.

Release artifacts must be reproducible from committed source, lockfile, and CI
configuration.

The current Phase 9 package script produces a reproducible unpacked payload
under `out/packages/` for the current platform. Public native installers still
require signing/notarization credentials and platform-specific CI before a
published release.

## Privacy Checks

Release validation must confirm:

- no telemetry is enabled by default
- no sync profile is created automatically
- no plugin is enabled automatically
- no skill contents are uploaded
- crash or diagnostic logs are redacted
- credentials use OS keychain storage

## Rollback

Every release should include:

- previous version download link
- migration rollback notes or forward-fix plan
- known incompatible data changes
- support window for security fixes

## Phase 9 Commands

```sh
pnpm package:desktop
pnpm release:smoke
pnpm release:checksums
pnpm release:inventory
```

Generated artifacts stay under ignored `out/` paths:

- `out/packages/`: current-platform unpacked package payload.
- `out/release/checksums-*.sha256`: release checksum file.
- `out/release/dependency-inventory.json`: workspace dependency inventory.
- `out/release/release-smoke-*.log`: redacted smoke summary.
