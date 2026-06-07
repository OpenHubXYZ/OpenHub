# Release

The project has no public release yet. This document defines the release
standard the project should meet before OSS launch.

## Versioning

Use semantic versioning after the first release:

- Patch: compatible bug fix.
- Minor: compatible feature.
- Major: breaking public contract, schema migration, plugin API, or storage
  change.

## Release Checklist

Before a release:

- Verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Run `pnpm package:desktop` and `pnpm release:smoke` on the current platform.
- Verify packaged main startup under the Electron runtime.
- Verify database migrations from empty and previous supported versions.
- Verify first launch root detection, `Open workspace`, root scan, and ordinary
  import paths.
- Verify local/Git/ZIP import, FTS search, skills flow, Marketplace source
  preview, install plan/apply/uninstall behavior, and version diff/compare
  behavior.
- Verify optional sync remains disabled until a profile is enabled.
- Verify sync credentials use OS-backed credential storage and release logs do
  not contain credential material.
- Verify sync conflicts remain explicit and require confirmation before apply.
- Verify plugins remain disabled until permissions are authorized and the plugin
  is enabled.
- Verify enabled plugin providers appear only in the workflows they are
  authorized for, and disabling a plugin removes those capabilities.
- Review `out/release/*.log` for tokens, full skill contents, and sensitive
  paths.
- Update `CHANGELOG.md`.
- Generate checksums with `pnpm release:checksums`.
- Publish dependency inventory with `pnpm release:inventory` or replace it with
  a fuller SBOM before public release.
- Confirm signing and notarization status for each platform.
- Document rollback steps.
- Confirm roadmap, ADR, maintainer guide, and security response docs are
  current.

## Packaging Targets

Planned targets:

- macOS: unpacked directory and DMG target metadata.
- Windows: unpacked directory and NSIS target metadata.
- Linux: unpacked directory, AppImage, and deb target metadata.

Release artifacts must be reproducible from committed source, lockfile, and CI
configuration.

The current package script produces a reproducible unpacked payload under
`out/packages/` for the current platform. It copies runtime external
dependencies and installs the Electron ABI native SQLite runtime before writing
checksums. Public native installers still require signing/notarization
credentials and platform-specific CI before a published release.

The release manifest records runtime boundaries for SQLite source-of-truth,
renderer privilege isolation, OS-backed credential storage, sync-disabled
default, and plugin-disabled default. Release smoke rejects packages that weaken
those boundaries.

## Signing Status

Unsigned local package: `pnpm package:desktop` produces a current-platform
unpacked package for local validation and smoke testing. It is not a public
installer and must not be represented as signed.

Signed public installer: DMG, NSIS, AppImage, deb, or other public installer
artifacts require platform signing and, on macOS, notarization records before
publication.

Public release is blocked until signing and notarization status is recorded for
the target platform.

## Privacy Checks

Release validation must confirm:

- no telemetry is enabled by default
- no sync profile is created automatically
- no plugin is enabled automatically
- no skill contents are uploaded
- crash or diagnostic logs are redacted
- credentials use OS keychain storage
- renderer code has no direct Node, filesystem, SQLite, or `ipcRenderer` access
- root writes happen only through explicit copy/symlink install plans
- uninstall removes only files recorded as app-owned installation files
- source preview does not expose ratings, reputation, trust levels, or risk
  scores

## Rollback

Every release should include:

- previous version download link
- schema migration rollback notes or forward-fix plan
- known incompatible data changes
- support window for security fixes

## Maintainer Handoff

Before a public release, maintainers should also review:

- `docs/maintainer-guide.md`
- `docs/security-response-playbook.md`
- `docs/dependency-policy.md`
- `docs/roadmap-workflow.md`
- accepted ADRs under `docs/adr/`

## Release Commands

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
