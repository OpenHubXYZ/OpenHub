import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { SqliteDatabase } from '@theopenhub/db';

const execFileAsync = promisify(execFile);

export type SyncMode = 'shared-folder' | 'git' | 'mock-rest';

export interface SyncProfile {
  id: string;
  mode: SyncMode;
  remoteUrl: string;
  enabled: boolean;
}

export interface SyncOutboxRecord {
  id: string;
  profileId: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  status: string;
}

export interface SyncInboxRecord {
  id: string;
  profileId: string;
  remoteEventId: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  status: string;
}

export interface SyncConflictRecord {
  id: string;
  profileId: string;
  entityType: string;
  entityId: string;
  base: unknown;
  local: unknown;
  remote: unknown;
  status: 'open' | 'resolved';
  resolution: string | null;
}

export interface SyncPackage {
  remoteEventId: string;
  entityType: string;
  entityId: string;
  payload: unknown;
}

export interface SyncDriver {
  push(profile: SyncProfile, records: SyncOutboxRecord[]): Promise<void>;
  pull(profile: SyncProfile): Promise<SyncPackage[]>;
}

export interface CreateSyncServiceInput {
  database: SqliteDatabase;
  drivers?: Partial<Record<SyncMode, SyncDriver>>;
}

export interface SyncService {
  getStartupPlan(): { shouldStart: boolean; enabledProfiles: SyncProfile[] };
  createProfile(input: { mode: SyncMode; remoteUrl: string; enabled: boolean }): SyncProfile;
  recordLocalChange(input: {
    profileId: string;
    entityType: string;
    entityId: string;
    payload: unknown;
  }): SyncOutboxRecord;
  pushOutbox(input: { profileId: string }): Promise<void>;
  pullInbox(input: { profileId: string }): Promise<SyncInboxRecord[]>;
  detectConflict(input: {
    profileId: string;
    entityType: string;
    entityId: string;
    base: unknown;
    local: unknown;
    remote: unknown;
  }): SyncConflictRecord;
  resolveConflict(input: { conflictId: string; resolution: string }): SyncConflictRecord;
}

