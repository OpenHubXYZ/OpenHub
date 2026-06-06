import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createDiscoverService } from './discover-service';

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];

describe('discover service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('adds local and Git sources, previews cached skills, and does not import on preview', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const localSourcePath = path.join(workspace, 'local-source');
    const gitSourcePath = path.join(workspace, 'git-source');
    await createSkillFixture(path.join(localSourcePath, 'path-helper'), 'Path Helper', 'Path docs lookup');
    await createGitSource(gitSourcePath, 'Git Helper');
    const discover = createDiscoverService({
      database,
      cacheDirectory: path.join(workspace, 'discover-cache')
    });

    const localSource = discover.addSource({
      name: 'Local curated',
      sourceType: 'local',
      url: localSourcePath,
      trustLevel: 'verified'
    });
    const gitSource = discover.addSource({
      name: 'Git curated',
      sourceType: 'git',
      url: `file://${gitSourcePath}`,
      trustLevel: 'user'
    });

    const localPreview = await discover.previewSource({ sourceId: localSource.id });
    const gitPreview = await discover.previewSource({ sourceId: gitSource.id });

    expect(localPreview).toMatchObject({
      source: {
        name: 'Local curated',
        status: 'cached',
        verified: true
      },
      writesPlanned: false
    });
    expect(localPreview.skills).toEqual([
      expect.objectContaining({
        name: 'Path Helper',
        description: 'Path docs lookup',
        path: path.join(localSourcePath, 'path-helper')
      })
    ]);
    expect(gitPreview.skills).toEqual([expect.objectContaining({ name: 'Git Helper' })]);
    expect(countRows(database, 'skills')).toBe(0);
    expect(countRows(database, 'discover_source_cache')).toBe(2);
  });

  it('does not expose migration preview on the discover service', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const discover = createDiscoverService({
      database,
      cacheDirectory: path.join(workspace, 'discover-cache')
    });

    expect('previewMigration' in discover).toBe(false);
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-discover-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(
  directory: string,
  name: string,
  description = `${name} description`
): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${description}`, 'tags: [discover, local]', '---', `# ${name}`].join('\n')
  );
}

async function createGitSource(directory: string, skillName: string): Promise<void> {
  await createSkillFixture(path.join(directory, 'git-helper'), skillName);
  await execFileAsync('git', ['init'], { cwd: directory });
  await execFileAsync('git', ['add', '.'], { cwd: directory });
  await execFileAsync(
    'git',
    ['-c', 'user.name=OpenHub Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
    { cwd: directory }
  );
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
