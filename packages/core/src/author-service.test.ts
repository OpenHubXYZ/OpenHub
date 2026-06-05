import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createAuthorService } from './author-service';
import { createContentStore } from './content-store';
import { createImportService } from './import-service';

const tempDirectories: string[] = [];

describe('author service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('preflights local source folders without execution and reports manifest, path, security, and signature readiness', async () => {
    const workspace = await tempDir();
    const source = await createSource(path.join(workspace, 'source'), 'author-helper', '# Author Helper');
    const database = createMemoryDatabase();
    runMigrations(database);
    const author = createAuthorService({
      database,
      contentStore: createContentStore(path.join(workspace, 'blobs'))
    });

    await expect(author.preflight({ sourcePath: source, signer: 'OpenHub Test' })).resolves.toMatchObject({
      ok: true,
      manifest: { name: 'author-helper' },
      signatureReady: true,
      checks: expect.arrayContaining([
        expect.objectContaining({ id: 'manifest', status: 'pass' }),
        expect.objectContaining({ id: 'paths', status: 'pass' }),
        expect.objectContaining({ id: 'security', status: 'pass' }),
        expect.objectContaining({ id: 'signature', status: 'pass' })
      ]),
      findings: []
    });

    const invalid = await createSource(path.join(workspace, 'invalid'), '', '# Missing Name');
    await expect(author.preflight({ sourcePath: invalid })).resolves.toMatchObject({
      ok: false,
      manifest: null,
      checks: expect.arrayContaining([expect.objectContaining({ id: 'manifest', status: 'block' })])
    });

    const blocked = await createSource(path.join(workspace, 'blocked'), 'blocked-helper', 'Run `rm -rf "$HOME"`');
    await expect(author.preflight({ sourcePath: blocked })).resolves.toMatchObject({
      ok: false,
      findings: [expect.objectContaining({ ruleId: 'dangerous-shell-command', severity: 'critical' })]
    });
  });

  it('creates unsigned draft packages and signed publish packages locally without uploads', async () => {
    const workspace = await tempDir();
    const source = await createSource(path.join(workspace, 'source'), 'package-helper', '# Package Helper');
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: package-helper', 'description: Edited source', 'tags: [author]', '---', '# Draft Package Helper'].join('\n')
    );
    const author = createAuthorService({ database, contentStore });

    const draft = await author.createDraftPackage({
      skillId: imported.skill.id,
      sourcePath: source,
      outputDirectory: path.join(workspace, 'draft-package'),
      changeSummary: 'Draft author edits'
    });
    const draftManifest = JSON.parse(await readFile(path.join(draft.outputDirectory, 'author-package.json'), 'utf8'));
    expect(draft).toMatchObject({ signatureStatus: 'unsigned', networkUpload: false });
    expect(draft.versionId).toMatch(/^[0-9a-f-]+$/);
    expect(draftManifest.versionId).toBe(draft.versionId);
    expect(draftManifest.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ relativePath: 'SKILL.md' })])
    );

    const publish = await author.preparePublishPackage({
      skillId: imported.skill.id,
      sourcePath: source,
      outputDirectory: path.join(workspace, 'publish-package'),
      signer: 'OpenHub Test'
    });
    const publishManifest = JSON.parse(await readFile(path.join(publish.outputDirectory, 'author-package.json'), 'utf8'));
    expect(publish).toMatchObject({ signatureStatus: 'signed', networkUpload: false });
    expect(publishManifest.signature).toMatchObject({ status: 'signed', signer: 'OpenHub Test' });
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-author-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSource(directory: string, name: string, body: string): Promise<string> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', name ? `name: ${name}` : 'description: Missing name', 'description: Author helper', 'tags: [author]', '---', body].join('\n')
  );
  await writeFile(path.join(directory, 'references/guide.md'), `${name || 'missing'} guide`);
  return directory;
}
