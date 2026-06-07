import { describe, expect, it } from 'vitest';

import { desktopShellContract, parseIpcRequest } from './ipc-contracts';

describe('desktop shell IPC contract', () => {
  it('defines the app info channel with an empty request payload', () => {
    expect(desktopShellContract.appInfo.channel).toBe('app.info');
    expect(desktopShellContract.appInfo.request.parse({})).toEqual({});
  });

  it('keeps the runtime contract focused on skills, marketplace sources, settings, sync, plugins, and narrow installs', () => {
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
        'install.createPlan',
        'install.applyPlan',
        'install.uninstall',
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
        'discover.listSources',
        'discover.addSource',
        'discover.previewSource',
        'discover.removeSource'
      ])
    );

    expect(channels).not.toEqual(
      expect.arrayContaining([
        'export.skill',
        'export.signedSkill',
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
          agentCode: 'codex',
          path: '/tmp/.codex/skills/runtime-helper',
          visibilityStatus: 'indexed',
          rootPath: '/tmp/.codex/skills',
          scope: 'user',
          rootKind: 'user',
          writable: true,
          ownership: 'indexed'
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

  it('validates retained skills, source, sync, and plugin requests', () => {
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
    expect(parseIpcRequest('install.createPlan', {
      skillId: 'skill-1',
      targetRoot: '/tmp/.codex/skills',
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'user',
      rootKind: 'user',
      projectionMode: 'copy'
    })).toMatchObject({ projectionMode: 'copy' });
    expect(parseIpcRequest('install.applyPlan', {
      plan: {
        id: 'plan-1',
        skillId: 'skill-1',
        skillVersionId: 'version-1',
        skillName: 'Runtime Helper',
        skillSlug: 'runtime-helper',
        targetRoot: '/tmp/.codex/skills',
        targetSkillPath: '/tmp/.codex/skills/runtime-helper',
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'builtin',
        scope: 'user',
        rootKind: 'user',
        projectionMode: 'copy',
        status: 'ready',
        writes: [
          {
            relativePath: 'SKILL.md',
            targetPath: '/tmp/.codex/skills/runtime-helper/SKILL.md',
            sourceHash: 'hash-1',
            action: 'copy',
            status: 'clean'
          }
        ]
      },
      confirmOverwrite: false
    })).toMatchObject({ confirmOverwrite: false });
    expect(parseIpcRequest('install.uninstall', { installationId: 'installation-1' })).toEqual({
      installationId: 'installation-1'
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
    expect(parseIpcRequest('discover.listSources', {})).toEqual({});
    expect(parseIpcRequest('discover.removeSource', { sourceId: 'source-1' })).toEqual({ sourceId: 'source-1' });
  });
});
