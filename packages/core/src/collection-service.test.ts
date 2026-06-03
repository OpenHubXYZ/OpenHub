import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createCollectionService } from './collection-service';
import { createContentStore } from './content-store';
import { createImportService } from './import-service';

const tempDirectories: string[] = [];

describe('collection service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('batch-exports a collection and imports it into a fresh database', async () => {
    const workspace = await tempDir();
    const sourceA = await createSkillFixture(path.join(workspace, 'source-a'), 'collection-a');
    const sourceB = await createSkillFixture(path.join(workspace, 'source-b'), 'collection-b');
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const importer = createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    });
    const skillA = await importer.importLocalFolder({ folderPath: sourceA });
    const skillB = await importer.importLocalFolder({ folderPath: sourceB });
    const collections = createCollectionService({ database, contentStore });
    const collection = collections.createCollection({
      name: 'Starter Pack',
      description: 'Two safe skills',
      skillIds: [skillA.skill.id, skillB.skill.id]
    });
    const packageDirectory = path.join(workspace, 'starter-pack');

    const exported = await collections.exportCollection({
      collectionId: collection.id,
      outputDirectory: packageDirectory
    });

    const manifest = JSON.parse(await readFile(path.join(exported.outputDirectory, 'manifest.json'), 'utf8'));
    expect(manifest.skills.map((skill: { name: string }) => skill.name)).toEqual([
      'collection-a',
      'collection-b'
    ]);

    const importedDatabase = createMemoryDatabase();
    runMigrations(importedDatabase);
    const importedCollection = await createCollectionService({
      database: importedDatabase,
      contentStore: createContentStore(path.join(workspace, 'imported-blobs'))
    }).importCollection({ packageDirectory });

    expect(importedCollection.collection.name).toBe('Starter Pack');
    expect(importedCollection.skills.map((skill) => skill.name)).toEqual(['collection-a', 'collection-b']);
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-collection-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(directory: string, name: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${name}`, '---', `# ${name}`].join('\n')
  );
  return directory;
}
