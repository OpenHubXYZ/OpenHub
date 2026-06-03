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

    expect(config.productName).toBe('TheOpenHub Skills Studio');
    expect(config.appId).toBe('io.theopenhub.skills-studio');
    expect(config.targets.darwin?.formats ?? []).toContain('dmg');
    expect(config.targets.win32?.formats ?? []).toContain('nsis');
    expect(config.targets.linux?.formats ?? []).toContain('AppImage');
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
  });
});
