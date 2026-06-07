import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { SqliteDatabase } from '@theopenhub/db';

import { parseSkillManifest } from './skill-parser';

const execFileAsync = promisify(execFile);

export type DiscoverSourceType = 'local' | 'git';

export interface DiscoverSource {
  id: string;
  name: string;
  sourceType: DiscoverSourceType;
  url: string;
  verified: boolean;
  status: string;
  cachedAt: string | null;
}

export interface DiscoverSkillPreview {
  name: string;
  description: string;
  tags: string[];
  path: string;
  selected?: boolean;
  importLabel?: string;
}

export interface DiscoverPreviewResult {
  source: DiscoverSource;
  skills: DiscoverSkillPreview[];
  cachedAt: string;
}

export interface CreateDiscoverServiceInput {
  database: SqliteDatabase;
  cacheDirectory: string;
}

export interface DiscoverService {
  addSource(input: {
    name: string;
    sourceType: DiscoverSourceType;
    url: string;
  }): DiscoverSource;
  listSources(): DiscoverSource[];
  previewSource(input: { sourceId: string }): Promise<DiscoverPreviewResult>;
}

interface DiscoverSourceRow {
  id: string;
  name: string;
  sourceType: DiscoverSourceType;
  url: string;
  verified: number;
  status: string;
  cachedAt: string | null;
}

export function createDiscoverService(input: CreateDiscoverServiceInput): DiscoverService {
  return {
    addSource({ name, sourceType, url }) {
      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into discover_sources
              (id, name, source_type, url, verified, status)
            values
              (@id, @name, @sourceType, @url, 0, 'configured')
          `
        )
        .run({
          id,
          name,
          sourceType,
          url
        });

      return getSource(input.database, id);
    },

    listSources() {
      return input.database
        .prepare(
          `
            select
              id,
              name,
              source_type as sourceType,
              url,
              verified,
              status,
              cached_at as cachedAt
            from discover_sources
            order by created_at desc
          `
        )
        .all()
        .map(discoverSourceRow);
    },

    async previewSource({ sourceId }) {
      const source = getSource(input.database, sourceId);
      const sourceRoot =
        source.sourceType === 'git'
          ? await cloneGitSource({
              cacheDirectory: input.cacheDirectory,
              source
            })
          : source.url;
      const skills = await previewSkillDirectory(sourceRoot);
      recordCache(input.database, source.id, skills);

      return {
        source: getSource(input.database, source.id),
        skills,
        cachedAt: new Date().toISOString()
      };
    }
  };
}

async function cloneGitSource(input: {
  cacheDirectory: string;
  source: DiscoverSource;
}): Promise<string> {
  const targetDirectory = path.join(input.cacheDirectory, input.source.id);
  await rm(targetDirectory, { recursive: true, force: true });
  await mkdir(input.cacheDirectory, { recursive: true });
  await execFileAsync('git', ['clone', '--depth', '1', input.source.url, targetDirectory]);
  return targetDirectory;
}

async function previewSkillDirectory(rootDirectory: string): Promise<DiscoverSkillPreview[]> {
  const skillDirectories = await collectSkillDirectories(rootDirectory);
  const previews = await Promise.all(skillDirectories.map(previewSkill));
  return previews.sort((left, right) => left.name.localeCompare(right.name));
}

async function collectSkillDirectories(directory: string): Promise<string[]> {
  if (await pathExists(path.join(directory, 'SKILL.md'))) {
    return [directory];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const directories: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.git') {
      continue;
    }

    directories.push(...(await collectSkillDirectories(path.join(directory, entry.name))));
  }

  return directories;
}

async function previewSkill(skillDirectory: string): Promise<DiscoverSkillPreview> {
  const manifestPath = path.join(skillDirectory, 'SKILL.md');
  const content = await readFile(manifestPath, 'utf8');

  try {
    const manifest = parseSkillManifest(content, manifestPath);
    return {
      name: manifest.name,
      description: manifest.description,
      tags: manifest.tags,
      path: skillDirectory
    };
  } catch {
    return {
      name: path.basename(skillDirectory),
      description: '',
      tags: [],
      path: skillDirectory
    };
  }
}

function recordCache(
  database: SqliteDatabase,
  sourceId: string,
  skills: DiscoverSkillPreview[]
): void {
  const write = database.transaction(() => {
    database.prepare('delete from discover_source_cache where source_id = ?').run(sourceId);
    const insert = database.prepare(
      `
        insert into discover_source_cache
          (id, source_id, skill_name, description, tags_json, skill_path)
        values
          (@id, @sourceId, @skillName, @description, @tagsJson, @skillPath)
      `
    );

    for (const skill of skills) {
      insert.run({
        id: randomUUID(),
        sourceId,
        skillName: skill.name,
        description: skill.description,
        tagsJson: JSON.stringify(skill.tags),
        skillPath: skill.path
      });
    }

    database
      .prepare(
        `
          update discover_sources
          set status = 'cached',
              cached_at = current_timestamp,
              updated_at = current_timestamp
          where id = ?
        `
      )
      .run(sourceId);
  });

  write();
}

function getSource(database: SqliteDatabase, sourceId: string): DiscoverSource {
  const row = database
    .prepare(
      `
        select
          id,
          name,
          source_type as sourceType,
          url,
          verified,
          status,
          cached_at as cachedAt
        from discover_sources
        where id = ?
      `
    )
    .get(sourceId);

  if (!row) {
    throw new Error(`Discover source not found: ${sourceId}`);
  }

  return discoverSourceRow(row);
}

function discoverSourceRow(row: unknown): DiscoverSource {
  const source = row as DiscoverSourceRow;
  return {
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    url: source.url,
    verified: source.verified === 1,
    status: source.status,
    cachedAt: source.cachedAt
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}
