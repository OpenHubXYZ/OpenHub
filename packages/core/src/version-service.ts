import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { refreshSkillSearchIndexes, type SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

export type FileChangeType = 'added' | 'modified' | 'deleted';
export type VersionLifecycle = 'draft' | 'released';
export type ReleaseChannel = 'stable' | 'beta' | 'local';

export interface CreateVersionServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
}

export interface SkillVersionSummary {
  versionId: string;
  skillId: string;
  versionNo: number;
  changeSummary: string;
  createdAt: string;
  lifecycle: VersionLifecycle;
  releaseChannel: ReleaseChannel;
}

export interface VersionFileInput {
  relativePath: string;
  content: string;
}

export interface FileDiff {
  relativePath: string;
  changeType: FileChangeType;
  fromHash: string | null;
  toHash: string | null;
}

export interface VersionComparisonReport {
  fromVersionId: string;
  toVersionId: string;
  fromManifestHash: string | null;
  toManifestHash: string | null;
  manifestHashChanged: boolean;
  files: FileDiff[];
}

export interface VersionService {
  createVersion(input: {
    skillId: string;
    changeSummary: string;
    lifecycle?: VersionLifecycle;
    releaseChannel?: ReleaseChannel;
    files: VersionFileInput[];
  }): Promise<SkillVersionSummary>;
  promoteVersion(input: { versionId: string; releaseChannel: ReleaseChannel }): SkillVersionSummary;
  listVersions(input: { skillId: string }): SkillVersionSummary[];
  diffVersions(input: { fromVersionId: string; toVersionId: string }): FileDiff[];
  compareVersions(input: { fromVersionId: string; toVersionId: string }): VersionComparisonReport;
  rollbackInstallation(input: { installationId: string; targetVersionId: string }): Promise<void>;
}

interface VersionFileRow {
  relativePath: string;
  blobHash: string;
  fileSize: number;
  contentType: string;
}

interface InstallationRow {
  id: string;
  skillId: string;
  rootPath: string;
  installPath: string;
}

