import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { SqliteDatabase } from '@theopenhub/db';

import { parseSkillManifest } from './skill-parser';

const execFileAsync = promisify(execFile);

export type DiscoverSourceType = 'local' | 'git';
export type MigrationAdapter = 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';

export interface DiscoverSource {
  id: string;
  name: string;
  sourceType: DiscoverSourceType;
  url: string;
  trustLevel: string;
  verified: boolean;
  status: string;
  cachedAt: string | null;
}

export interface DiscoverSkillPreview {
  name: string;
  description: string;
  tags: string[];
  path: string;
  riskStatus: string;
  selected?: boolean;
  importLabel?: string;
  warnings?: string[];
}

export interface DiscoverPreviewResult {
  source: DiscoverSource;
  skills: DiscoverSkillPreview[];
  writesPlanned: false;
}

export interface MigrationPreviewResult {
  adapter: MigrationAdapter;
  sourcePath: string;
  skills: DiscoverSkillPreview[];
  writesPlanned: false;
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
    trustLevel: string;
  }): DiscoverSource;
  listSources(): DiscoverSource[];
  previewSource(input: { sourceId: string }): Promise<DiscoverPreviewResult>;
  previewMigration(input: { adapter: MigrationAdapter; sourcePath: string }): Promise<MigrationPreviewResult>;
}

interface DiscoverSourceRow {
  id: string;
  name: string;
  sourceType: DiscoverSourceType;
  url: string;
  trustLevel: string;
  verified: number;
  status: string;
  cachedAt: string | null;
}

export function createDiscoverService(input: CreateDiscoverServiceInput): DiscoverService {
  return {
    addSource({ name, sourceType, url, trustLevel }) {
      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into discover_sources
              (id, name, source_type, url, trust_level, verified, status)
            values
              (@id, @name, @sourceType, @url, @trustLevel, @verified, 'configured')
          `
        )
        .run({
          id,
          name,
          sourceType,
          url,
          trustLevel,
          verified: trustLevel === 'verified' || trustLevel === 'curated' ? 1 : 0
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
              trust_level as trustLevel,
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
        writesPlanned: false
      };
    },

    async previewMigration({ adapter, sourcePath }) {
      const roots = await migrationRoots(adapter, sourcePath);
      const skills = addMigrationSelectionMetadata(
        await Promise.all(roots.map((root) => previewSkillDirectory(root)))
      );

      return {
        adapter,
        sourcePath,
        skills,
        writesPlanned: false
      };
    }
  };
}

function addMigrationSelectionMetadata(
  previewGroups: DiscoverSkillPreview[][]
): DiscoverSkillPreview[] {
  const skills = previewGroups.flat().sort((left, right) => left.name.localeCompare(right.name));
  const labelCounts = new Map<string, number>();
  for (const skill of skills) {
    const label = slugify(skill.name);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return skills.map((skill) => {
    const importLabel = slugify(skill.name);
    const warnings = labelCounts.get(importLabel)! > 1 ? ['duplicate-import-label'] : [];
    return {
      ...skill,
      selected: true,
      importLabel,
      warnings
    };
  });
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

async function migrationRoots(adapter: MigrationAdapter, sourcePath: string): Promise<string[]> {
  if (adapter === 'skillhub') {
    const skillsDirectory = path.join(sourcePath, 'skills');
    return (await pathExists(skillsDirectory)) ? [skillsDirectory] : [sourcePath];
  }

  if (adapter === 'skills-manager' || adapter === 'skills-manager-client') {
    return configuredSkillPaths(sourcePath);
  }

  return [sourcePath];
}

async function configuredSkillPaths(sourcePath: string): Promise<string[]> {
  const stats = await stat(sourcePath);
  if (stats.isDirectory()) {
    return [sourcePath];
  }

  const content = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown;
  const paths = extractPathList(content);
  return paths.length > 0 ? paths : [path.dirname(sourcePath)];
}

function extractPathList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(extractPathValue);
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  const record = input as Record<string, unknown>;
  return ['skillPaths', 'paths', 'skills', 'directories']
    .flatMap((key) => {
      const value = record[key];
      return Array.isArray(value) ? value.flatMap(extractPathValue) : [];
    })
    .filter((candidate, index, values) => values.indexOf(candidate) === index);
}

function extractPathValue(input: unknown): string[] {
  if (typeof input === 'string' && input.trim().length > 0) {
    return [input];
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  const record = input as Record<string, unknown>;
  return typeof record.path === 'string' && record.path.trim().length > 0 ? [record.path] : [];
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
      path: skillDirectory,
      riskStatus: 'unscanned'
    };
  } catch {
    return {
      name: path.basename(skillDirectory),
      description: '',
      tags: [],
      path: skillDirectory,
      riskStatus: 'malformed'
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
          (id, source_id, skill_name, description, tags_json, skill_path, risk_status)
        values
          (@id, @sourceId, @skillName, @description, @tagsJson, @skillPath, @riskStatus)
      `
    );

    for (const skill of skills) {
      insert.run({
        id: randomUUID(),
        sourceId,
        skillName: skill.name,
        description: skill.description,
        tagsJson: JSON.stringify(skill.tags),
        skillPath: skill.path,
        riskStatus: skill.riskStatus
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
          trust_level as trustLevel,
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
    trustLevel: source.trustLevel,
    verified: source.verified === 1,
    status: source.status,
    cachedAt: source.cachedAt
  };
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'skill';
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
