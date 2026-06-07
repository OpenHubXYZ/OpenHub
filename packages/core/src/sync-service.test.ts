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
  createInMemorySecretStore,
  createGitSyncDriver,
  createMockRestSyncDriver,
  createRestSyncDriver,
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

  it('stores sync credentials in keychain refs and uses them for real REST push and pull', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: await createSkillFixture(path.join(workspace, 'skill'), 'rest-helper') });
    const secretStore = createInMemorySecretStore();
    const requests: Array<{ url: string; authorization: string | undefined; body: unknown }> = [];
    const sync = createSyncService({
      database,
      secretStore,
      drivers: {
        rest: createRestSyncDriver({
          secretStore,
          request: async (request) => {
            requests.push({
              url: request.url,
              authorization: request.headers.authorization,
              body: request.body ? JSON.parse(request.body) : null
            });
            if (request.url.endsWith('/pull')) {
              return {
                status: 200,
                json: async () => ({
                  packages: [
                    {
                      remoteEventId: 'remote-1',
                      entityType: 'skill_version',
                      entityId: 'remote-v1',
                      payload: { versionNo: 2 }
                    }
                  ]
                })
              };
            }
            return { status: 200, json: async () => ({ remoteEventIds: ['accepted-1'] }) };
          }
        })
      }
    });
    const profile = await sync.createProfile({
      mode: 'rest',
      remoteUrl: 'https://sync.example.test',
      enabled: true,
      auth: { label: 'sync/default', token: 'super-secret-token' }
    });

    sync.recordLocalChange({
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: imported.skill.versionId,
      payload: { skillId: imported.skill.id }
    });
    await sync.pushOutbox({ profileId: profile.id });
    const pulled = await sync.pullInbox({ profileId: profile.id });
    const duplicatePull = await sync.pullInbox({ profileId: profile.id });
    const profileRows = database.prepare('select * from sync_profiles').all();

    expect(profile.authRef).toMatch(/^keychain:\/\/sync\//);
    expect(sync.inspectCredential({ authRef: profile.authRef! })).toEqual({
      authRef: profile.authRef,
      label: 'sync/default',
      masked: 'su************en'
    });
    expect(JSON.stringify(profileRows)).not.toContain('super-secret-token');
    expect(requests.map((request) => request.authorization)).toEqual([
      'Bearer super-secret-token',
      'Bearer super-secret-token',
      'Bearer super-secret-token'
    ]);
    expect(pulled).toHaveLength(1);
    expect(duplicatePull).toHaveLength(0);

    await sync.deleteCredential({ authRef: profile.authRef! });
    expect(sync.inspectCredential({ authRef: profile.authRef! })).toBeNull();
  });

  it('applies metadata, file, and delete conflicts only after explicit confirmation', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: await createSkillFixture(path.join(workspace, 'skill'), 'conflict-helper') });
    const sync = createSyncService({ database, contentStore });
    const profile = await sync.createProfile({ mode: 'mock-rest', remoteUrl: 'mock://local', enabled: true });

    const metadataConflict = sync.detectConflict({
      profileId: profile.id,
      entityType: 'skill_metadata',
      entityId: imported.skill.id,
      base: { name: 'conflict-helper', description: 'base', tags: [] },
      local: { name: 'Local Helper', description: 'local', tags: ['local'] },
      remote: { name: 'Remote Helper', description: 'remote', tags: ['remote'] }
    });
    await expect(
      sync.applyConflictResolution({
        conflictId: metadataConflict.id,
        confirm: false,
        resolution: { type: 'metadata', fields: { name: { source: 'remote' } } }
      })
    ).rejects.toThrow(/confirmation/);
    const appliedMetadata = await sync.applyConflictResolution({
      conflictId: metadataConflict.id,
      confirm: true,
      resolution: {
        type: 'metadata',
        fields: {
          name: { source: 'remote' },
          description: { source: 'manual', value: 'Merged by reviewer' },
          tags: { source: 'local' }
        }
      }
    });
    expect(appliedMetadata.status).toBe('resolved');
    expect(database.prepare('select name, description, tags_json as tagsJson from skills where id = ?').get(imported.skill.id)).toMatchObject({
      name: 'Remote Helper',
      description: 'Merged by reviewer',
      tagsJson: '["local"]'
    });

    const fileConflict = sync.detectConflict({
      profileId: profile.id,
      entityType: 'skill_files',
      entityId: imported.skill.id,
      base: {},
      local: { files: [{ relativePath: 'SKILL.md', content: '# Local draft' }] },
      remote: { files: [{ relativePath: 'SKILL.md', content: '# Remote draft' }] }
    });
    const appliedFiles = await sync.applyConflictResolution({
      conflictId: fileConflict.id,
      confirm: true,
      resolution: { type: 'file-drafts' }
    });
    expect(appliedFiles.draftVersionIds).toHaveLength(2);
    expect(
      database
        .prepare('select version_no as versionNo, change_summary as changeSummary from skill_versions where skill_id = ? order by version_no desc limit 2')
        .all(imported.skill.id)
    ).toEqual([
      expect.objectContaining({ versionNo: 3, changeSummary: `Remote conflict draft ${fileConflict.id}` }),
      expect.objectContaining({ versionNo: 2, changeSummary: `Local conflict draft ${fileConflict.id}` })
    ]);

    const deleteConflict = sync.detectConflict({
      profileId: profile.id,
      entityType: 'skill_delete',
      entityId: imported.skill.id,
      base: {},
      local: { deleted: false },
      remote: { deleted: true }
    });
    await sync.applyConflictResolution({
      conflictId: deleteConflict.id,
      confirm: true,
      resolution: { type: 'delete', action: 'soft-delete' }
    });
    expect(database.prepare('select status from skills where id = ?').get(imported.skill.id)).toEqual({
      status: 'soft-deleted'
    });
    sync.recoverSoftDeletedSkill({ skillId: imported.skill.id });
    expect(database.prepare('select status from skills where id = ?').get(imported.skill.id)).toEqual({
      status: 'active'
    });
    expect(
      database.prepare("select count(*) as count from sync_events where status = 'applied'").get()
    ).toEqual({ count: 3 });
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