export function createVersionService(input: CreateVersionServiceInput): VersionService {
  return {
    async createVersion({ skillId, changeSummary, files, lifecycle = 'released', releaseChannel }) {
      const nextVersionNo = getNextVersionNo(input.database, skillId);
      const versionId = randomUUID();
      const manifest = files.find((file) => file.relativePath === 'SKILL.md');
      const manifestHash = hashContent(manifest?.content ?? `${skillId}:${nextVersionNo}`);
      const normalizedReleaseChannel = releaseChannel ?? (lifecycle === 'draft' ? 'local' : 'stable');

      for (const file of files) {
        assertZipEntryPathSafe(file.relativePath);
        await input.contentStore.writeBlob(file.content);
      }

      const create = input.database.transaction(() => {
        input.database
          .prepare(
            `
              insert into skill_versions
                (id, skill_id, version_no, change_summary, manifest_hash, lifecycle, release_channel, released)
              values
                (@id, @skillId, @versionNo, @changeSummary, @manifestHash, @lifecycle, @releaseChannel, @released)
            `
          )
          .run({
            id: versionId,
            skillId,
            versionNo: nextVersionNo,
            changeSummary,
            manifestHash,
            lifecycle,
            releaseChannel: normalizedReleaseChannel,
            released: lifecycle === 'released' ? 1 : 0
          });

        for (const file of files) {
          const blobHash = hashContent(file.content);
          const contentType = contentTypeForPath(file.relativePath);

          input.database
            .prepare(
              `
                insert or ignore into blob_objects
                  (hash, storage_path, size, content_type)
                values
                  (@hash, @storagePath, @size, @contentType)
              `
            )
            .run({
              hash: blobHash,
              storagePath: storagePathForHash(blobHash),
              size: Buffer.byteLength(file.content),
              contentType
            });

          input.database
            .prepare(
              `
                insert into skill_files
                  (id, skill_version_id, relative_path, blob_hash, file_kind, file_size, content_type)
                values
                  (@id, @versionId, @relativePath, @blobHash, @fileKind, @fileSize, @contentType)
              `
            )
            .run({
              id: randomUUID(),
              versionId,
              relativePath: file.relativePath,
              blobHash,
              fileKind: file.relativePath === 'SKILL.md' ? 'skill_manifest' : 'support_file',
              fileSize: Buffer.byteLength(file.content),
              contentType
            });
        }

        refreshSkillSearchIndexes(input.database, skillId, files.map((file) => file.content).join('\n'));
      });

      create();
      return first(this.listVersions({ skillId }));
    },

    promoteVersion({ versionId, releaseChannel }) {
      const row = input.database
        .prepare('select skill_id as skillId from skill_versions where id = ?')
        .get(versionId) as { skillId: string } | undefined;
      if (!row) {
        throw new Error(`Version not found: ${versionId}`);
      }

      input.database
        .prepare(
          `
            update skill_versions
            set lifecycle = 'released',
                release_channel = @releaseChannel,
                released = 1
            where id = @versionId
          `
        )
        .run({ versionId, releaseChannel });

      const promoted = this.listVersions({ skillId: row.skillId }).find((version) => version.versionId === versionId);
      if (!promoted) {
        throw new Error(`Promoted version not found: ${versionId}`);
      }
      return promoted;
    },

    listVersions({ skillId }) {
      return input.database
        .prepare(
          `
            select
              id as versionId,
              skill_id as skillId,
              version_no as versionNo,
              coalesce(change_summary, '') as changeSummary,
              created_at as createdAt,
              lifecycle,
              release_channel as releaseChannel
            from skill_versions
            where skill_id = ?
            order by version_no desc
          `
        )
        .all(skillId) as SkillVersionSummary[];
    },

    diffVersions({ fromVersionId, toVersionId }) {
      const fromFiles = fileMap(getVersionFiles(input.database, fromVersionId));
      const toFiles = fileMap(getVersionFiles(input.database, toVersionId));
      const relativePaths = Array.from(new Set([...fromFiles.keys(), ...toFiles.keys()])).sort(comparePaths);
      const diffs: FileDiff[] = [];

      for (const relativePath of relativePaths) {
        const fromFile = fromFiles.get(relativePath);
        const toFile = toFiles.get(relativePath);

        if (!fromFile && toFile) {
          diffs.push({
            relativePath,
            changeType: 'added',
            fromHash: null,
            toHash: toFile.blobHash
          });
          continue;
        }

        if (fromFile && !toFile) {
          diffs.push({
            relativePath,
            changeType: 'deleted',
            fromHash: fromFile.blobHash,
            toHash: null
          });
          continue;
        }

        if (fromFile && toFile && fromFile.blobHash !== toFile.blobHash) {
          diffs.push({
            relativePath,
            changeType: 'modified',
            fromHash: fromFile.blobHash,
            toHash: toFile.blobHash
          });
        }
      }

      return diffs;
    },

    compareVersions({ fromVersionId, toVersionId }) {
      const fromManifestHash = getVersionManifestHash(input.database, fromVersionId);
      const toManifestHash = getVersionManifestHash(input.database, toVersionId);
      return {
        fromVersionId,
        toVersionId,
        fromManifestHash,
        toManifestHash,
        manifestHashChanged: fromManifestHash !== toManifestHash,
        files: this.diffVersions({ fromVersionId, toVersionId })
      };
    },

    async rollbackInstallation({ installationId, targetVersionId }) {
      const installation = getInstallation(input.database, installationId);
      const targetFiles = getVersionFiles(input.database, targetVersionId);
      assertVersionBelongsToSkill(input.database, targetVersionId, installation.skillId);

      for (const file of getInstallationFiles(input.database, installationId)) {
        const safeTargetPath = await ensurePathInsideRoot(installation.rootPath, file.targetPath);
        await unlink(safeTargetPath).catch((error: unknown) => {
          if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            return;
          }

          throw error;
        });
      }

      for (const file of targetFiles) {
        const relativePath = assertZipEntryPathSafe(file.relativePath);
        const targetPath = path.join(installation.installPath, ...relativePath.split('/'));
        const safeTargetPath = await ensurePathInsideRoot(installation.rootPath, targetPath);
        const content = await input.contentStore.readBlob(file.blobHash);

        await mkdir(path.dirname(safeTargetPath), { recursive: true });
        if (await fileExists(safeTargetPath)) {
          await unlink(safeTargetPath);
        }
        await writeFile(safeTargetPath, content);
      }

      recordRollback(input.database, installationId, targetVersionId, targetFiles, installation);
    }
  };
}

