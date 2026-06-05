import { createHash, randomUUID } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export type SkillSearchMode = 'fts' | 'semantic' | 'hybrid';

export interface SkillSearchOptions {
  favoritesOnly?: boolean;
  mode?: SkillSearchMode;
}

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
  favorite: boolean;
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
  searchSkills(query: string, options?: SkillSearchOptions): SkillRecord[];
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

        refreshSkillSearchIndexes(database, skillId, input.files.map((file) => file.content).join('\n'));
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
              max(sv.version_no) as versionNo,
              case when sfav.skill_id is null then 0 else 1 end as favorite
            from skills s
            join skill_versions sv on sv.skill_id = s.id
            left join skill_favorites sfav on sfav.skill_id = s.id
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
        refreshSkillSearchIndexes(database, skillId);
      });

      update();
    },

    searchSkills(query, options = {}) {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return [];
      }

      const mode = options.mode ?? 'fts';
      if (mode === 'fts') {
        return searchFts(database, normalizedQuery, options);
      }

      if (mode === 'semantic') {
        return searchSemantic(database, normalizedQuery, options);
      }

      const results = new Map<string, SkillRecord>();
      for (const skill of searchFts(database, normalizedQuery, options)) {
        results.set(skill.id, skill);
      }
      for (const skill of searchSemantic(database, normalizedQuery, options)) {
        if (!results.has(skill.id)) {
          results.set(skill.id, skill);
        }
      }
      return [...results.values()];
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
              max(sv.version_no) as versionNo,
              1 as favorite
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
        database.prepare('delete from skill_similarity_index where skill_id = ?').run(skillId);
        database.prepare('delete from skills where id = ?').run(skillId);
      });

      remove();
    }
  };
}

export function refreshSkillSearchIndexes(
  database: SqliteDatabase,
  skillId: string,
  fileContent?: string
): void {
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
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = s.id
          )
        group by s.id
      `
    )
    .get(skillId);

  if (!row) {
    return;
  }

  const search = searchRow(row);
  const content = fileContent ?? existing?.fileContent ?? '';
  const tags = JSON.parse(search.tagsJson) as string[];
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
      tags: tags.join(' '),
      filePaths: search.filePaths ?? '',
      fileContent: content
    });
  database
    .prepare(
      `
        insert into skill_similarity_index (skill_id, tokens_json, updated_at)
        values (@skillId, @tokensJson, current_timestamp)
        on conflict(skill_id) do update set
          tokens_json = excluded.tokens_json,
          updated_at = current_timestamp
      `
    )
    .run({
      skillId,
      tokensJson: JSON.stringify(
        weightedTokenEntries([
          { text: search.name, weight: 4 },
          { text: search.description, weight: 3 },
          { text: tags.join(' '), weight: 5 },
          { text: search.filePaths ?? '', weight: 2 },
          { text: content, weight: 1 }
        ])
      )
    });
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
          max(sv.version_no) as versionNo,
          case when sfav.skill_id is null then 0 else 1 end as favorite
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        left join skill_favorites sfav on sfav.skill_id = s.id
        where s.id = ?
        group by s.id
      `
    )
    .get(skillId);

  return row ? skillRow(row) : null;
}

function searchFts(
  database: SqliteDatabase,
  query: string,
  options: SkillSearchOptions
): SkillRecord[] {
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
          max(sv.version_no) as versionNo,
          case when sfav.skill_id is null then 0 else 1 end as favorite
        from skill_search ss
        join skills s on s.id = ss.skill_id
        join skill_versions sv on sv.skill_id = s.id
        left join skill_favorites sfav on sfav.skill_id = s.id
        where skill_search match @query
          ${options.favoritesOnly ? 'and sfav.skill_id is not null' : ''}
        group by s.id
        order by rank
      `
    )
    .all({ query: ftsQuery })
    .map(skillRow);
}

function searchSemantic(
  database: SqliteDatabase,
  query: string,
  options: SkillSearchOptions
): SkillRecord[] {
  const queryVector = weightedTokenEntries([{ text: query, weight: 1 }]);
  if (queryVector.length === 0) {
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
          max(sv.version_no) as versionNo,
          case when sfav.skill_id is null then 0 else 1 end as favorite,
          si.tokens_json as tokensJson
        from skill_similarity_index si
        join skills s on s.id = si.skill_id
        join skill_versions sv on sv.skill_id = s.id
        left join skill_favorites sfav on sfav.skill_id = s.id
        where 1 = 1
          ${options.favoritesOnly ? 'and sfav.skill_id is not null' : ''}
        group by s.id
      `
    )
    .all()
    .map((row) => {
      const typed = row as { tokensJson: string };
      return {
        skill: skillRow(row),
        score: similarityScore(queryVector, JSON.parse(typed.tokensJson) as Array<[string, number]>)
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return left.skill.name.localeCompare(right.skill.name);
    })
    .map((result) => result.skill);
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
    favorite: number;
  };

  return {
    id: typed.id,
    versionId: typed.versionId,
    slug: typed.slug,
    name: typed.name,
    description: typed.description,
    tags: JSON.parse(typed.tagsJson),
    versionNo: typed.versionNo,
    favorite: typed.favorite === 1
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

function weightedTokenEntries(inputs: Array<{ text: string; weight: number }>): Array<[string, number]> {
  const weights = new Map<string, number>();
  for (const input of inputs) {
    for (const token of tokenize(input.text)) {
      for (const expanded of expandToken(token)) {
        weights.set(expanded.token, (weights.get(expanded.token) ?? 0) + input.weight * expanded.weight);
      }
    }
  }
  return [...weights.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.map(normalizeToken)
    .filter((token) => token.length >= 2) ?? [];
}

function normalizeToken(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) {
    return token.slice(0, -3);
  }
  if (token.length > 4 && token.endsWith('ed')) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

function expandToken(token: string): Array<{ token: string; weight: number }> {
  const synonyms: Record<string, string[]> = {
    db: ['database', 'sqlite', 'sql'],
    database: ['db', 'sqlite', 'sql'],
    sqlite: ['database', 'db', 'sql'],
    migration: ['import', 'port'],
    import: ['migration'],
    security: ['safety', 'protect'],
    safety: ['security', 'protect'],
    package: ['bundle', 'archive', 'export'],
    bundle: ['package', 'archive', 'export'],
    archive: ['package', 'bundle', 'export']
  };
  return [
    { token, weight: 1 },
    ...(synonyms[token] ?? []).map((synonym) => ({ token: synonym, weight: 0.75 }))
  ];
}

function similarityScore(
  queryVector: Array<[string, number]>,
  documentVector: Array<[string, number]>
): number {
  const documentWeights = new Map(documentVector);
  return queryVector.reduce((score, [token, queryWeight]) => {
    return score + queryWeight * (documentWeights.get(token) ?? 0);
  }, 0);
}
