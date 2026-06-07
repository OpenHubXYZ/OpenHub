import { mkdir, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createCollectionService } from './collection-service';

const tempDirectories: string[] = [];

describe('collection service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('creates local inventory collections without export package APIs', async () => {
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
      description: 'Two indexed skills',
      skillIds: [skillA.skill.id, skillB.skill.id]
    });

    expect(collection).toMatchObject({ name: 'Starter Pack', description: 'Two indexed skills' });
    expect('exportCollection' in collections).toBe(false);
    expect('importCollection' in collections).toBe(false);
    expect(countRows(database, 'collections')).toBe(1);
    expect(countRows(database, 'collection_items')).toBe(2);
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

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