export function createSyncService(input: CreateSyncServiceInput): SyncService {
  return {
    getStartupPlan() {
      const enabledProfiles = input.database
        .prepare('select id, mode, remote_url as remoteUrl, enabled from sync_profiles where enabled = 1')
        .all()
        .map(syncProfileRow);

      return {
        shouldStart: enabledProfiles.length > 0,
        enabledProfiles
      };
    },

    createProfile({ mode, remoteUrl, enabled }) {
      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into sync_profiles (id, mode, remote_url, enabled)
            values (@id, @mode, @remoteUrl, @enabled)
          `
        )
        .run({ id, mode, remoteUrl, enabled: enabled ? 1 : 0 });

      return { id, mode, remoteUrl, enabled };
    },

    recordLocalChange({ profileId, entityType, entityId, payload }) {
      assertLocalEntityExists(input.database, entityType, entityId);
      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into sync_outbox
              (id, profile_id, entity_type, entity_id, payload_json, status)
            values
              (@id, @profileId, @entityType, @entityId, @payloadJson, 'queued')
          `
        )
        .run({
          id,
          profileId,
          entityType,
          entityId,
          payloadJson: JSON.stringify(payload)
        });

      return { id, profileId, entityType, entityId, payload, status: 'queued' };
    },

    async pushOutbox({ profileId }) {
      const profile = getProfile(input.database, profileId);
      const driver = driverFor(input.drivers, profile.mode);
      const records = getQueuedOutbox(input.database, profileId);

      if (records.length === 0) {
        return;
      }

      await driver.push(profile, records);
      const markSent = input.database.transaction(() => {
        for (const record of records) {
          input.database
            .prepare("update sync_outbox set status = 'sent', sent_at = current_timestamp where id = ?")
            .run(record.id);
          insertSyncEvent(input.database, {
            profileId,
            direction: 'out',
            status: 'sent',
            entityType: record.entityType,
            entityId: record.entityId,
            conflictId: null
          });
        }
        input.database
          .prepare('update sync_profiles set last_synced_at = current_timestamp where id = ?')
          .run(profileId);
      });

      markSent();
    },

    async pullInbox({ profileId }) {
      const profile = getProfile(input.database, profileId);
      const driver = driverFor(input.drivers, profile.mode);
      const packages = await driver.pull(profile);
      const pulled: SyncInboxRecord[] = [];

      const record = input.database.transaction(() => {
        for (const syncPackage of packages) {
          const id = randomUUID();
          const result = input.database
            .prepare(
              `
                insert or ignore into sync_inbox
                  (id, profile_id, remote_event_id, entity_type, entity_id, payload_json, status)
                values
                  (@id, @profileId, @remoteEventId, @entityType, @entityId, @payloadJson, 'received')
              `
            )
            .run({
              id,
              profileId,
              remoteEventId: syncPackage.remoteEventId,
              entityType: syncPackage.entityType,
              entityId: syncPackage.entityId,
              payloadJson: JSON.stringify(syncPackage.payload)
            });

          if (result.changes === 0) {
            continue;
          }

          pulled.push({
            id,
            profileId,
            remoteEventId: syncPackage.remoteEventId,
            entityType: syncPackage.entityType,
            entityId: syncPackage.entityId,
            payload: syncPackage.payload,
            status: 'received'
          });
          insertSyncEvent(input.database, {
            profileId,
            direction: 'in',
            status: 'received',
            entityType: syncPackage.entityType,
            entityId: syncPackage.entityId,
            conflictId: null
          });
        }
        input.database
          .prepare('update sync_profiles set last_synced_at = current_timestamp where id = ?')
          .run(profileId);
      });

      record();
      return pulled;
    },

    detectConflict({ profileId, entityType, entityId, base, local, remote }) {
      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into sync_conflicts
              (id, profile_id, entity_type, entity_id, base_json, local_json, remote_json, status)
            values
              (@id, @profileId, @entityType, @entityId, @baseJson, @localJson, @remoteJson, 'open')
          `
        )
        .run({
          id,
          profileId,
          entityType,
          entityId,
          baseJson: JSON.stringify(base),
          localJson: JSON.stringify(local),
          remoteJson: JSON.stringify(remote)
        });
      insertSyncEvent(input.database, {
        profileId,
        direction: 'conflict',
        status: 'open',
        entityType,
        entityId,
        conflictId: id
      });

      return { id, profileId, entityType, entityId, base, local, remote, status: 'open', resolution: null };
    },

    resolveConflict({ conflictId, resolution }) {
      const conflict = getConflict(input.database, conflictId);
      input.database
        .prepare(
          `
            update sync_conflicts
            set status = 'resolved',
                resolution_json = @resolutionJson,
                resolved_at = current_timestamp
            where id = @conflictId
          `
        )
        .run({ conflictId, resolutionJson: JSON.stringify({ resolution }) });
      insertSyncEvent(input.database, {
        profileId: conflict.profileId,
        direction: 'conflict',
        status: 'resolved',
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        conflictId
      });

      return getConflict(input.database, conflictId);
    }
  };
}

export function createSharedFolderSyncDriver(input: { directory: string }): SyncDriver {
  return {
    async push(_profile, records) {
      const outboxDirectory = path.join(input.directory, 'outbox');
      await mkdir(outboxDirectory, { recursive: true });

      for (const record of records) {
        await writeFile(
          path.join(outboxDirectory, `${record.id}.json`),
          JSON.stringify(toPackage(record), null, 2)
        );
      }
    },

    async pull() {
      return readPackagesFromDirectory(path.join(input.directory, 'inbox'));
    }
  };
}

export function createGitSyncDriver(input: { repositoryDirectory: string }): SyncDriver {
  return {
    async push(_profile, records) {
      await ensureGitRepository(input.repositoryDirectory);
      const packagesDirectory = path.join(input.repositoryDirectory, 'packages');
      await mkdir(packagesDirectory, { recursive: true });

      for (const record of records) {
        await writeFile(
          path.join(packagesDirectory, `${record.id}.json`),
          JSON.stringify(toPackage(record), null, 2)
        );
      }

      await execFileAsync('git', ['add', '.'], { cwd: input.repositoryDirectory });
      await execFileAsync(
        'git',
        ['-c', 'user.name=OpenHub Sync', '-c', 'user.email=sync@example.com', 'commit', '-m', 'sync packages'],
        { cwd: input.repositoryDirectory }
      );
    },

    async pull() {
      await ensureGitRepository(input.repositoryDirectory);
      return readPackagesFromDirectory(path.join(input.repositoryDirectory, 'packages'));
    }
  };
}

export function createMockRestSyncDriver(input: { packages?: SyncPackage[] } = {}): SyncDriver {
  const packages = [...(input.packages ?? [])];

  return {
    async push(_profile, records) {
      packages.push(...records.map(toPackage));
    },

    async pull() {
      return [...packages];
    }
  };
}

function getProfile(database: SqliteDatabase, profileId: string): SyncProfile {
  const row = database
    .prepare('select id, mode, remote_url as remoteUrl, enabled from sync_profiles where id = ?')
    .get(profileId);

  if (!row) {
    throw new Error(`Sync profile not found: ${profileId}`);
  }

  return syncProfileRow(row);
}

function getQueuedOutbox(database: SqliteDatabase, profileId: string): SyncOutboxRecord[] {
  return database
    .prepare(
      `
        select
          id,
          profile_id as profileId,
          entity_type as entityType,
          entity_id as entityId,
          payload_json as payloadJson,
          status
        from sync_outbox
        where profile_id = @profileId
          and status = 'queued'
        order by created_at
      `
    )
    .all({ profileId })
    .map(syncOutboxRow);
}

function getConflict(database: SqliteDatabase, conflictId: string): SyncConflictRecord {
  const row = database
    .prepare(
      `
        select
          id,
          profile_id as profileId,
          entity_type as entityType,
          entity_id as entityId,
          base_json as baseJson,
          local_json as localJson,
          remote_json as remoteJson,
          status,
          resolution_json as resolutionJson
        from sync_conflicts
        where id = ?
      `
    )
    .get(conflictId);

  if (!row) {
    throw new Error(`Sync conflict not found: ${conflictId}`);
  }

  const conflict = row as {
    id: string;
    profileId: string;
    entityType: string;
    entityId: string;
    baseJson: string;
    localJson: string;
    remoteJson: string;
    status: 'open' | 'resolved';
    resolutionJson: string | null;
  };
  return {
    id: conflict.id,
    profileId: conflict.profileId,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    base: JSON.parse(conflict.baseJson),
    local: JSON.parse(conflict.localJson),
    remote: JSON.parse(conflict.remoteJson),
    status: conflict.status,
    resolution: conflict.resolutionJson
      ? (JSON.parse(conflict.resolutionJson) as { resolution: string }).resolution
      : null
  };
}

function insertSyncEvent(
  database: SqliteDatabase,
  input: {
    profileId: string;
    direction: string;
    status: string;
    entityType: string;
    entityId: string;
    conflictId: string | null;
  }
): void {
  database
    .prepare(
      `
        insert into sync_events
          (id, profile_id, direction, status, entity_type, entity_id, conflict_id)
        values
          (@id, @profileId, @direction, @status, @entityType, @entityId, @conflictId)
      `
    )
    .run({ id: randomUUID(), ...input });
}

function assertLocalEntityExists(database: SqliteDatabase, entityType: string, entityId: string): void {
  if (entityType !== 'skill_version') {
    return;
  }

  const row = database.prepare('select id from skill_versions where id = ?').get(entityId);
  if (!row) {
    throw new Error(`Cannot enqueue missing local entity: ${entityType}:${entityId}`);
  }
}

function driverFor(
  drivers: Partial<Record<SyncMode, SyncDriver>> | undefined,
  mode: SyncMode
): SyncDriver {
  const driver = drivers?.[mode];
  if (!driver) {
    throw new Error(`Sync driver is not configured: ${mode}`);
  }

  return driver;
}

async function ensureGitRepository(repositoryDirectory: string): Promise<void> {
  await mkdir(repositoryDirectory, { recursive: true });

  try {
    await stat(path.join(repositoryDirectory, '.git'));
  } catch {
    await execFileAsync('git', ['init'], { cwd: repositoryDirectory });
  }
}

async function readPackagesFromDirectory(directory: string): Promise<SyncPackage[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const packages: SyncPackage[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const content = JSON.parse(await readFile(path.join(directory, entry.name), 'utf8')) as {
        remoteEventId?: string;
        id?: string;
        entityType: string;
        entityId: string;
        payload: unknown;
      };
      packages.push({
        remoteEventId: content.remoteEventId ?? content.id ?? entry.name.replace(/\.json$/, ''),
        entityType: content.entityType,
        entityId: content.entityId,
        payload: content.payload
      });
    }

    return packages.sort((left, right) => left.remoteEventId.localeCompare(right.remoteEventId));
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function toPackage(record: SyncOutboxRecord): SyncPackage {
  return {
    remoteEventId: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    payload: record.payload
  };
}

function syncProfileRow(row: unknown): SyncProfile {
  const profile = row as { id: string; mode: SyncMode; remoteUrl: string; enabled: number };
  return {
    id: profile.id,
    mode: profile.mode,
    remoteUrl: profile.remoteUrl,
    enabled: profile.enabled === 1
  };
}

function syncOutboxRow(row: unknown): SyncOutboxRecord {
  const record = row as {
    id: string;
    profileId: string;
    entityType: string;
    entityId: string;
    payloadJson: string;
    status: string;
  };
  return {
    id: record.id,
    profileId: record.profileId,
    entityType: record.entityType,
    entityId: record.entityId,
    payload: JSON.parse(record.payloadJson),
    status: record.status
  };
}
