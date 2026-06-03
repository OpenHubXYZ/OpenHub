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
- Run package smoke tests on the current platform.
- Verify database migrations from empty and previous supported versions.
- Verify first launch and Phase 4 import/install/uninstall smoke flow.
- Verify optional sync remains disabled until a profile is enabled.
- Verify plugins remain disabled until permissions are authorized and the plugin
  is enabled.
- Review logs for tokens, full skill contents, and sensitive paths.
- Update `CHANGELOG.md`.
- Generate checksums for release artifacts.
- Publish dependency inventory or SBOM.
- Confirm signing and notarization status for each platform.
- Document rollback steps.

## Packaging Targets

Planned targets:

- macOS
- Windows
- Linux

Release artifacts must be reproducible from committed source, lockfile, and CI
configuration.

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
