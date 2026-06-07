import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('release readiness', () => {
  it('defines desktop packaging, checksum, inventory, and smoke scripts', async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(rootDirectory, 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['assets:icons']).toContain('scripts/generate-icons.mjs');
    expect(packageJson.scripts['package:desktop']).toContain('pnpm assets:icons');
    expect(packageJson.scripts['package:desktop']).toContain('scripts/package-desktop.mjs');
    expect(packageJson.scripts['release:checksums']).toContain('scripts/generate-checksums.mjs');
    expect(packageJson.scripts['release:inventory']).toContain(
      'scripts/generate-dependency-inventory.mjs'
    );
    expect(packageJson.scripts['release:smoke']).toContain('scripts/release-smoke.mjs');
  });

  it('configures packaging targets for macOS, Windows, and Linux', async () => {
    const config = JSON.parse(
      await readFile(path.join(rootDirectory, 'config/desktop-packaging.json'), 'utf8')
    ) as {
      productName: string;
      appId: string;
      targets: Record<string, { formats: string[] }>;
    };

    expect(config.productName).toBe('OpenHub');
    expect(config.appId).toBe('io.openhub.desktop');
    expect(config.targets.darwin?.formats ?? []).toContain('dmg');
    expect(config.targets.win32?.formats ?? []).toContain('nsis');
    expect(config.targets.linux?.formats ?? []).toContain('AppImage');
  });

  it('writes release package metadata without workspace protocol dependencies', async () => {
    const packageScript = await readFile(path.join(rootDirectory, 'scripts/package-desktop.mjs'), 'utf8');
    const nativeRuntimeScript = await readFile(path.join(rootDirectory, 'scripts/electron-native-runtime.mjs'), 'utf8');

    expect(packageScript).toContain('runtimeExternalDependencies');
    expect(packageScript).toContain('better-sqlite3');
    expect(packageScript).toContain('copyRuntimeExternalDependencies');
    expect(packageScript).toContain('installElectronNativeRuntime');
    expect(packageScript).toContain('credentialStorage');
    expect(packageScript).toContain('os-keychain-required');
    expect(nativeRuntimeScript).toContain('prebuild-install');
    expect(packageScript).toContain('createDarwinAppBundle');
    expect(packageScript).toContain('CFBundleDisplayName');
    expect(packageScript).toContain('iconutil');
    expect(packageScript).not.toContain('dependencies: desktopPackage.dependencies');
  });

  it('prepares Electron native dependencies for the dev desktop runtime', async () => {
    const devScript = await readFile(path.join(rootDirectory, 'apps/desktop/scripts/dev.mjs'), 'utf8');

    expect(devScript).toContain('prepareDevElectronNativeRuntime');
    expect(devScript).toContain('better-sqlite3');
    expect(devScript).toContain('OPENHUB_REMOTE_DEBUGGING_PORT');
  });

  it('includes desktop runtime IPC coverage in release smoke tests', async () => {
    const smokeScript = await readFile(path.join(rootDirectory, 'scripts/release-smoke.mjs'), 'utf8');

    expect(smokeScript).toContain('apps/desktop/src/main/desktop-runtime.test.ts');
    expect(smokeScript).toContain('apps/desktop/src/renderer/App.test.tsx');
    expect(smokeScript).toContain('desktop_runtime=verified');
    expect(smokeScript).toContain('root_detection=verified');
    expect(smokeScript).toContain('credential_store_boundary=verified');
    expect(smokeScript).toContain('sync_disabled_default=verified');
    expect(smokeScript).toContain('plugin_disabled_default=verified');
    expect(smokeScript).toContain('advanced_import=verified');
    expect(smokeScript).toContain('skills_flow=verified');
    expect(smokeScript).not.toContain('first_launch_wizard=verified');
    expect(smokeScript).not.toContain('inventory_flow=verified');
    expect(smokeScript).not.toContain('policy_baseline=verified');
    expect(smokeScript).toContain('plugin_provider_workflows=verified');
    expect(smokeScript).toContain('runPackagedStartupSmoke');
    expect(smokeScript).toContain('runPackagedWindowSmoke');
    expect(smokeScript).toContain('--release-smoke');
    expect(smokeScript).toContain('--window-smoke');
    expect(smokeScript).toContain('ELECTRON_RUN_AS_NODE');
    expect(smokeScript).toContain('package_startup=verified');
    expect(smokeScript).toContain('package_window=verified');
  });

  it('runs checksum and inventory generation in CI after package smoke', async () => {
    const ci = await readFile(path.join(rootDirectory, '.github/workflows/ci.yml'), 'utf8');

    expect(ci).toContain('pnpm package:desktop');
    expect(ci).toContain('pnpm release:smoke');
    expect(ci).toContain('pnpm release:checksums');
    expect(ci).toContain('pnpm release:inventory');
    expect(ci.indexOf('pnpm release:checksums')).toBeGreaterThan(ci.indexOf('pnpm release:smoke'));
  });

  it('documents unsigned local packages separately from signed public installers', async () => {
    const release = await readFile(path.join(rootDirectory, 'docs/release.md'), 'utf8');

    expect(release).toContain('Unsigned local package');
    expect(release).toContain('Signed public installer');
    expect(release).toContain('Public release is blocked until signing and notarization status is recorded');
  });

  it('uses relative renderer assets for packaged file URLs', async () => {
    const rendererConfig = await readFile(
      path.join(rootDirectory, 'apps/desktop/vite.renderer.config.ts'),
      'utf8'
    );

    expect(rendererConfig).toContain("base: './'");
  });

  it('keeps community health files and 15-minute quick start visible', async () => {
    for (const filePath of [
      'LICENSE',
      'CODE_OF_CONDUCT.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'GOVERNANCE.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      '.github/ISSUE_TEMPLATE/feature_request.yml',
      '.github/SUPPORT.md'
    ]) {
      await expect(access(path.join(rootDirectory, filePath))).resolves.toBeUndefined();
    }

    const readme = await readFile(path.join(rootDirectory, 'README.md'), 'utf8');
    expect(readme).toContain('## Quick Start');
    expect(readme).toContain('pnpm install');
    expect(readme).toContain('pnpm dev');
    expect(readme).toContain('pnpm test');
    expect(readme).toContain('pnpm package:desktop');
    expect(readme).toContain('pnpm release:checksums');
  });
});
