import { createHash, randomUUID } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export interface CreateSkillInput {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  source: {
    type: string;
    url: string | null;
    trustLevel: string;
  };
  files: Array<{
    relativePath: string;
    content: string;
  }>;
}

export interface SkillRecord {
  id: string;
  versionId: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  versionNo: number;
}

export interface UpdateSkillMetadataInput {
  name: string;
  description: string;
  tags: string[];
}

export interface SkillRepository {
  createSkill(input: CreateSkillInput): SkillRecord;
  listSkills(): SkillRecord[];
  getSkill(skillId: string): SkillRecord | null;
  updateSkillMetadata(skillId: string, input: UpdateSkillMetadataInput): void;
  searchSkills(query: string, options?: { favoritesOnly?: boolean }): SkillRecord[];
  setFavorite(skillId: string, favorite: boolean): void;
  listFavorites(): SkillRecord[];
  deleteSkill(skillId: string): void;
}

export function createSkillRepository(database: SqliteDatabase): SkillRepository {
  return {
    createSkill(input) {
      const skillId = randomUUID();
      const sourceId = randomUUID();
      const versionId = randomUUID();
      const manifest = input.files.find((file) => file.relativePath === 'SKILL.md');
      const manifestHash = hashContent(manifest?.content ?? input.name);

      const create = database.transaction(() => {
        database
          .prepare(
            `
              insert into sources (id, source_type, url, trust_level)
              values (@id, @sourceType, @url, @trustLevel)
            `
          )
          .run({
            id: sourceId,
            sourceType: input.source.type,
            url: input.source.url,
            trustLevel: input.source.trustLevel
          });

        database
          .prepare(
            `
              insert into skills (id, slug, name, description, tags_json, canonical_source_id)
              values (@id, @slug, @name, @description, @tagsJson, @sourceId)
            `
          )
          .run({
            id: skillId,
            slug: input.slug,
            name: input.name,
            description: input.description,
            tagsJson: JSON.stringify(input.tags),
            sourceId
          });

        database
          .prepare(
            `
              insert into skill_versions (id, skill_id, version_no, change_summary, manifest_hash)
              values (@id, @skillId, 1, 'Initial import', @manifestHash)
            `
          )
          .run({
            id: versionId,
            skillId,
            manifestHash
          });

        for (const file of input.files) {
          const blobHash = hashContent(file.content);
          const contentType = contentTypeForPath(file.relativePath);

          database
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

          database
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

        refreshSkillSearch(database, skillId, input.files.map((file) => file.content).join('\n'));
      });

      create();

      const created = getSkillRecord(database, skillId);
      if (!created) {
        throw new Error(`Created skill was not found: ${skillId}`);
      }

      return created;
    },

    listSkills() {
      return database
        .prepare(
          `
            select
              s.id,
              s.slug,
              s.name,
              s.description,
              s.tags_json as tagsJson,
              sv.id as versionId,
              max(sv.version_no) as versionNo
            from skills s
            join skill_versions sv on sv.skill_id = s.id
            group by s.id
            order by s.name collate nocase
          `
        )
        .all()
        .map(skillRow);
    },

    getSkill(skillId) {
      return getSkillRecord(database, skillId);
    },

    updateSkillMetadata(skillId, input) {
      const update = database.transaction(() => {
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
            skillId,
            name: input.name,
            description: input.description,
            tagsJson: JSON.stringify(input.tags)
          });
        refreshSkillSearch(database, skillId);
      });

      update();
    },

    searchSkills(query, options = {}) {
      const ftsQuery = toFtsQuery(query);
      if (!ftsQuery) {
        return [];
      }

      return database
        .prepare(
          `
            select
              s.id,
              s.slug,
              s.name,
              s.description,
              s.tags_json as tagsJson,
              sv.id as versionId,
              max(sv.version_no) as versionNo
            from skill_search ss
            join skills s on s.id = ss.skill_id
            join skill_versions sv on sv.skill_id = s.id
            ${options.favoritesOnly ? 'join skill_favorites sfav on sfav.skill_id = s.id' : ''}
            where skill_search match @query
            group by s.id
            order by rank
          `
        )
        .all({ query: ftsQuery })
        .map(skillRow);
    },

    setFavorite(skillId, favorite) {
      if (favorite) {
        database
          .prepare('insert or ignore into skill_favorites (skill_id) values (?)')
          .run(skillId);
        return;
      }

      database.prepare('delete from skill_favorites where skill_id = ?').run(skillId);
    },

    listFavorites() {
      return database
        .prepare(
          `
            select
              s.id,
              s.slug,
              s.name,
              s.description,
              s.tags_json as tagsJson,
              sv.id as versionId,
              max(sv.version_no) as versionNo
            from skill_favorites fav
            join skills s on s.id = fav.skill_id
            join skill_versions sv on sv.skill_id = s.id
            group by s.id
            order by fav.created_at desc, s.name collate nocase
          `
        )
        .all()
        .map(skillRow);
    },

    deleteSkill(skillId) {
      const remove = database.transaction(() => {
        database.prepare('delete from skill_search where skill_id = ?').run(skillId);
        database.prepare('delete from skills where id = ?').run(skillId);
      });

      remove();
    }
  };
}

function getSkillRecord(database: SqliteDatabase, skillId: string): SkillRecord | null {
  const row = database
    .prepare(
      `
        select
          s.id,
          s.slug,
          s.name,
          s.description,
          s.tags_json as tagsJson,
          sv.id as versionId,
          max(sv.version_no) as versionNo
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        where s.id = ?
        group by s.id
      `
    )
    .get(skillId);

  return row ? skillRow(row) : null;
}

function refreshSkillSearch(database: SqliteDatabase, skillId: string, fileContent?: string): void {
  const existing = database
    .prepare('select file_content as fileContent from skill_search where skill_id = ? limit 1')
    .get(skillId) as { fileContent: string } | undefined;
  const row = database
    .prepare(
      `
        select
          s.id,
          s.name,
          s.description,
          s.tags_json as tagsJson,
          group_concat(sf.relative_path, ' ') as filePaths
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        left join skill_files sf on sf.skill_version_id = sv.id
        where s.id = ?
        group by s.id
      `
    )
    .get(skillId);

  if (!row) {
    return;
  }

  const search = searchRow(row);
  database.prepare('delete from skill_search where skill_id = ?').run(skillId);
  database
    .prepare(
      `
        insert into skill_search (skill_id, name, description, tags, file_paths, file_content)
        values (@skillId, @name, @description, @tags, @filePaths, @fileContent)
      `
    )
    .run({
      skillId,
      name: search.name,
      description: search.description,
      tags: JSON.parse(search.tagsJson).join(' '),
      filePaths: search.filePaths ?? '',
      fileContent: fileContent ?? existing?.fileContent ?? ''
    });
}

function skillRow(row: unknown): SkillRecord {
  const typed = row as {
    id: string;
    slug: string;
    name: string;
    description: string;
    tagsJson: string;
    versionId: string;
    versionNo: number;
  };

  return {
    id: typed.id,
    versionId: typed.versionId,
    slug: typed.slug,
    name: typed.name,
    description: typed.description,
    tags: JSON.parse(typed.tagsJson),
    versionNo: typed.versionNo
  };
}

function searchRow(row: unknown): {
  id: string;
  name: string;
  description: string;
  tagsJson: string;
  filePaths: string | null;
} {
  return row as {
    id: string;
    name: string;
    description: string;
    tagsJson: string;
    filePaths: string | null;
  };
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

function toFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(' ');
}
