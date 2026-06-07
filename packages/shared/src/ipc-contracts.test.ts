import { describe, expect, it } from 'vitest';

import { desktopShellContract, parseIpcRequest } from './ipc-contracts';

describe('desktop shell IPC contract', () => {
  it('defines the app info channel with an empty request payload', () => {
    expect(desktopShellContract.appInfo.channel).toBe('app.info');
    expect(desktopShellContract.appInfo.request.parse({})).toEqual({});
  });

  it('keeps the runtime contract focused on inventory, sources, settings, sync, and plugins', () => {
    const channels = Object.values(desktopShellContract).map((contract) => contract.channel);

    expect(channels).toEqual(
      expect.arrayContaining([
        'app.info',
        'workspace.state',
        'library.list',
        'library.scan',
        'library.search',
        'library.facets',
        'library.detail',
        'import.localFolder',
        'import.git',
        'import.zip',
        'collection.create',
        'version.list',
        'version.diff',
        'version.compare',
        'sync.startupPlan',
        'sync.createProfile',
        'sync.push',
        'sync.pull',
        'plugins.install',
        'plugins.authorizePermission',
        'plugins.enable',
        'plugins.disable',
        'settings.get',
        'discover.addSource',
        'discover.previewSource'
      ])
    );

    expect(channels).not.toEqual(
      expect.arrayContaining([
        'export.skill',
        'export.signedSkill',
        'install.createPlan',
        'install.applyPlan',
        'install.uninstall',
        'install.reinstall',
        'install.relink',
        'install.setReadOnlyLock',
        'security.scan',
        'security.rescan',
        'security.findingDetail',
        'security.createExemption',
        'security.revokeExemption',
        'policy.create',
        'baseline.export',
        'author.preflight',
        'author.preparePublishPackage',
        'version.createDraft',
        'version.promote',
        'version.rollback'
      ])
    );
  });

  it('validates workspace state without Deploy or Trust centers', () => {
    const workspaceState = desktopShellContract.workspaceState.response.parse({
      appInfo: {
        productName: 'OpenHub',
        phase: 'Phase 10',
        localFirst: true
      },
      librarySkills: [
        {
          id: 'skill-1',
          name: 'Runtime Helper',
          sourceAgent: 'Codex',
          path: '/tmp/.codex/skills/runtime-helper',
          visibilityStatus: 'indexed'
        }
      ],
      skills: [
        {
          id: 'skill-1',
          versionId: 'version-1',
          name: 'Runtime Helper',
          description: 'Imported locally',
          versionNo: 1
        }
      ],
      managementFlow: {
        importItems: [{ label: 'Runtime Helper', status: 'imported' }]
      },
      governance: {
        history: [],
        diff: [],
        collections: []
      },
      syncCenter: {
        profiles: [],
        outbox: [],
        inbox: [],
        conflicts: []
      },
      plugins: {
        directories: [],
        catalog: [],
        plugins: []
      }
    });

    expect(workspaceState.librarySkills[0]?.visibilityStatus).toBe('indexed');
    expect('securityCenter' in workspaceState).toBe(false);
    expect('reviewCenter' in workspaceState).toBe(false);
    expect('usageCenter' in workspaceState).toBe(false);
  });

  it('rejects removed Deploy and Trust IPC channels before dispatch', () => {
    for (const channel of [
      'install.createPlan',
      'install.applyPlan',
      'install.uninstall',
      'security.scan',
      'security.createExemption',
      'policy.create',
      'baseline.export',
      'author.preparePublishPackage',
      'export.skill',
      'version.promote',
      'version.rollback'
    ]) {
      expect(() => parseIpcRequest(channel, {}), channel).toThrow(/Unknown IPC channel/);
    }
  });

  it('validates retained inventory, source, sync, and plugin requests', () => {
    expect(parseIpcRequest('import.git', { gitUrl: 'file:///tmp/skill-repo' })).toEqual({
      gitUrl: 'file:///tmp/skill-repo'
    });
    expect(parseIpcRequest('collection.create', { name: 'Starter', description: '', skillIds: ['skill-1'] })).toEqual({
      name: 'Starter',
      description: '',
      skillIds: ['skill-1']
    });
    expect(parseIpcRequest('library.search', { query: 'docs', filters: { sourceTypes: ['git'] } })).toMatchObject({
      filters: { sourceTypes: ['git'] }
    });
    expect(
      desktopShellContract.libraryFacets.response.parse({
        sources: [{ value: 'git', count: 1 }],
        agents: [{ value: 'codex', count: 1 }],
        tags: [{ value: 'imports', count: 1 }],
        favorites: { value: 'favorites', count: 1 }
      }).favorites.count
    ).toBe(1);
    expect(parseIpcRequest('plugins.authorizePermission', {
      pluginId: 'plugin-1',
      permission: 'import:local',
      reason: 'Needed for local import provider'
    })).toMatchObject({ permission: 'import:local' });
    expect(() =>
      parseIpcRequest('plugins.authorizePermission', {
        pluginId: 'plugin-1',
        permission: 'export:local',
        reason: 'removed capability'
      })
    ).toThrow();
    expect(
      desktopShellContract.pluginsRegistry.response.parse({
        agentAdapters: [{ pluginId: 'plugin-1', code: 'codex-extra', displayName: 'Codex Extra' }],
        importers: [],
        syncDrivers: []
      }).agentAdapters[0]
    ).toMatchObject({ code: 'codex-extra', displayName: 'Codex Extra' });
    expect(parseIpcRequest('discover.addSource', {
      name: 'Local curated',
      sourceType: 'local',
      url: '/tmp/source'
    })).toMatchObject({ sourceType: 'local' });
  });
});
