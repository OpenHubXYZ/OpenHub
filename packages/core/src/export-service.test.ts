import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createExportService } from './export-service';
import { createImportService } from './import-service';

const tempDirectories: string[] = [];

describe('export service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('exports a portable package containing manifest, files, and hashes', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'theopenhub-export-'));
    tempDirectories.push(workspace);
    const source = path.join(workspace, 'source');
    await mkdir(source, { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: export-helper', 'description: Export helper', '---', '# Export Helper'].join('\n')
    );

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const exportDirectory = path.join(workspace, 'package');

    const result = await createExportService({ database, contentStore }).exportSkill({
      skillId: imported.skill.id,
      outputDirectory: exportDirectory
    });

    const manifest = JSON.parse(await readFile(path.join(result.outputDirectory, 'manifest.json'), 'utf8'));
    expect(manifest.name).toBe('export-helper');
    expect(manifest.files).toEqual([
      expect.objectContaining({
        relativePath: 'SKILL.md',
        hash: expect.stringMatching(/^[a-f0-9]{64}$/)
      })
    ]);
    await expect(readFile(path.join(result.outputDirectory, 'files/SKILL.md'), 'utf8')).resolves.toContain(
      'Export Helper'
    );
  });
});
