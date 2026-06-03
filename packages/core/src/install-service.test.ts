import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createInstallService } from './install-service';

const tempDirectories: string[] = [];

describe('install service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('creates a conflict plan, installs by copy projection, and uninstalls only app-owned files', async () => {
    const workspace = await tempDir();
    const source = path.join(workspace, 'source');
    const targetRoot = path.join(workspace, 'target-agent');
    const conflictTarget = path.join(targetRoot, 'install-helper');
    await mkdir(path.join(source, 'references'), { recursive: true });
    await mkdir(conflictTarget, { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: install-helper', 'description: Install helper', '---', '# Install Helper'].join('\n')
    );
    await writeFile(path.join(source, 'references/guide.md'), 'guide');
    await writeFile(path.join(conflictTarget, 'SKILL.md'), 'existing user file');
    await writeFile(path.join(conflictTarget, 'user-note.md'), 'do not remove');

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const installer = createInstallService({ database, contentStore });

    const conflictPlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    expect(conflictPlan.conflictState).toBe('conflict');
    expect(conflictPlan.writes[0]).toEqual(expect.objectContaining({ conflict: 'exists' }));
    await expect(installer.applyInstallPlan(conflictPlan)).rejects.toThrow(/conflicts/);

    await rm(path.join(conflictTarget, 'SKILL.md'));
    const cleanPlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    expect(cleanPlan.conflictState).toBe('clean');
    const result = await installer.applyInstallPlan(cleanPlan);
    expect(result.status).toBe('installed');
    await expect(readFile(path.join(conflictTarget, 'SKILL.md'), 'utf8')).resolves.toContain(
      'Install Helper'
    );

    await installer.uninstall({ installationId: result.installationId });
    await expect(readFile(path.join(conflictTarget, 'user-note.md'), 'utf8')).resolves.toBe(
      'do not remove'
    );
    await expect(readFile(path.join(conflictTarget, 'SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-install-'));
  tempDirectories.push(directory);
  return directory;
}
