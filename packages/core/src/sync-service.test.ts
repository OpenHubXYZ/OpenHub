import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import {
  createGitSyncDriver,
  createMockRestSyncDriver,
  createSharedFolderSyncDriver,
  createSyncService
} from './sync-service';

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];

describe('sync service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('stays disabled by default when no sync profile exists', () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const sync = createSyncService({ database });

    expect(sync.getStartupPlan()).toEqual({ shouldStart: false, enabledProfiles: [] });
    expect(countRows(database, 'sync_outbox')).toBe(0);
    expect(countRows(database, 'sync_events')).toBe(0);
  });

  it('records local writes only after the local version exists and pushes/pulls shared-folder packages', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: await createSkillFixture(path.join(workspace, 'skill'), 'sync-helper') });
    const sharedDirectory = path.join(workspace, 'shared-sync');
    const sync = createSyncService({
      database,
      drivers: {
        'shared-folder': createSharedFolderSyncDriver({ directory: sharedDirectory })
      }
    });
    const profile = sync.createProfile({
      mode: 'shared-folder',
      remoteUrl: sharedDirectory,
      enabled: true
    });

    const outbox = sync.recordLocalChange({
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: imported.skill.versionId,
      payload: { skillId: imported.skill.id, versionNo: imported.skill.versionNo }
    });
    await sync.pushOutbox({ profileId: profile.id });
    const sharedInbox = path.join(sharedDirectory, 'inbox');
    await mkdir(sharedInbox, { recursive: true });
    await writeFile(
      path.join(sharedInbox, 'remote-change.json'),
      JSON.stringify({ entityType: 'skill_version', entityId: 'remote-v1', payload: { versionNo: 7 } })
    );
    const pulled = await sync.pullInbox({ profileId: profile.id });

    expect(outbox.status).toBe('queued');
    expect(countRows(database, 'sync_outbox')).toBe(1);
    expect(countRows(database, 'skill_versions')).toBe(1);
    expect(pulled).toHaveLength(1);
    expect(countRows(database, 'sync_inbox')).toBe(1);
  });

  it('commits and pulls change packages through the Git sync driver', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: await createSkillFixture(path.join(workspace, 'skill'), 'git-sync-helper') });
    const repositoryDirectory = path.join(workspace, 'git-sync');
    const sync = createSyncService({
      database,
      drivers: {
        git: createGitSyncDriver({ repositoryDirectory })
      }
    });
    const profile = sync.createProfile({ mode: 'git', remoteUrl: repositoryDirectory, enabled: true });

    sync.recordLocalChange({
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: imported.skill.versionId,
      payload: { skillId: imported.skill.id }
    });
    await sync.pushOutbox({ profileId: profile.id });
    const { stdout } = await execFileAsync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: repositoryDirectory
    });
    const pulled = await sync.pullInbox({ profileId: profile.id });

    expect(Number(stdout.trim())).toBeGreaterThanOrEqual(1);
    expect(pulled).toHaveLength(1);
  });

  it('uses a mock REST driver contract without live network access', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: await createSkillFixture(path.join(workspace, 'skill'), 'rest-sync-helper') });
    const sync = createSyncService({
      database,
      drivers: {
        'mock-rest': createMockRestSyncDriver()
      }
    });
    const profile = sync.createProfile({ mode: 'mock-rest', remoteUrl: 'mock://local', enabled: true });

    sync.recordLocalChange({
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: imported.skill.versionId,
      payload: { skillId: imported.skill.id }
    });
    await sync.pushOutbox({ profileId: profile.id });
    const pulled = await sync.pullInbox({ profileId: profile.id });

    expect(pulled).toHaveLength(1);
    expect(countRows(database, 'sync_events')).toBe(2);
  });

  it('opens and resolves conflicts for Sync Center', () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const sync = createSyncService({ database });
    const profile = sync.createProfile({ mode: 'mock-rest', remoteUrl: 'mock://local', enabled: true });

    const conflict = sync.detectConflict({
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: 'skill-version-1',
      base: { hash: 'base' },
      local: { hash: 'local' },
      remote: { hash: 'remote' }
    });
    const resolved = sync.resolveConflict({
      conflictId: conflict.id,
      resolution: 'use-local'
    });

    expect(conflict.status).toBe('open');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolution).toBe('use-local');
    expect(countRows(database, 'sync_events')).toBe(2);
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-sync-'));
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
