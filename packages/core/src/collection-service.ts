import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSkillRepository } from '@theopenhub/db';
import type { SkillRecord, SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

export interface CreateCollectionServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string;
}

export interface CreateCollectionInput {
  name: string;
  description: string;
  skillIds: string[];
}

export interface CollectionExportResult {
  outputDirectory: string;
}

export interface CollectionImportResult {
  collection: CollectionRecord;
  skills: SkillRecord[];
}

export interface CollectionService {
  createCollection(input: CreateCollectionInput): CollectionRecord;
  exportCollection(input: {
    collectionId: string;
    outputDirectory: string;
  }): Promise<CollectionExportResult>;
  importCollection(input: { packageDirectory: string }): Promise<CollectionImportResult>;
}

interface CollectionSkillRow {
  skillId: string;
  name: string;
  slug: string;
  description: string;
  tagsJson: string;
  versionNo: number;
  relativePath: string;
  blobHash: string;
  fileSize: number;
}

interface CollectionPackageManifest {
  name: string;
  description: string;
  skills: Array<{
    name: string;
    slug: string;
    description: string;
    tags: string[];
    files: Array<{
      relativePath: string;
      hash: string;
      size: number;
    }>;
  }>;
}

export function createCollectionService(input: CreateCollectionServiceInput): CollectionService {
  return {
    createCollection({ name, description, skillIds }) {
      return createCollectionRecord(input.database, { name, description, skillIds });
    },

    async exportCollection({ collectionId, outputDirectory }) {
      const collection = getCollection(input.database, collectionId);
      const rows = getCollectionSkillRows(input.database, collectionId);
      const filesDirectory = path.join(outputDirectory, 'skills');

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(filesDirectory, { recursive: true });

      const skillMap = new Map<string, CollectionPackageManifest['skills'][number]>();
      for (const row of rows) {
        const relativePath = assertZipEntryPathSafe(row.relativePath);
        const targetPath = path.join(filesDirectory, row.slug, ...relativePath.split('/'));
        const safeTargetPath = await ensurePathInsideRoot(outputDirectory, targetPath);
        const content = await input.contentStore.readBlob(row.blobHash);

        await mkdir(path.dirname(safeTargetPath), { recursive: true });
        await writeFile(safeTargetPath, content);

        let skill = skillMap.get(row.skillId);
        if (!skill) {
          skill = {
            name: row.name,
            slug: row.slug,
            description: row.description,
            tags: JSON.parse(row.tagsJson) as string[],
            files: []
          };
          skillMap.set(row.skillId, skill);
        }

        skill.files.push({
          relativePath,
          hash: row.blobHash,
          size: row.fileSize
        });
      }

      const manifest: CollectionPackageManifest = {
        name: collection.name,
        description: collection.description,
        skills: Array.from(skillMap.values()).sort((left, right) => left.name.localeCompare(right.name))
      };
      await writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));

      return { outputDirectory };
    },

    async importCollection({ packageDirectory }) {
      const manifest = JSON.parse(
        await readFile(path.join(packageDirectory, 'manifest.json'), 'utf8')
      ) as CollectionPackageManifest;
      const skillRepository = createSkillRepository(input.database);
      const skills: SkillRecord[] = [];

      for (const packageSkill of manifest.skills) {
        const files = [];
        for (const file of packageSkill.files) {
          const relativePath = assertZipEntryPathSafe(file.relativePath);
          const filePath = path.join(packageDirectory, 'skills', packageSkill.slug, ...relativePath.split('/'));
          const content = await readFile(filePath, 'utf8');

          await input.contentStore.writeBlob(content);
          files.push({ relativePath, content });
        }

        skills.push(
          skillRepository.createSkill({
            slug: packageSkill.slug,
            name: packageSkill.name,
            description: packageSkill.description,
            tags: packageSkill.tags,
            source: {
              type: 'collection-package',
              url: packageDirectory,
              trustLevel: 'user'
            },
            files
          })
        );
      }

      const collection = createCollectionRecord(input.database, {
        name: manifest.name,
        description: manifest.description,
        skillIds: skills.map((skill) => skill.id)
      });

      return { collection, skills };
    }
  };
}

function createCollectionRecord(
  database: SqliteDatabase,
  input: CreateCollectionInput
): CollectionRecord {
  const id = randomUUID();
  const create = database.transaction(() => {
    database
      .prepare('insert into collections (id, name, description) values (?, ?, ?)')
      .run(id, input.name, input.description);

    const insertItem = database.prepare('insert into collection_items (collection_id, skill_id) values (?, ?)');
    for (const skillId of input.skillIds) {
      insertItem.run(id, skillId);
    }
  });

  create();
  return { id, name: input.name, description: input.description };
}

function getCollection(database: SqliteDatabase, collectionId: string): CollectionRecord {
  const row = database
    .prepare('select id, name, description from collections where id = ?')
    .get(collectionId);

  if (!row) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  return row as CollectionRecord;
}

function getCollectionSkillRows(database: SqliteDatabase, collectionId: string): CollectionSkillRow[] {
  return database
    .prepare(
      `
        select
          s.id as skillId,
          s.name,
          s.slug,
          s.description,
          s.tags_json as tagsJson,
          sv.version_no as versionNo,
          sf.relative_path as relativePath,
          sf.blob_hash as blobHash,
          sf.file_size as fileSize
        from collection_items ci
        join skills s on s.id = ci.skill_id
        join skill_versions sv on sv.skill_id = s.id
        join skill_files sf on sf.skill_version_id = sv.id
        where ci.collection_id = @collectionId
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = s.id
          )
        order by s.name collate nocase, sf.relative_path collate nocase
      `
    )
    .all({ collectionId }) as CollectionSkillRow[];
}
