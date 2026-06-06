import { createHash, randomUUID } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export type SkillSearchMode = 'fts' | 'semantic' | 'hybrid';

export interface SkillSearchFilters {
  sourceTypes?: string[] | undefined;
  riskStatuses?: string[] | undefined;
  agentCodes?: string[] | undefined;
  tags?: string[] | undefined;
  favoritesOnly?: boolean | undefined;
}

export interface SkillSearchOptions {
  favoritesOnly?: boolean | undefined;
  mode?: SkillSearchMode | undefined;
  filters?: SkillSearchFilters | undefined;
}

export interface LibraryFacetValue {
  value: string;
  count: number;
}

export interface LibraryFacets {
  sources: LibraryFacetValue[];
  risks: LibraryFacetValue[];
  agents: LibraryFacetValue[];
  tags: LibraryFacetValue[];
  favorites: LibraryFacetValue;
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
  files: SkillFileInput[];
}

export interface SkillFileInput {
  relativePath: string;
  content?: string;
  contentBuffer?: Buffer;
  searchableContent?: string;
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
  getFacets(filters?: SkillSearchFilters): LibraryFacets;
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
      const manifestHash = manifest ? hashContent(fileBuffer(manifest)) : hashContent(input.name);

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
          const content = fileBuffer(file);
          const blobHash = hashContent(content);
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
              size: content.byteLength,
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
              fileSize: content.byteLength,
              contentType
            });
        }

        refreshSkillSearchIndexes(database, skillId, searchableFileContent(input.files));
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
      const mode = options.mode ?? 'fts';
      if (!normalizedQuery) {
        return listSearchCandidates(database, options.filters, options.favoritesOnly).map((candidate) => candidate.skill);
      }

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

    getFacets(filters = {}) {
      return facetCounts(listSearchCandidates(database, filters));
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
  const candidates = new Map(
    listSearchCandidates(database, options.filters, options.favoritesOnly).map((candidate) => [
      candidate.skill.id,
      candidate.skill
    ])
  );

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
    .map(skillRow)
    .filter((skill) => candidates.has(skill.id))
    .map((skill) => candidates.get(skill.id) ?? skill);
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

  return listSearchCandidates(database, options.filters, options.favoritesOnly)
    .map((candidate) => {
      const documentVector = candidate.tokensJson ? parseSimilarityTokens(candidate.tokensJson) : null;
      return {
        skill: candidate.skill,
        score: documentVector ? similarityScore(queryVector, documentVector) : 0
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

interface SearchCandidate {
  skill: SkillRecord;
  sourceType: string;
  riskStatus: string;
  agentCodes: string[];
  tags: string[];
  tokensJson: string | null;
}

function listSearchCandidates(
  database: SqliteDatabase,
  filters: SkillSearchFilters = {},
  favoritesOnly?: boolean
): SearchCandidate[] {
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
          sv.version_no as versionNo,
          coalesce(src.source_type, 'unknown') as sourceType,
          case when sfav.skill_id is null then 0 else 1 end as favorite,
          (
            select group_concat(distinct a.code)
            from installations i
            join agent_roots ar on ar.id = i.agent_root_id
            join agents a on a.id = ar.agent_id
            where i.skill_id = s.id
              and i.status != 'uninstalled'
          ) as agentCodesCsv,
          coalesce(
            (
              select case when ss.blocked = 1 then 'blocked' else ss.level end
              from security_scans ss
              join skill_versions scan_sv on scan_sv.id = ss.skill_version_id
              where scan_sv.skill_id = s.id
              order by ss.scanned_at desc, ss.id desc
              limit 1
            ),
            'unscanned'
          ) as riskStatus,
          si.tokens_json as tokensJson
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        left join sources src on src.id = s.canonical_source_id
        left join skill_favorites sfav on sfav.skill_id = s.id
        left join skill_similarity_index si on si.skill_id = s.id
        where sv.version_no = (
          select max(version_no)
          from skill_versions
          where skill_id = s.id
        )
        order by s.name collate nocase
      `
    )
    .all()
    .map(searchCandidateRow)
    .filter((candidate) => matchesSearchFilters(candidate, filters, favoritesOnly));
}

function searchCandidateRow(row: unknown): SearchCandidate {
  const typed = row as {
    sourceType: string;
    riskStatus: string;
    agentCodesCsv: string | null;
    tokensJson: string | null;
  };
  const skill = skillRow(row);
  return {
    skill,
    sourceType: typed.sourceType,
    riskStatus: typed.riskStatus,
    agentCodes: splitCsv(typed.agentCodesCsv),
    tags: skill.tags,
    tokensJson: typed.tokensJson
  };
}

function matchesSearchFilters(
  candidate: SearchCandidate,
  filters: SkillSearchFilters,
  favoritesOnly = false
): boolean {
  if ((favoritesOnly || filters.favoritesOnly) && !candidate.skill.favorite) {
    return false;
  }
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes(candidate.sourceType)) {
    return false;
  }
  if (filters.riskStatuses?.length && !filters.riskStatuses.includes(candidate.riskStatus)) {
    return false;
  }
  if (filters.agentCodes?.length && !filters.agentCodes.some((agentCode) => candidate.agentCodes.includes(agentCode))) {
    return false;
  }
  if (filters.tags?.length && !filters.tags.every((tag) => candidate.tags.includes(tag))) {
    return false;
  }
  return true;
}

function facetCounts(candidates: SearchCandidate[]): LibraryFacets {
  return {
    sources: countFacet(candidates.flatMap((candidate) => [candidate.sourceType])),
    risks: countFacet(candidates.flatMap((candidate) => [candidate.riskStatus])),
    agents: countFacet(candidates.flatMap((candidate) => candidate.agentCodes)),
    tags: countFacet(candidates.flatMap((candidate) => candidate.tags)),
    favorites: {
      value: 'favorites',
      count: candidates.filter((candidate) => candidate.skill.favorite).length
    }
  };
}

function countFacet(values: string[]): LibraryFacetValue[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function splitCsv(input: string | null): string[] {
  return input?.split(',').filter(Boolean) ?? [];
}

function parseSimilarityTokens(tokensJson: string): Array<[string, number]> | null {
  try {
    const parsed = JSON.parse(tokensJson) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const tokens: Array<[string, number]> = [];
    for (const entry of parsed) {
      if (
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'number'
      ) {
        tokens.push([entry[0], entry[1]]);
      }
    }
    return tokens;
  } catch {
    return null;
  }
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

function hashContent(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileBuffer(file: SkillFileInput): Buffer {
  if (file.contentBuffer) {
    return file.contentBuffer;
  }

  if (file.content !== undefined) {
    return Buffer.from(file.content);
  }

  return Buffer.alloc(0);
}

function searchableFileContent(files: SkillFileInput[]): string {
  return files
    .map((file) => file.searchableContent ?? file.content ?? '')
    .filter((content) => content.length > 0)
    .join('\n');
}

function storagePathForHash(hash: string): string {
  return `${hash.slice(0, 2)}/${hash}`;
}

function contentTypeForPath(relativePath: string): string {
  const extension = relativePath.toLowerCase().split('.').pop() ?? '';
  const contentTypes: Record<string, string> = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    js: 'text/javascript',
    cjs: 'text/javascript',
    mjs: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    jsx: 'text/javascript',
    py: 'text/x-python',
    sh: 'text/x-shellscript',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml'
  };
  return contentTypes[extension] ?? 'application/octet-stream';
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
