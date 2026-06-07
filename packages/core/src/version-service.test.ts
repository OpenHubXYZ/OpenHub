import { mkdir, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createVersionService } from './version-service';

const tempDirectories: string[] = [];

describe('version service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('dedupes blobs, creates versions, and compares file history without deploy state', async () => {
    const workspace = await tempDir();
    const source = path.join(workspace, 'source');
    await mkdir(path.join(source, 'references'), { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: history-helper', 'description: History helper', '---', '# Version One'].join('\n')
    );
    await writeFile(path.join(source, 'references/a.txt'), 'same body');
    await writeFile(path.join(source, 'references/b.txt'), 'same body');

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const versions = createVersionService({ database, contentStore });

    expect(countRows(database, 'blob_objects')).toBe(2);

    const versionTwo = await versions.createVersion({
      skillId: imported.skill.id,
      changeSummary: 'Change manifest and add guide',
      files: [
        {
          relativePath: 'SKILL.md',
          content: ['---', 'name: history-helper', 'description: History helper', '---', '# Version Two'].join(
            '\n'
          )
        },
        { relativePath: 'references/a.txt', content: 'same body' },
        { relativePath: 'references/new.txt', content: 'new body' }
      ]
    });

    expect(versionTwo.versionNo).toBe(2);
    expect(versions.listVersions({ skillId: imported.skill.id }).map((version) => version.versionNo)).toEqual([
      2,
      1
    ]);
    expect(
      versions.diffVersions({
        fromVersionId: imported.skill.versionId,
        toVersionId: versionTwo.versionId
      })
    ).toEqual([
      expect.objectContaining({ relativePath: 'SKILL.md', changeType: 'modified' }),
      expect.objectContaining({ relativePath: 'references/b.txt', changeType: 'deleted' }),
      expect.objectContaining({ relativePath: 'references/new.txt', changeType: 'added' })
    ]);
    expect('lifecycle' in versionTwo).toBe(false);
    expect('releaseChannel' in versionTwo).toBe(false);
    expect(versions.compareVersions({
      fromVersionId: imported.skill.versionId,
      toVersionId: versionTwo.versionId
    })).toMatchObject({
      fromVersionId: imported.skill.versionId,
      toVersionId: versionTwo.versionId,
      manifestHashChanged: true,
      files: expect.arrayContaining([
        expect.objectContaining({ relativePath: 'SKILL.md', changeType: 'modified' }),
        expect.objectContaining({ relativePath: 'references/b.txt', changeType: 'deleted' }),
        expect.objectContaining({ relativePath: 'references/new.txt', changeType: 'added' })
      ])
    });
  });

  it('creates additional skill versions without promotion or rollback APIs', async () => {
    const workspace = await tempDir();
    const source = path.join(workspace, 'source-followup');
    await mkdir(source, { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: channel-helper', 'description: Channel helper', '---', '# Original'].join('\n')
    );
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const versions = createVersionService({ database, contentStore });

    const followup = await versions.createVersion({
      skillId: imported.skill.id,
      changeSummary: 'Follow-up update',
      files: [
        { relativePath: 'SKILL.md', content: '# Follow-up' },
        { relativePath: 'references/followup.md', content: 'follow-up notes' }
      ]
    });
    const comparison = versions.compareVersions({
      fromVersionId: imported.skill.versionId,
      toVersionId: followup.versionId
    });

    expect(followup.versionNo).toBe(2);
    expect('promoteVersion' in versions).toBe(false);
    expect('rollbackInstallation' in versions).toBe(false);
    expect(comparison).toMatchObject({
      fromVersionId: imported.skill.versionId,
      toVersionId: followup.versionId,
      manifestHashChanged: true,
      files: expect.arrayContaining([
        expect.objectContaining({ relativePath: 'SKILL.md', changeType: 'modified' }),
        expect.objectContaining({ relativePath: 'references/followup.md', changeType: 'added' })
      ])
    });
    expect(versions.listVersions({ skillId: imported.skill.id })[0]).toMatchObject({
      versionNo: 2,
      changeSummary: 'Follow-up update'
    });
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-version-'));
  tempDirectories.push(directory);
  return directory;
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
