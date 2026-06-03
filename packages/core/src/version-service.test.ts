import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createInstallService } from './install-service';
import { createVersionService } from './version-service';

const tempDirectories: string[] = [];

describe('version service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('dedupes blobs, creates versions, diffs file changes, and rolls back an installation', async () => {
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

    const installer = createInstallService({ database, contentStore });
    const targetRoot = path.join(workspace, 'target-agent');
    const plan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });
    const install = await installer.applyInstallPlan(plan);
    await expect(readFile(path.join(targetRoot, 'history-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'Version Two'
    );

    await versions.rollbackInstallation({
      installationId: install.installationId,
      targetVersionId: imported.skill.versionId
    });

    await expect(readFile(path.join(targetRoot, 'history-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'Version One'
    );
    await expect(stat(path.join(targetRoot, 'history-helper/references/new.txt'))).rejects.toMatchObject({
      code: 'ENOENT'
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