function getNextVersionNo(database: SqliteDatabase, skillId: string): number {
  const row = database
    .prepare('select coalesce(max(version_no), 0) + 1 as versionNo from skill_versions where skill_id = ?')
    .get(skillId) as { versionNo: number };
  return row.versionNo;
}

function getVersionFiles(database: SqliteDatabase, versionId: string): VersionFileRow[] {
  return database
    .prepare(
      `
        select
          relative_path as relativePath,
          blob_hash as blobHash,
          file_size as fileSize,
          content_type as contentType
        from skill_files
        where skill_version_id = ?
        order by
          case when relative_path = 'SKILL.md' then 0 else 1 end,
          relative_path collate nocase
      `
    )
    .all(versionId) as VersionFileRow[];
}

function getVersionManifestHash(database: SqliteDatabase, versionId: string): string | null {
  const row = database
    .prepare('select manifest_hash as manifestHash from skill_versions where id = ?')
    .get(versionId) as { manifestHash: string } | undefined;
  return row?.manifestHash ?? null;
}

function getInstallation(database: SqliteDatabase, installationId: string): InstallationRow {
  const row = database
    .prepare(
      `
        select
          i.id,
          i.skill_id as skillId,
          ar.root_path as rootPath,
          i.install_path as installPath
        from installations i
        join agent_roots ar on ar.id = i.agent_root_id
        where i.id = ?
      `
    )
    .get(installationId);

  if (!row) {
    throw new Error(`Installation not found: ${installationId}`);
  }

  return row as InstallationRow;
}

function getInstallationFiles(
  database: SqliteDatabase,
  installationId: string
): Array<{ targetPath: string }> {
  return database
    .prepare(
      `
        select target_path as targetPath
        from installation_files
        where installation_id = ?
        order by length(target_path) desc
      `
    )
    .all(installationId) as Array<{ targetPath: string }>;
}

function assertVersionBelongsToSkill(database: SqliteDatabase, versionId: string, skillId: string): void {
  const row = database
    .prepare('select skill_id as skillId from skill_versions where id = ?')
    .get(versionId) as { skillId: string } | undefined;

  if (!row || row.skillId !== skillId) {
    throw new Error(`Version does not belong to installation skill: ${versionId}`);
  }
}

function recordRollback(
  database: SqliteDatabase,
  installationId: string,
  targetVersionId: string,
  files: VersionFileRow[],
  installation: InstallationRow
): void {
  const record = database.transaction(() => {
    database
      .prepare(
        `
          update installations
          set installed_version_id = @versionId,
              status = 'installed',
              last_verified_at = current_timestamp
          where id = @installationId
        `
      )
      .run({ versionId: targetVersionId, installationId });

    database.prepare('delete from installation_files where installation_id = ?').run(installationId);
    const insertFile = database.prepare(
      `
        insert into installation_files
          (id, installation_id, relative_path, target_path, blob_hash)
        values
          (@id, @installationId, @relativePath, @targetPath, @blobHash)
      `
    );

    for (const file of files) {
      const relativePath = assertZipEntryPathSafe(file.relativePath);
      insertFile.run({
        id: randomUUID(),
        installationId,
        relativePath,
        targetPath: path.join(installation.installPath, ...relativePath.split('/')),
        blobHash: file.blobHash
      });
    }
  });

  record();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function fileMap(files: VersionFileRow[]): Map<string, VersionFileRow> {
  return new Map(files.map((file) => [file.relativePath, file]));
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function storagePathForHash(hash: string): string {
  return `${hash.slice(0, 2)}/${hash}`;
}

function contentTypeForPath(relativePath: string): string {
  return relativePath.endsWith('.md') ? 'text/markdown' : 'text/plain';
}

function comparePaths(left: string, right: string): number {
  if (left === 'SKILL.md') {
    return -1;
  }

  if (right === 'SKILL.md') {
    return 1;
  }

  return left.localeCompare(right);
}

function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) {
    throw new Error('Expected at least one item');
  }

  return item;
}
