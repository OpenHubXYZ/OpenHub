import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

export interface CreateExportServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
}

export interface ExportSkillInput {
  skillId: string;
  outputDirectory: string;
}

export interface ExportSkillResult {
  outputDirectory: string;
}

export interface ExportService {
  exportSkill(input: ExportSkillInput): Promise<ExportSkillResult>;
}

interface ExportFileRow {
  skillId: string;
  skillName: string;
  skillSlug: string;
  versionNo: number;
  relativePath: string;
  blobHash: string;
  fileSize: number;
}

export function createExportService(input: CreateExportServiceInput): ExportService {
  return {
    async exportSkill({ skillId, outputDirectory }) {
      const files = getExportFiles(input.database, skillId);
      if (files.length === 0) {
        throw new Error(`Skill has no files: ${skillId}`);
      }

      const filesDirectory = path.join(outputDirectory, 'files');
      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(filesDirectory, { recursive: true });

      for (const file of files) {
        const relativePath = assertZipEntryPathSafe(file.relativePath);
        const targetPath = path.join(filesDirectory, ...relativePath.split('/'));
        const safeTargetPath = await ensurePathInsideRoot(filesDirectory, targetPath);
        const content = await input.contentStore.readBlob(file.blobHash);

        await mkdir(path.dirname(safeTargetPath), { recursive: true });
        await writeFile(safeTargetPath, content);
      }

      const firstFile = first(files);
      await writeFile(
        path.join(outputDirectory, 'manifest.json'),
        JSON.stringify(
          {
            skillId: firstFile.skillId,
            name: firstFile.skillName,
            slug: firstFile.skillSlug,
            versionNo: firstFile.versionNo,
            files: files.map((file) => ({
              relativePath: file.relativePath,
              hash: file.blobHash,
              size: file.fileSize
            }))
          },
          null,
          2
        )
      );

      return { outputDirectory };
    }
  };
}

function getExportFiles(database: SqliteDatabase, skillId: string): ExportFileRow[] {
  return database
    .prepare(
      `
        select
          s.id as skillId,
          s.name as skillName,
          s.slug as skillSlug,
          sv.version_no as versionNo,
          sf.relative_path as relativePath,
          sf.blob_hash as blobHash,
          sf.file_size as fileSize
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        join skill_files sf on sf.skill_version_id = sv.id
        where s.id = @skillId
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = @skillId
          )
        order by
          case when sf.relative_path = 'SKILL.md' then 0 else 1 end,
          sf.relative_path collate nocase
      `
    )
    .all({ skillId })
    .map(exportFileRow);
}

function exportFileRow(row: unknown): ExportFileRow {
  return row as ExportFileRow;
}

function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) {
    throw new Error('Expected at least one item');
  }

  return item;
}
