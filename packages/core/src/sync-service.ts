import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { createVersionService } from './version-service';

const execFileAsync = promisify(execFile);

export type SyncMode = 'shared-folder' | 'git' | 'rest' | 'mock-rest';

export interface SyncProfile {
  id: string;
  mode: SyncMode;
  remoteUrl: string;
  enabled: boolean;
  authRef: string | null;
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

export interface SecretStore {
  set(ref: string, value: string, metadata?: { label?: string }): void;
  get(ref: string): string | null;
  inspect(ref: string): { authRef: string; label: string; masked: string } | null;
  delete(ref: string): void;
}

export interface CreateSyncServiceInput {
  database: SqliteDatabase;
  contentStore?: ContentStore;
  secretStore?: SecretStore;
  drivers?: Partial<Record<SyncMode, SyncDriver>>;
}

export interface SyncService {
  getStartupPlan(): { shouldStart: boolean; enabledProfiles: SyncProfile[] };
  createProfile(input: {
    mode: SyncMode;
    remoteUrl: string;
    enabled: boolean;
    authRef?: string | null;
    auth?: { label: string; token: string };
  }): SyncProfile;
  inspectCredential(input: { authRef: string }): { authRef: string; label: string; masked: string } | null;
  deleteCredential(input: { authRef: string }): void;
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
  applyConflictResolution(input: {
    conflictId: string;
    confirm: boolean;
    resolution: ConflictResolution;
  }): Promise<SyncConflictRecord & { draftVersionIds?: string[] }>;
  recoverSoftDeletedSkill(input: { skillId: string }): void;
}

export type ConflictResolution =
  | {
      type: 'metadata';
      fields: Record<string, { source: 'base' | 'local' | 'remote' | 'manual'; value?: unknown }>;
    }
  | { type: 'file-drafts' }
  | { type: 'delete'; action: 'soft-delete' };

export function createSyncService(input: CreateSyncServiceInput): SyncService {
  return {
    getStartupPlan() {
      const enabledProfiles = input.database
        .prepare('select id, mode, remote_url as remoteUrl, auth_ref as authRef, enabled from sync_profiles where enabled = 1')
        .all()
        .map(syncProfileRow);

      return {
        shouldStart: enabledProfiles.length > 0,
        enabledProfiles
      };
    },

    createProfile({ mode, remoteUrl, enabled, authRef, auth }) {
      const id = randomUUID();
      const resolvedAuthRef = auth ? `keychain://sync/${id}` : (authRef ?? null);
      if (auth) {
        if (!input.secretStore) {
          throw new Error('Secret store is required for sync credentials');
        }
        input.secretStore.set(resolvedAuthRef!, auth.token, { label: auth.label });
      }
      input.database
        .prepare(
          `
            insert into sync_profiles (id, mode, remote_url, auth_ref, enabled)
            values (@id, @mode, @remoteUrl, @authRef, @enabled)
          `
        )
        .run({ id, mode, remoteUrl, authRef: resolvedAuthRef, enabled: enabled ? 1 : 0 });

      return { id, mode, remoteUrl, authRef: resolvedAuthRef, enabled };
    },

    inspectCredential({ authRef }) {
      return input.secretStore?.inspect(authRef) ?? null;
    },

    deleteCredential({ authRef }) {
      input.secretStore?.delete(authRef);
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
    },

    async applyConflictResolution({ conflictId, confirm, resolution }) {
      if (!confirm) {
        throw new Error('Conflict application requires explicit confirmation');
      }

      const conflict = getConflict(input.database, conflictId);
      const draftVersionIds: string[] = [];

      if (resolution.type === 'metadata') {
        applyMetadataResolution(input.database, conflict, resolution);
      } else if (resolution.type === 'file-drafts') {
        if (!input.contentStore) {
          throw new Error('Content store is required for file conflict drafts');
        }
        const versions = createVersionService({ database: input.database, contentStore: input.contentStore });
        const localFiles = conflictFiles(conflict.local);
        const remoteFiles = conflictFiles(conflict.remote);
        draftVersionIds.push(
          (
            await versions.createVersion({
              skillId: conflict.entityId,
              changeSummary: `Local conflict draft ${conflict.id}`,
              files: localFiles
            })
          ).versionId
        );
        draftVersionIds.push(
          (
            await versions.createVersion({
              skillId: conflict.entityId,
              changeSummary: `Remote conflict draft ${conflict.id}`,
              files: remoteFiles
            })
          ).versionId
        );
      } else {
        input.database.prepare("update skills set status = 'soft-deleted', updated_at = current_timestamp where id = ?").run(conflict.entityId);
      }

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
        .run({ conflictId, resolutionJson: JSON.stringify(resolution) });
      insertSyncEvent(input.database, {
        profileId: conflict.profileId,
        direction: 'conflict',
        status: 'applied',
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        conflictId
      });

      return {
        ...getConflict(input.database, conflictId),
        ...(draftVersionIds.length > 0 ? { draftVersionIds } : {})
      };
    },

    recoverSoftDeletedSkill({ skillId }) {
      input.database.prepare("update skills set status = 'active', updated_at = current_timestamp where id = ?").run(skillId);
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

export interface RestSyncRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

export interface RestSyncResponse {
  status: number;
  json(): Promise<unknown>;
}

export function createRestSyncDriver(input: {
  secretStore: SecretStore;
  request: (request: RestSyncRequest) => Promise<RestSyncResponse>;
}): SyncDriver {
  return {
    async push(profile, records) {
      const response = await input.request({
        url: `${profile.remoteUrl.replace(/\/+$/, '')}/push`,
        method: 'POST',
        headers: authHeaders(input.secretStore, profile),
        body: JSON.stringify({ records: records.map(toPackage) })
      });
      assertRestOk(response);
    },

    async pull(profile) {
      const response = await input.request({
        url: `${profile.remoteUrl.replace(/\/+$/, '')}/pull`,
        method: 'GET',
        headers: authHeaders(input.secretStore, profile)
      });
      assertRestOk(response);
      const body = (await response.json()) as { packages?: SyncPackage[] };
      return body.packages ?? [];
    }
  };
}

export function createInMemorySecretStore(): SecretStore {
  const values = new Map<string, { value: string; label: string }>();
  return {
    set(ref, value, metadata = {}) {
      values.set(ref, { value, label: metadata.label ?? ref });
    },

    get(ref) {
      return values.get(ref)?.value ?? null;
    },

    inspect(ref) {
      const entry = values.get(ref);
      if (!entry) {
        return null;
      }

      return {
        authRef: ref,
        label: entry.label,
        masked: maskSecret(entry.value)
      };
    },

    delete(ref) {
      values.delete(ref);
    }
  };
}

export function createOsKeychainSecretStore(input: { service?: string } = {}): SecretStore {
  const service = input.service ?? 'OpenHub Sync';
  return {
    set(ref, value) {
      assertKeychainAvailable();
      execFileSync('security', ['add-generic-password', '-U', '-s', service, '-a', ref, '-w', value], {
        stdio: 'ignore'
      });
    },

    get(ref) {
      assertKeychainAvailable();
      try {
        return execFileSync('security', ['find-generic-password', '-s', service, '-a', ref, '-w'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
      } catch {
        return null;
      }
    },

    inspect(ref) {
      const value = this.get(ref);
      return value ? { authRef: ref, label: ref, masked: maskSecret(value) } : null;
    },

    delete(ref) {
      assertKeychainAvailable();
      try {
        execFileSync('security', ['delete-generic-password', '-s', service, '-a', ref], {
          stdio: 'ignore'
        });
      } catch {
        // Missing credentials are already deleted from the caller's perspective.
      }
    }
  };
}

function assertKeychainAvailable(): void {
  if (process.platform !== 'darwin') {
    throw new Error('OS keychain secret store is only implemented for macOS in this build');
  }
}

function authHeaders(secretStore: SecretStore, profile: SyncProfile): Record<string, string> {
  if (!profile.authRef) {
    return {};
  }

  const token = secretStore.get(profile.authRef);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function assertRestOk(response: RestSyncResponse): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`REST sync request failed: ${response.status}`);
  }
}

function maskSecret(secret: string): string {
  if (secret.length <= 4) {
    return '*'.repeat(secret.length);
  }

  return `${secret.slice(0, 2)}${'*'.repeat(Math.min(12, secret.length - 4))}${secret.slice(-2)}`;
}

function applyMetadataResolution(
  database: SqliteDatabase,
  conflict: SyncConflictRecord,
  resolution: Extract<ConflictResolution, { type: 'metadata' }>
): void {
  const base = asRecord(conflict.base);
  const local = asRecord(conflict.local);
  const remote = asRecord(conflict.remote);
  const merged = {
    name: chooseField('name', resolution, base, local, remote),
    description: chooseField('description', resolution, base, local, remote),
    tags: chooseField('tags', resolution, base, local, remote)
  };

  database
    .prepare(
      `
        update skills
        set name = @name,
            description = @description,
            tags_json = @tagsJson,
            updated_at = current_timestamp
        where id = @skillId
      `
    )
    .run({
      skillId: conflict.entityId,
      name: String(merged.name ?? ''),
      description: String(merged.description ?? ''),
      tagsJson: JSON.stringify(Array.isArray(merged.tags) ? merged.tags : [])
    });
}

function chooseField(
  field: string,
  resolution: Extract<ConflictResolution, { type: 'metadata' }>,
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): unknown {
  const choice = resolution.fields[field];
  if (!choice) {
    return local[field] ?? remote[field] ?? base[field];
  }

  if (choice.source === 'manual') {
    return choice.value;
  }

  return { base, local, remote }[choice.source][field];
}

function conflictFiles(input: unknown): Array<{ relativePath: string; content: string }> {
  const files = asRecord(input).files;
  if (!Array.isArray(files)) {
    throw new Error('File conflict payload requires files');
  }

  return files.map((file) => {
    const typed = asRecord(file);
    return {
      relativePath: String(typed.relativePath),
      content: String(typed.content)
    };
  });
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function getProfile(database: SqliteDatabase, profileId: string): SyncProfile {
  const row = database
    .prepare('select id, mode, remote_url as remoteUrl, auth_ref as authRef, enabled from sync_profiles where id = ?')
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
  const profile = row as { id: string; mode: SyncMode; remoteUrl: string; authRef: string | null; enabled: number };
  return {
    id: profile.id,
    mode: profile.mode,
    remoteUrl: profile.remoteUrl,
    authRef: profile.authRef,
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
