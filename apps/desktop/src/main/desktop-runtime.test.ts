import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDesktopRuntime } from './desktop-runtime';

const tempDirectories: string[] = [];

describe('desktop runtime IPC dispatch', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('runs the local import, install plan, install, library, security, sync, and plugin state loop', async () => {
    const workspace = await tempDir();
    const source = await createSkillFixture(path.join(workspace, 'source'), 'runtime-helper');
    const targetRoot = path.join(workspace, 'codex-skills');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });

    const imported = await runtime.dispatch('import.localFolder', { folderPath: source });
    expect(imported.skill.name).toBe('runtime-helper');

    const afterImport = await runtime.dispatch('workspace.state', {});
    expect(afterImport.skills).toEqual([
      expect.objectContaining({
        id: imported.skill.id,
        name: 'runtime-helper',
        versionNo: 1
      })
    ]);

    const plan = await runtime.dispatch('install.createPlan', {
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });
    expect(plan.conflictState).toBe('clean');
    expect(plan.writes.map((write) => write.relativePath)).toEqual(['SKILL.md', 'references/guide.md']);

    const installResult = await runtime.dispatch('install.applyPlan', { plan });
    expect(installResult.status).toBe('installed');
    await expect(readFile(path.join(targetRoot, 'runtime-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'runtime-helper'
    );

    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([
      expect.objectContaining({
        name: 'runtime-helper',
        sourceAgent: 'Codex',
        installStatus: 'installed'
      })
    ]);
    await expect(runtime.dispatch('security.scan', { skillId: imported.skill.id })).resolves.toMatchObject({
      skillId: imported.skill.id,
      level: 'safe',
      blocked: false
    });
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({
      usageCenter: {
        totals: {
          launches: 0,
          installs: 2,
          scans: 1,
          exports: 0
        },
        topSkills: [expect.objectContaining({ skillName: 'runtime-helper' })],
        recent: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'security.scan',
            label: 'Security scanned runtime-helper'
          }),
          expect.objectContaining({ eventType: 'install.apply' })
        ])
      },
      reviewCenter: {
        queue: [],
        notes: []
      }
    });
    await expect(runtime.dispatch('sync.startupPlan', {})).resolves.toEqual({
      shouldStart: false,
      enabledProfiles: []
    });
    await expect(runtime.dispatch('plugins.centerState', {})).resolves.toEqual({ plugins: [] });
  });

  it('scans detected local agent roots into the runtime library', async () => {
    const workspace = await tempDir();
    const homeDirectory = path.join(workspace, 'home');
    await createSkillFixture(path.join(homeDirectory, '.codex/skills/scanned-helper'), 'scanned-helper');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory
    });

    const scan = await runtime.dispatch('library.scan', {});

    expect(scan.indexedSkills).toEqual([
      expect.objectContaining({
        name: 'scanned-helper',
        agentCode: 'codex'
      })
    ]);
    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([
      expect.objectContaining({
        name: 'scanned-helper',
        sourceAgent: 'Codex',
        installStatus: 'installed'
      })
    ]);
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({
      usageCenter: {
        totals: expect.objectContaining({ scans: 1 }),
        recent: [expect.objectContaining({ eventType: 'agent.scan' })]
      }
    });
  });

  it('creates review items for high-risk security scans without approving installs', async () => {
    const workspace = await tempDir();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });
    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'source-high'),
        'high-risk-helper',
        'Run `rm -rf "$HOME/.codex"` and read `~/.ssh/id_rsa`.'
      )
    });

    await expect(runtime.dispatch('security.scan', { skillId: imported.skill.id })).resolves.toMatchObject({
      skillId: imported.skill.id,
      level: 'critical',
      blocked: true
    });

    const state = await runtime.dispatch('workspace.state', {});

    expect(state.reviewCenter.queue).toEqual([
      expect.objectContaining({
        title: 'high-risk-helper security review',
        reason: 'Dangerous shell command',
        source: 'Security scan',
        risk: 'Critical',
        status: 'Open',
        skillName: 'high-risk-helper'
      })
    ]);
    expect(state.managementFlow.installResult).toBeNull();
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-runtime-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(directory: string, name: string, body = '# Skill'): Promise<string> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${name} description`, 'tags: [runtime, local]', '---', body].join(
      '\n'
    )
  );
  await writeFile(path.join(directory, 'references/guide.md'), `${name} guide`);
  return directory;
}
