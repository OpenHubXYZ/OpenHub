import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createLibraryRepository, createMemoryDatabase, createSkillRepository, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createInstallService } from './install-service';

const tempDirectories: string[] = [];

describe('install service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it('creates copy and symlink plans with clean and conflicting writes', async () => {
    const context = await createInstallContext('plan-helper');
    const copyPlan = await context.install.createPlan({
      skillId: context.skillId,
      targetRoot: context.targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'copy'
    });

    expect(copyPlan).toMatchObject({
      status: 'ready',
      skillId: context.skillId,
      projectionMode: 'copy',
      targetSkillPath: path.join(context.targetRoot, 'plan-helper')
    });
    expect(copyPlan.writes).toEqual([
      expect.objectContaining({ relativePath: 'SKILL.md', action: 'copy', status: 'clean' }),
      expect.objectContaining({ relativePath: 'references/guide.md', action: 'copy', status: 'clean' })
    ]);

    await mkdir(path.join(context.targetRoot, 'plan-helper'), { recursive: true });
    await writeFile(path.join(context.targetRoot, 'plan-helper', 'SKILL.md'), 'existing user content');

    const symlinkPlan = await context.install.createPlan({
      skillId: context.skillId,
      targetRoot: context.targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'symlink'
    });

    expect(symlinkPlan.status).toBe('conflict');
    expect(symlinkPlan.writes).toEqual([
      expect.objectContaining({ relativePath: 'SKILL.md', action: 'symlink', status: 'conflict' }),
      expect.objectContaining({ relativePath: 'references/guide.md', action: 'symlink', status: 'clean' })
    ]);
  });

  it('blocks unconfirmed conflicts and overwrites only planned conflicting files when confirmed', async () => {
    const context = await createInstallContext('overwrite-helper');
    await mkdir(path.join(context.targetRoot, 'overwrite-helper'), { recursive: true });
    await writeFile(path.join(context.targetRoot, 'overwrite-helper', 'SKILL.md'), 'existing user content');
    await writeFile(path.join(context.targetRoot, 'overwrite-helper', 'user-note.md'), 'preserve me');
    const plan = await context.install.createPlan({
      skillId: context.skillId,
      targetRoot: context.targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'copy'
    });

    await expect(context.install.applyPlan({ plan, confirmOverwrite: false })).rejects.toMatchObject({
      code: 'conflict_requires_overwrite'
    });

    const result = await context.install.applyPlan({ plan, confirmOverwrite: true });

    expect(result).toMatchObject({ status: 'installed', installationId: expect.any(String) });
    await expect(readFile(path.join(context.targetRoot, 'overwrite-helper', 'SKILL.md'), 'utf8')).resolves.toContain(
      'overwrite-helper'
    );
    await expect(readFile(path.join(context.targetRoot, 'overwrite-helper', 'user-note.md'), 'utf8')).resolves.toBe(
      'preserve me'
    );
    expect(countRows(context.database, 'installation_files')).toBe(2);
  });

  it('rejects unexpected conflicts that were not present in the plan', async () => {
    const context = await createInstallContext('stale-plan-helper');
    const plan = await context.install.createPlan({
      skillId: context.skillId,
      targetRoot: context.targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'copy'
    });
    await mkdir(path.join(context.targetRoot, 'stale-plan-helper'), { recursive: true });
    await writeFile(path.join(context.targetRoot, 'stale-plan-helper', 'SKILL.md'), 'created after plan');

    await expect(context.install.applyPlan({ plan, confirmOverwrite: true })).rejects.toMatchObject({
      code: 'unexpected_target_conflict'
    });
  });

  it('uninstalls only app-owned files and hides the app-owned location from normal library listings', async () => {
    const context = await createInstallContext('uninstall-helper');
    const plan = await context.install.createPlan({
      skillId: context.skillId,
      targetRoot: context.targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'copy'
    });
    const installed = await context.install.applyPlan({ plan, confirmOverwrite: false });
    await writeFile(path.join(context.targetRoot, 'uninstall-helper', 'user-note.md'), 'preserve me');

    await expect(context.install.uninstall({ installationId: installed.installationId })).resolves.toEqual({
      status: 'uninstalled',
      installationId: installed.installationId
    });

    await expect(lstat(path.join(context.targetRoot, 'uninstall-helper', 'SKILL.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await expect(readFile(path.join(context.targetRoot, 'uninstall-helper', 'user-note.md'), 'utf8')).resolves.toBe(
      'preserve me'
    );
    expect(context.library.listLibrarySkills()).toEqual([]);
  });

  it('rejects unsafe relative paths and directory conflicts', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const install = createInstallService({ database, contentStore });
    const unsafeSkill = createSkillRepository(database).createSkill({
      slug: 'unsafe-helper',
      name: 'unsafe-helper',
      description: 'Unsafe path fixture',
      tags: [],
      source: { type: 'local', url: null },
      files: [{ relativePath: '../escape.md', content: 'escape' }]
    });

    await expect(
      install.createPlan({
        skillId: unsafeSkill.id,
        targetRoot: path.join(workspace, 'target-root'),
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'builtin',
        scope: 'project',
        rootKind: 'project',
        projectionMode: 'copy'
      })
    ).rejects.toMatchObject({ code: 'unsafe_relative_path' });

    const context = await createInstallContext('directory-conflict-helper');
    await mkdir(path.join(context.targetRoot, 'directory-conflict-helper', 'SKILL.md'), { recursive: true });
    const plan = await context.install.createPlan({
      skillId: context.skillId,
      targetRoot: context.targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'copy'
    });

    expect(plan.status).toBe('blocked');
    expect(plan.writes).toContainEqual(
      expect.objectContaining({ relativePath: 'SKILL.md', status: 'blocked', reason: 'directory_conflict' })
    );
    await expect(context.install.applyPlan({ plan, confirmOverwrite: true })).rejects.toMatchObject({
      code: 'directory_conflict'
    });
  });
});

async function createInstallContext(name: string) {
  const workspace = await tempDir();
  const database = createMemoryDatabase();
  runMigrations(database);
  const contentStore = createContentStore(path.join(workspace, 'blobs'));
  const importer = createImportService({
    database,
    contentStore,
    stagingDirectory: path.join(workspace, 'staging')
  });
  const sourcePath = await createSkillFixture(path.join(workspace, 'source', name), name);
  const imported = await importer.importLocalFolder({ folderPath: sourcePath });
  const targetRoot = path.join(workspace, 'target-root');
  await mkdir(targetRoot, { recursive: true });

  return {
    database,
    contentStore,
    install: createInstallService({ database, contentStore }),
    library: createLibraryRepository(database),
    skillId: imported.skill.id,
    targetRoot
  };
}

async function createSkillFixture(directory: string, name: string): Promise<string> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${name}`, 'tags: [install]', '---', `# ${name}`].join('\n')
  );
  await writeFile(path.join(directory, 'references/guide.md'), `Guide for ${name}`);
  return directory;
}

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-install-'));
  tempDirectories.push(directory);
  return directory;
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  const row = database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number };
  return row.count;
}
