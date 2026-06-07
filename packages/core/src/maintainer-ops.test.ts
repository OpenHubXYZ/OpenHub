import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('maintainer operations', () => {
  it('keeps ADR template and required architecture decisions', async () => {
    for (const adrPath of [
      'docs/adr/000-template.md',
      'docs/adr/001-electron-react-node-sqlite.md',
      'docs/adr/002-sqlite-source-of-truth.md',
      'docs/adr/003-sync-disabled-by-default.md',
      'docs/adr/004-plugin-permissions.md'
    ]) {
      await expect(access(path.join(rootDirectory, adrPath))).resolves.toBeUndefined();
    }

    expect(await readFileText('docs/adr/001-electron-react-node-sqlite.md')).toContain('Electron');
    expect(await readFileText('docs/adr/002-sqlite-source-of-truth.md')).toContain('SQLite');
    expect(await readFileText('docs/adr/003-sync-disabled-by-default.md')).toContain('disabled by default');
    expect(await readFileText('docs/adr/004-plugin-permissions.md')).toContain('explicit permission');
  });

  it('documents maintainer triage, release, security, dependency, fixture, and roadmap workflows', async () => {
    const requiredDocs = [
      'docs/maintainer-guide.md',
      'docs/triage-policy.md',
      'docs/issue-labels.md',
      'docs/dependency-policy.md',
      'docs/security-response-playbook.md',
      'docs/fixture-contribution.md',
      'docs/roadmap-workflow.md'
    ];

    for (const docPath of requiredDocs) {
      await expect(access(path.join(rootDirectory, docPath))).resolves.toBeUndefined();
    }

    expect(await readFileText('docs/maintainer-guide.md')).toContain('security intake');
    expect(await readFileText('docs/triage-policy.md')).toContain('priority:p0');
    expect(await readFileText('docs/dependency-policy.md')).toContain('risk note');
    expect(await readFileText('docs/security-response-playbook.md')).toContain('private vulnerability');
    expect(await readFileText('docs/fixture-contribution.md')).toContain('synthetic');
    expect(await readFileText('docs/roadmap-workflow.md')).toContain('public roadmap');
  });

  it('teaches contributors how to add extension points and keeps CI release gates visible', async () => {
    const recipes = await readFileText('docs/contributor-recipes.md');
    expect(recipes).toContain('Add an adapter');
    expect(recipes).toContain('Add an importer');
    expect(recipes).toContain('Add a sync driver');
    expect(recipes).toContain('Add a fixture');

    const ci = await readFileText('.github/workflows/ci.yml');
    expect(ci).toContain('pnpm package:desktop');
    expect(ci).toContain('pnpm release:smoke');
  });
});

async function readFileText(relativePath: string): Promise<string> {
  return readFile(path.join(rootDirectory, relativePath), 'utf8');
}
