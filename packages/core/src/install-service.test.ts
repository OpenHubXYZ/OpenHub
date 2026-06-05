import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createInstallService } from './install-service';

const tempDirectories: string[] = [];

describe('install service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('creates a conflict plan, installs by copy projection, and uninstalls only app-owned files', async () => {
    const workspace = await tempDir();
    const source = path.join(workspace, 'source');
    const targetRoot = path.join(workspace, 'target-agent');
    const conflictTarget = path.join(targetRoot, 'install-helper');
    await mkdir(path.join(source, 'references'), { recursive: true });
    await mkdir(conflictTarget, { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: install-helper', 'description: Install helper', '---', '# Install Helper'].join('\n')
    );
    await writeFile(path.join(source, 'references/guide.md'), 'guide');
    await writeFile(path.join(conflictTarget, 'SKILL.md'), 'existing user file');
    await writeFile(path.join(conflictTarget, 'user-note.md'), 'do not remove');

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const installer = createInstallService({ database, contentStore });

    const conflictPlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    expect(conflictPlan.conflictState).toBe('conflict');
    expect(conflictPlan.writes[0]).toEqual(expect.objectContaining({ conflict: 'exists' }));
    await expect(installer.applyInstallPlan(conflictPlan)).rejects.toThrow(/conflicts/);

    await rm(path.join(conflictTarget, 'SKILL.md'));
    const cleanPlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    expect(cleanPlan.conflictState).toBe('clean');
    const result = await installer.applyInstallPlan(cleanPlan);
    expect(result.status).toBe('installed');
    expect(result.installationId).not.toBeNull();
    await expect(readFile(path.join(conflictTarget, 'SKILL.md'), 'utf8')).resolves.toContain(
      'Install Helper'
    );

    await installer.uninstall({ installationId: result.installationId! });
    await expect(readFile(path.join(conflictTarget, 'user-note.md'), 'utf8')).resolves.toBe(
      'do not remove'
    );
    await expect(readFile(path.join(conflictTarget, 'SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('plans project roots, multi-target installs, and explicit projection modes', async () => {
    const workspace = await tempDir();
    const source = path.join(workspace, 'source');
    const cleanRoot = path.join(workspace, 'codex-user');
    const conflictRoot = path.join(workspace, 'codex-project');
    const symlinkRoot = path.join(workspace, 'symlink-root');
    const mirrorRoot = path.join(workspace, 'mirror-root');
    await mkdir(source, { recursive: true });
    await mkdir(path.join(conflictRoot, 'project-helper'), { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      ['---', 'name: project-helper', 'description: Project helper', '---', '# Project Helper'].join('\n')
    );
    await writeFile(path.join(conflictRoot, 'project-helper/SKILL.md'), 'user-owned conflict');

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const installer = createInstallService({ database, contentStore });

    const plans = await installer.createMultiTargetInstallPlan({
      skillId: imported.skill.id,
      projectionMode: 'copy',
      targets: [
        {
          targetRoot: cleanRoot,
          agentCode: 'codex',
          agentDisplayName: 'Codex',
          adapterVersion: 'test',
          scope: 'user',
          rootKind: 'user'
        },
        {
          targetRoot: conflictRoot,
          agentCode: 'codex',
          agentDisplayName: 'Codex',
          adapterVersion: 'test',
          scope: 'project',
          rootKind: 'project'
        }
      ]
    });

    expect(plans.map((plan) => [plan.targetRoot, plan.rootKind, plan.conflictState])).toEqual([
      [cleanRoot, 'user', 'clean'],
      [conflictRoot, 'project', 'conflict']
    ]);

    const multiResult = await installer.applyMultiTargetInstallPlan({ plans });
    expect(multiResult.installed).toEqual([expect.objectContaining({ targetRoot: cleanRoot })]);
    expect(multiResult.blocked).toEqual([expect.objectContaining({ targetRoot: conflictRoot })]);
    await expect(readFile(path.join(cleanRoot, 'project-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'Project Helper'
    );
    await expect(readFile(path.join(conflictRoot, 'project-helper/SKILL.md'), 'utf8')).resolves.toBe(
      'user-owned conflict'
    );

    await expect(
      installer.createInstallPlan({
        skillId: imported.skill.id,
        targetRoot: path.join(workspace, 'invalid-mode'),
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'test',
        scope: 'user',
        projectionMode: 'bad-mode' as never
      })
    ).rejects.toThrow(/projection mode/);

    const symlinkPlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot: symlinkRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user',
      projectionMode: 'symlink'
    });
    const symlinkInstall = await installer.applyInstallPlan(symlinkPlan);
    expect(symlinkInstall.status).toBe('installed');
    await expect(lstat(path.join(symlinkRoot, 'project-helper/SKILL.md'))).resolves.toMatchObject({
      isSymbolicLink: expect.any(Function)
    });
    expect((await lstat(path.join(symlinkRoot, 'project-helper/SKILL.md'))).isSymbolicLink()).toBe(true);

    const mirrorPlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot: mirrorRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user',
      projectionMode: 'mirror-export'
    });
    const beforeMirrorRows = countRows(database, 'installations');
    const mirrorResult = await installer.applyInstallPlan(mirrorPlan);

    expect(mirrorResult).toMatchObject({ status: 'exported', installationId: null });
    expect(countRows(database, 'installations')).toBe(beforeMirrorRows);
    await expect(readFile(path.join(mirrorRoot, 'project-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'Project Helper'
    );
  });

  it('checks compatibility, reinstalls, relinks, and locks app-owned installations', async () => {
    const workspace = await tempDir();
    const source = path.join(workspace, 'source');
    const codexRoot = path.join(workspace, 'codex-root');
    const claudeRoot = path.join(workspace, 'claude-root');
    const relinkRoot = path.join(workspace, 'codex-relinked');
    await mkdir(path.join(source, 'references'), { recursive: true });
    await writeFile(
      path.join(source, 'SKILL.md'),
      [
        '---',
        'name: compat-helper',
        'description: Compatibility helper',
        'supported_agents:',
        '  - codex',
        '---',
        '# Compat Helper'
      ].join('\n')
    );
    await writeFile(path.join(source, 'references/guide.md'), 'codex guide');

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({ folderPath: source });
    const installer = createInstallService({ database, contentStore });

    await expect(
      installer.checkCompatibility({
        skillId: imported.skill.id,
        targetRoot: codexRoot,
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'test',
        scope: 'user'
      })
    ).resolves.toMatchObject({
      status: 'compatible',
      supportedAgents: ['codex']
    });

    const incompatiblePlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot: claudeRoot,
      agentCode: 'claude',
      agentDisplayName: 'Claude',
      adapterVersion: 'test',
      scope: 'user'
    });
    await expect(installer.applyInstallPlan(incompatiblePlan)).rejects.toThrow(/incompatible/i);
    await expect(readFile(path.join(claudeRoot, 'compat-helper/SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    });

    const compatiblePlan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot: codexRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });
    const installed = await installer.applyInstallPlan(compatiblePlan);
    const installationId = installed.installationId!;
    const installedManifest = path.join(codexRoot, 'compat-helper/SKILL.md');
    const userNote = path.join(codexRoot, 'compat-helper/user-note.md');
    await writeFile(installedManifest, 'corrupted app-owned file');
    await writeFile(userNote, 'keep user note');

    await expect(installer.reinstall({ installationId })).resolves.toMatchObject({
      status: 'reinstalled',
      installationId
    });
    await expect(readFile(installedManifest, 'utf8')).resolves.toContain('Compat Helper');
    await expect(readFile(userNote, 'utf8')).resolves.toBe('keep user note');

    await expect(installer.setReadOnlyLock({ installationId, locked: true })).resolves.toEqual({
      status: 'locked',
      installationId,
      readOnlyLocked: true
    });
    await expect(installer.reinstall({ installationId })).rejects.toThrow(/read-only locked/);
    await expect(
      installer.relink({
        installationId,
        targetRoot: relinkRoot,
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'test',
        scope: 'user',
        projectionMode: 'copy'
      })
    ).rejects.toThrow(/read-only locked/);
    await expect(installer.uninstall({ installationId })).rejects.toThrow(/read-only locked/);

    await expect(installer.setReadOnlyLock({ installationId, locked: false })).resolves.toEqual({
      status: 'unlocked',
      installationId,
      readOnlyLocked: false
    });
    await expect(
      installer.relink({
        installationId,
        targetRoot: relinkRoot,
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'test',
        scope: 'user',
        projectionMode: 'copy'
      })
    ).resolves.toMatchObject({
      status: 'relinked',
      installationId,
      targetRoot: relinkRoot,
      projectionMode: 'copy'
    });
    await expect(readFile(installedManifest, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(userNote, 'utf8')).resolves.toBe('keep user note');
    await expect(readFile(path.join(relinkRoot, 'compat-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'Compat Helper'
    );
    expect(
      database
        .prepare(
          `
            select ar.root_path as rootPath,
                   i.projection_mode as projectionMode,
                   i.read_only_locked as readOnlyLocked
            from installations i
            join agent_roots ar on ar.id = i.agent_root_id
            where i.id = ?
          `
        )
        .get(installationId)
    ).toEqual({
      rootPath: relinkRoot,
      projectionMode: 'copy',
      readOnlyLocked: 0
    });

    await installer.uninstall({ installationId });
    await expect(readFile(path.join(relinkRoot, 'compat-helper/SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await expect(readFile(userNote, 'utf8')).resolves.toBe('keep user note');
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-install-'));
  tempDirectories.push(directory);
  return directory;
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
