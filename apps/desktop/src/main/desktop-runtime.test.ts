import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createContentStore, createInMemorySecretStore, createVersionService } from '@theopenhub/core';
import { createMemoryDatabase } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createDesktopRuntime } from './desktop-runtime';

const tempDirectories: string[] = [];

interface RuntimeImportedResult {
  skill: {
    id: string;
    name: string;
    versionId: string;
  };
}

interface RuntimeWorkspaceState {
  managementFlow: Record<string, unknown>;
}

interface RuntimeScanResult {
  indexedSkills: Array<{ name: string; agentCode: string }>;
}

interface RuntimeIdResult {
  id: string;
}

describe('desktop runtime IPC dispatch', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('imports local skills and returns skills workspace state without deploy or trust centers', async () => {
    const workspace = await tempDir();
    const dataDirectory = path.join(workspace, 'app-data');
    const database = createMemoryDatabase();
    const runtime = createDesktopRuntime({
      dataDirectory,
      homeDirectory: path.join(workspace, 'home'),
      database,
      secretStore: createInMemorySecretStore()
    });
    const imported = (await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'source'), 'runtime-helper')
    })) as RuntimeImportedResult;

    expect(imported.skill.name).toBe('runtime-helper');
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({
      skills: [expect.objectContaining({ id: imported.skill.id, name: 'runtime-helper', versionNo: 1 })],
      managementFlow: {
        importItems: [expect.objectContaining({ label: 'runtime-helper', status: 'imported' })]
      },
      plugins: {
        directories: [],
        catalog: [],
        plugins: []
      }
    });
    const state = (await runtime.dispatch('workspace.state', {})) as RuntimeWorkspaceState;
    expect('securityCenter' in state).toBe(false);
    expect('reviewCenter' in state).toBe(false);
    expect('usageCenter' in state).toBe(false);
    expect('installPlan' in state.managementFlow).toBe(false);
  });

  it('scans detected agent roots into the library with indexed visibility', async () => {
    const workspace = await tempDir();
    const homeDirectory = path.join(workspace, 'home');
    await createSkillFixture(path.join(homeDirectory, '.codex/skills/scanned-helper'), 'scanned-helper');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory,
      secretStore: createInMemorySecretStore()
    });

    const scan = (await runtime.dispatch('library.scan', {})) as RuntimeScanResult;

    expect(scan.indexedSkills).toEqual([
      expect.objectContaining({ name: 'scanned-helper', agentCode: 'codex' })
    ]);
    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([
      expect.objectContaining({
        name: 'scanned-helper',
        sourceAgent: 'Codex',
        agentCode: 'codex',
        rootPath: path.join(homeDirectory, '.codex/skills'),
        ownership: 'indexed',
        visibilityStatus: 'indexed'
      })
    ]);
    await expect(runtime.dispatch('library.search', { query: 'scanned' })).resolves.toEqual([
      expect.objectContaining({ name: 'scanned-helper' })
    ]);
  });

  it('dispatches version, collection, sync, discover, and plugin skills workflows', async () => {
    const workspace = await tempDir();
    const dataDirectory = path.join(workspace, 'app-data');
    const database = createMemoryDatabase();
    const runtime = createDesktopRuntime({
      dataDirectory,
      homeDirectory: path.join(workspace, 'home'),
      database,
      secretStore: createInMemorySecretStore()
    });
    const imported = (await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'version-source'), 'version-helper')
    })) as RuntimeImportedResult;
    const versionTwo = await createVersionService({
      database,
      contentStore: createContentStore(path.join(dataDirectory, 'blobs'))
    }).createVersion({
      skillId: imported.skill.id,
      changeSummary: 'Runtime version update',
      files: [
        { relativePath: 'SKILL.md', content: '# Runtime Version Two' },
        { relativePath: 'references/next.md', content: 'next notes' }
      ]
    });
    const collection = await runtime.dispatch('collection.create', {
      name: 'Runtime Collection',
      description: 'Skill grouping',
      skillIds: [imported.skill.id]
    }) as { name: string };
    const profile = await runtime.dispatch('sync.createProfile', {
      mode: 'shared-folder',
      remoteUrl: path.join(workspace, 'sync'),
      enabled: false
    }) as RuntimeIdResult;
    const outbox = await runtime.dispatch('sync.enqueueLocalChange', {
      profileId: profile.id,
      entityType: 'skill',
      entityId: imported.skill.id,
      payload: { name: imported.skill.name }
    }) as { status: string; entityId: string };
    const sourceRoot = path.join(workspace, 'discover-source');
    await createSkillFixture(path.join(sourceRoot, 'discover-helper'), 'discover-helper');
    const discoverSource = await runtime.dispatch('discover.addSource', {
      name: 'Local Discover',
      sourceType: 'local',
      url: sourceRoot
    }) as RuntimeIdResult;
    const pluginRoot = await createPluginFixture(path.join(workspace, 'plugin'), {
      id: 'runtime-importer-plugin',
      name: 'Runtime Importer Plugin',
      capabilities: [{ type: 'importer', id: 'runtime-importer' }],
      permissions: ['import:local'],
      source: `
        exports.register = (host) => {
          host.registerImporter({
            id: 'runtime-importer',
            name: 'Runtime Importer',
            invoke(input) {
              return { accepted: input.path.endsWith('SKILL.md') };
            }
          });
        };
      `
    });
    const plugin = await runtime.dispatch('plugins.install', { rootPath: pluginRoot }) as RuntimeIdResult;
    await runtime.dispatch('plugins.authorizePermission', {
      pluginId: plugin.id,
      permission: 'import:local',
      reason: 'Runtime importer test'
    });

    expect(versionTwo).toMatchObject({ versionNo: 2, changeSummary: 'Runtime version update' });
    await expect(runtime.dispatch('version.diff', {
      fromVersionId: imported.skill.versionId,
      toVersionId: versionTwo.versionId
    })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ relativePath: 'SKILL.md', changeType: 'modified' })
    ]));
    expect(collection).toMatchObject({ name: 'Runtime Collection' });
    expect(outbox).toMatchObject({ status: 'queued', entityId: imported.skill.id });
    await expect(runtime.dispatch('discover.listSources', {})).resolves.toEqual([
      expect.objectContaining({ id: discoverSource.id, name: 'Local Discover' })
    ]);
    await expect(runtime.dispatch('discover.previewSource', { sourceId: discoverSource.id })).resolves.toMatchObject({
      skills: [expect.objectContaining({ name: 'discover-helper' })]
    });
    await expect(runtime.dispatch('discover.removeSource', { sourceId: discoverSource.id })).resolves.toEqual({
      status: 'removed'
    });
    await expect(runtime.dispatch('plugins.enable', { pluginId: plugin.id })).resolves.toMatchObject({
      importers: [{ pluginId: plugin.id, id: 'runtime-importer', name: 'Runtime Importer' }],
      syncDrivers: []
    });
    await expect(runtime.dispatch('plugins.invokeProvider', {
      pluginId: plugin.id,
      capabilityType: 'importer',
      capabilityId: 'runtime-importer',
      input: { path: 'SKILL.md' }
    })).resolves.toEqual({ accepted: true });
  });

  it('plans, applies, and uninstalls app-owned skill projections through IPC', async () => {
    const workspace = await tempDir();
    const targetRoot = path.join(workspace, 'project-skills');
    await mkdir(targetRoot, { recursive: true });
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home'),
      secretStore: createInMemorySecretStore()
    });
    const imported = (await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'install-source'), 'install-helper')
    })) as RuntimeImportedResult;

    const plan = await runtime.dispatch('install.createPlan', {
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'project',
      rootKind: 'project',
      projectionMode: 'copy'
    }) as { status: string };

    expect(plan).toMatchObject({ status: 'ready' });
    const installed = await runtime.dispatch('install.applyPlan', { plan, confirmOverwrite: false }) as {
      installationId: string;
    };
    await expect(readFile(path.join(targetRoot, 'install-helper', 'SKILL.md'), 'utf8')).resolves.toContain(
      'install-helper'
    );
    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([
      expect.objectContaining({
        name: 'install-helper',
        visibilityStatus: 'installed',
        ownership: 'app-owned',
        installationId: installed.installationId
      })
    ]);

    await writeFile(path.join(targetRoot, 'install-helper', 'user-note.md'), 'preserve me');
    await expect(runtime.dispatch('install.uninstall', { installationId: installed.installationId })).resolves.toEqual({
      status: 'uninstalled',
      installationId: installed.installationId
    });
    await expect(lstat(path.join(targetRoot, 'install-helper', 'SKILL.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(path.join(targetRoot, 'install-helper', 'user-note.md'), 'utf8')).resolves.toBe('preserve me');
    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([]);
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-runtime-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(directory: string, name: string, body = `# ${name}`): Promise<string> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${name}`, 'tags: [runtime]', '---', body].join('\n')
  );
  await writeFile(path.join(directory, 'references/guide.md'), `Guide for ${name}`);
  return directory;
}

async function createPluginFixture(
  directory: string,
  input: {
    id: string;
    name: string;
    capabilities: Array<{ type: string; id: string }>;
    permissions: string[];
    source: string;
  }
): Promise<string> {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'plugin.js'), input.source);
  await writeFile(
    path.join(directory, 'plugin.json'),
    JSON.stringify(
      {
        id: input.id,
        name: input.name,
        version: '1.0.0',
        apiVersion: 1,
        entry: 'plugin.js',
        capabilities: input.capabilities,
        permissions: input.permissions,
        integrity: { algorithm: 'sha256', hash: createHash('sha256').update(input.source).digest('hex') }
      },
      null,
      2
    )
  );
  return directory;
}
