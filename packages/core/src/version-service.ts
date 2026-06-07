import { createHash, randomUUID } from 'node:crypto';

import { refreshSkillSearchIndexes, type SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe } from './path-safety';

export type FileChangeType = 'added' | 'modified' | 'deleted';

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
    files: VersionFileInput[];
  }): Promise<SkillVersionSummary>;
  listVersions(input: { skillId: string }): SkillVersionSummary[];
  diffVersions(input: { fromVersionId: string; toVersionId: string }): FileDiff[];
  compareVersions(input: { fromVersionId: string; toVersionId: string }): VersionComparisonReport;
}

interface VersionFileRow {
  relativePath: string;
  blobHash: string;
  fileSize: number;
  contentType: string;
}

interface StoredVersionFile {
  relativePath: string;
  content: string;
  blobHash: string;
  fileSize: number;
  contentType: string;
}

export function createVersionService(input: CreateVersionServiceInput): VersionService {
  return {
    async createVersion({ skillId, changeSummary, files }) {
      const nextVersionNo = getNextVersionNo(input.database, skillId);
      const versionId = randomUUID();
      const manifest = files.find((file) => file.relativePath === 'SKILL.md');
      const manifestHash = hashContent(manifest?.content ?? `${skillId}:${nextVersionNo}`);
      const storedFiles: StoredVersionFile[] = [];

      for (const file of files) {
        const relativePath = assertZipEntryPathSafe(file.relativePath);
        const stored = await input.contentStore.writeBlob(file.content);
        storedFiles.push({
          relativePath,
          content: file.content,
          blobHash: stored.hash,
          fileSize: stored.size,
          contentType: contentTypeForPath(relativePath)
        });
      }

      const create = input.database.transaction(() => {
        input.database
          .prepare(
            `
              insert into skill_versions
                (id, skill_id, version_no, change_summary, manifest_hash)
              values
                (@id, @skillId, @versionNo, @changeSummary, @manifestHash)
            `
          )
          .run({
            id: versionId,
            skillId,
            versionNo: nextVersionNo,
            changeSummary,
            manifestHash
          });

        for (const file of storedFiles) {
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
              hash: file.blobHash,
              storagePath: storagePathForHash(file.blobHash),
              size: file.fileSize,
              contentType: file.contentType
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
              blobHash: file.blobHash,
              fileKind: file.relativePath === 'SKILL.md' ? 'skill_manifest' : 'support_file',
              fileSize: file.fileSize,
              contentType: file.contentType
            });
        }

        refreshSkillSearchIndexes(input.database, skillId, storedFiles.map((file) => file.content).join('\n'));
      });

      create();
      return first(this.listVersions({ skillId }));
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
              created_at as createdAt
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
          diffs.push({ relativePath, changeType: 'added', fromHash: null, toHash: toFile.blobHash });
          continue;
        }

        if (fromFile && !toFile) {
          diffs.push({ relativePath, changeType: 'deleted', fromHash: fromFile.blobHash, toHash: null });
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
