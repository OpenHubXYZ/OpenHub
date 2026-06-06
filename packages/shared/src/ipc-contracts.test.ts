import { describe, expect, it } from 'vitest';

import { desktopShellContract, parseIpcRequest } from './ipc-contracts';

describe('desktop shell IPC contract', () => {
  it('defines the app info channel with an empty request payload', () => {
    expect(desktopShellContract.appInfo.channel).toBe('app.info');
    expect(desktopShellContract.appInfo.request.parse({})).toEqual({});
  });

  it('validates app info responses', () => {
    const response = desktopShellContract.appInfo.response.parse({
      productName: 'OpenHub',
      phase: 'Phase 10',
      localFirst: true
    });

    expect(response.localFirst).toBe(true);
  });

  it('rejects unknown IPC channels before dispatch', () => {
    expect(() => parseIpcRequest('unknown.channel', {})).toThrow(/Unknown IPC channel/);
  });

  it('defines the library list channel and response shape', () => {
    expect(desktopShellContract.libraryList.channel).toBe('library.list');

    const response = desktopShellContract.libraryList.response.parse([
      {
        id: 'skill-1',
        name: 'Path Safety Scanner',
        sourceAgent: 'Codex',
        path: '/tmp/.codex/skills/path-safety',
        installStatus: 'installed'
      }
    ]);

    expect(response[0]?.sourceAgent).toBe('Codex');
  });

  it('defines typed runtime channels for the local management loop', () => {
    expect(desktopShellContract.workspaceState.channel).toBe('workspace.state');
    expect(desktopShellContract.libraryScan.channel).toBe('library.scan');
    expect(desktopShellContract.importLocalFolder.channel).toBe('import.localFolder');
    expect(desktopShellContract.installCreatePlan.channel).toBe('install.createPlan');
    expect(desktopShellContract.installApplyPlan.channel).toBe('install.applyPlan');
    expect(desktopShellContract.securityScan.channel).toBe('security.scan');
    expect(desktopShellContract.syncStartupPlan.channel).toBe('sync.startupPlan');
    expect(desktopShellContract.pluginsCenterState.channel).toBe('plugins.centerState');

    const workspaceState = desktopShellContract.workspaceState.response.parse({
      appInfo: {
        productName: 'OpenHub',
        phase: 'Phase 10',
        localFirst: true
      },
      librarySkills: [],
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
        importItems: [{ label: 'Runtime Helper', status: 'imported' }],
        installPlan: null,
        installResult: null
      },
      securityCenter: {
        queue: [],
        riskScore: 0,
        level: 'safe',
        findings: [],
        history: [],
        exemptions: []
      },
      usageCenter: {
        totals: {
          launches: 0,
          installs: 1,
          scans: 1,
          exports: 0
        },
        dailyActivity: [{ date: '2026-06-01', count: 2 }],
        topSkills: [{ skillName: 'Runtime Helper', count: 2 }],
        agentSplit: [{ agent: 'Codex', count: 1 }],
        recent: [{ eventType: 'install.apply', label: 'Installed Runtime Helper', value: '2026-06-01T10:00:00.000Z' }]
      },
      reviewCenter: {
        queue: [
          {
            id: 'review-1',
            title: 'Runtime Helper security review',
            detail: 'v1 security scan',
            reason: 'Dangerous shell command',
            source: 'Security scan',
            reviewer: 'Maintainer',
            risk: 'High',
            status: 'Open',
            skillName: 'Runtime Helper'
          }
        ],
        notes: [{ label: 'Explain why shell access is required.', value: 'open' }]
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
        plugins: []
      }
    });

    expect(workspaceState.skills[0]?.name).toBe('Runtime Helper');
    const scanResult = desktopShellContract.libraryScan.response.parse({
      indexedSkills: [
        {
          id: 'skill-scan',
          name: 'Scanned Helper',
          agentCode: 'codex',
          path: '/tmp/.codex/skills/scanned-helper',
          files: [{ relativePath: 'SKILL.md', size: 120 }]
        }
      ],
      errors: []
    });
    expect(scanResult.indexedSkills[0]?.agentCode).toBe('codex');
    expect(
      desktopShellContract.importLocalFolder.request.parse({
        folderPath: '/tmp/runtime-helper'
      })
    ).toEqual({ folderPath: '/tmp/runtime-helper' });
    expect(
      desktopShellContract.installCreatePlan.request.parse({
        skillId: 'skill-1',
        targetRoot: '/tmp/.codex/skills',
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'test',
        scope: 'user'
      })
    ).toMatchObject({ skillId: 'skill-1', agentCode: 'codex' });
  });

  it('defines the deep research workflow IPC channels with strict request validation', () => {
    const channels = Object.values(desktopShellContract).map((contract) => contract.channel);

    expect(channels).toEqual(
      expect.arrayContaining([
        'import.git',
        'import.zip',
        'export.skill',
        'collection.create',
        'collection.export',
        'collection.import',
        'library.search',
        'library.facets',
        'library.detail',
        'install.checkCompatibility',
        'install.listTargets',
        'install.reinstall',
        'install.relink',
        'install.setReadOnlyLock',
        'install.uninstall',
        'version.list',
        'version.diff',
        'version.createDraft',
        'version.promote',
        'version.compare',
        'version.rollback',
        'author.openSourceFolder',
        'author.preflight',
        'author.createDraftPackage',
        'author.preparePublishPackage',
        'security.rescan',
        'security.findingDetail',
        'security.createExemption',
        'security.revokeExemption',
        'sync.createProfile',
        'sync.enqueueLocalChange',
        'sync.push',
        'sync.pull',
        'sync.listConflicts',
        'sync.resolveConflict',
        'plugins.install',
        'plugins.addDirectory',
        'plugins.listDirectories',
        'plugins.scanDirectory',
        'plugins.removeDirectory',
        'plugins.authorizePermission',
        'plugins.enable',
        'plugins.disable',
        'plugins.registry',
        'plugins.invokeProvider',
        'settings.get',
        'settings.addMirrorSource',
        'settings.removeMirrorSource',
        'settings.setUpdateChecks',
        'settings.setLogLevel',
        'settings.addPluginDirectory',
        'settings.listPluginDirectories',
        'settings.removePluginDirectory',
        'discover.addSource',
        'discover.previewSource'
      ])
    );
    expect(channels).not.toContain('onboarding.importMigration');
    expect(channels).not.toContain('discover.migrationPreview');
    expect(() => parseIpcRequest('onboarding.importMigration', {})).toThrow(/Unknown IPC channel/);
    expect(() => parseIpcRequest('discover.migrationPreview', {})).toThrow(/Unknown IPC channel/);

    expect(parseIpcRequest('import.git', { gitUrl: 'file:///tmp/skill-repo' })).toEqual({
      gitUrl: 'file:///tmp/skill-repo'
    });
    expect(parseIpcRequest('import.zip', { zipPath: '/tmp/skill.zip' })).toEqual({
      zipPath: '/tmp/skill.zip'
    });
    expect(parseIpcRequest('export.skill', { skillId: 'skill-1', outputDirectory: '/tmp/out' })).toEqual({
      skillId: 'skill-1',
      outputDirectory: '/tmp/out'
    });
    expect(parseIpcRequest('collection.create', { name: 'Starter', description: '', skillIds: ['skill-1'] })).toEqual({
      name: 'Starter',
      description: '',
      skillIds: ['skill-1']
    });
    expect(parseIpcRequest('library.search', { query: 'path docs' })).toEqual({ query: 'path docs' });
    expect(parseIpcRequest('library.search', { query: 'db', mode: 'hybrid' })).toEqual({
      query: 'db',
      mode: 'hybrid'
    });
    expect(
      parseIpcRequest('library.search', {
        query: 'imports',
        filters: {
          sourceTypes: ['git'],
          riskStatuses: ['blocked'],
          agentCodes: ['codex'],
          tags: ['imports'],
          favoritesOnly: true
        }
      })
    ).toMatchObject({ filters: { sourceTypes: ['git'], favoritesOnly: true } });
    expect(parseIpcRequest('library.facets', {})).toEqual({});
    expect(
      desktopShellContract.libraryFacets.response.parse({
        sources: [{ value: 'git', count: 1 }],
        risks: [{ value: 'blocked', count: 1 }],
        agents: [{ value: 'codex', count: 1 }],
        tags: [{ value: 'imports', count: 1 }],
        favorites: { value: 'favorites', count: 1 }
      }).favorites.count
    ).toBe(1);
    expect(parseIpcRequest('install.uninstall', { installationId: 'installation-1' })).toEqual({
      installationId: 'installation-1'
    });
    expect(parseIpcRequest('install.checkCompatibility', {
      skillId: 'skill-1',
      targetRoot: '/tmp/.codex/skills',
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    })).toMatchObject({ skillId: 'skill-1', agentCode: 'codex' });
    expect(
      desktopShellContract.installCheckCompatibility.response.parse({
        status: 'compatible',
        skillId: 'skill-1',
        versionId: 'version-1',
        agentCode: 'codex',
        targetRoot: '/tmp/.codex/skills',
        supportedAgents: ['codex'],
        reasons: []
      }).status
    ).toBe('compatible');
    expect(parseIpcRequest('install.reinstall', { installationId: 'installation-1' })).toEqual({
      installationId: 'installation-1'
    });
    expect(parseIpcRequest('install.relink', {
      installationId: 'installation-1',
      targetRoot: '/tmp/.claude/skills',
      agentCode: 'claude',
      agentDisplayName: 'Claude',
      adapterVersion: 'test',
      scope: 'user',
      projectionMode: 'copy'
    })).toMatchObject({ installationId: 'installation-1', agentCode: 'claude' });
    expect(parseIpcRequest('install.setReadOnlyLock', { installationId: 'installation-1', locked: true })).toEqual({
      installationId: 'installation-1',
      locked: true
    });
    expect(
      desktopShellContract.installSetReadOnlyLock.response.parse({
        status: 'locked',
        installationId: 'installation-1',
        readOnlyLocked: true
      }).readOnlyLocked
    ).toBe(true);
    expect(parseIpcRequest('version.createDraft', {
      skillId: 'skill-1',
      changeSummary: 'Draft update',
      files: [{ relativePath: 'SKILL.md', content: '# Draft' }]
    })).toMatchObject({ changeSummary: 'Draft update' });
    expect(parseIpcRequest('version.promote', { versionId: 'version-2', releaseChannel: 'beta' })).toEqual({
      versionId: 'version-2',
      releaseChannel: 'beta'
    });
    expect(parseIpcRequest('version.compare', {
      fromVersionId: 'version-1',
      toVersionId: 'version-2'
    })).toEqual({ fromVersionId: 'version-1', toVersionId: 'version-2' });
    expect(
      desktopShellContract.versionCompare.response.parse({
        fromVersionId: 'version-1',
        toVersionId: 'version-2',
        fromManifestHash: 'hash-1',
        toManifestHash: 'hash-2',
        manifestHashChanged: true,
        files: [{ relativePath: 'SKILL.md', changeType: 'modified', fromHash: 'hash-1', toHash: 'hash-2' }]
      }).files[0]?.changeType
    ).toBe('modified');
    expect(parseIpcRequest('security.createExemption', {
      skillId: 'skill-1',
      scope: 'user',
      reason: 'Maintainer reviewed'
    })).toMatchObject({ scope: 'user' });
    expect(parseIpcRequest('sync.createProfile', {
      mode: 'shared-folder',
      remoteUrl: '/tmp/shared',
      enabled: false,
      authRef: 'keychain://sync/shared'
    })).toMatchObject({ authRef: 'keychain://sync/shared' });
    expect(parseIpcRequest('plugins.authorizePermission', {
      pluginId: 'plugin-1',
      permission: 'export:local',
      reason: 'Needed for catalog fetches'
    })).toMatchObject({ permission: 'export:local' });
    expect(parseIpcRequest('plugins.addDirectory', {
      rootPath: '/tmp/plugins'
    })).toMatchObject({ rootPath: '/tmp/plugins' });
    expect(parseIpcRequest('plugins.scanDirectory', {
      directoryId: 'directory-1'
    })).toMatchObject({ directoryId: 'directory-1' });
    expect(parseIpcRequest('plugins.invokeProvider', {
      pluginId: 'plugin-1',
      capabilityType: 'exporter',
      capabilityId: 'bundle-exporter',
      input: { outputDirectory: '/tmp/out' }
    })).toMatchObject({ capabilityType: 'exporter' });
    expect(
      desktopShellContract.pluginsRegistry.response.parse({
        agentAdapters: [],
        importers: [],
        securityRules: [],
        syncDrivers: [],
        exporters: [{ pluginId: 'plugin-1', id: 'bundle-exporter', name: 'Bundle Exporter' }]
      }).exporters[0]?.id
    ).toBe('bundle-exporter');
    expect(
      desktopShellContract.pluginsCenterState.response.parse({
        directories: [{ id: 'directory-1', rootPath: '/tmp/plugins', status: 'scanned', scannedAt: '2026-06-05T00:00:00.000Z' }],
        catalog: [
          {
            id: 'catalog-1',
            directoryId: 'directory-1',
            pluginId: 'plugin-1',
            name: 'Exporter Plugin',
            version: '1.0.0',
            rootPath: '/tmp/plugins/exporter',
            signatureStatus: 'trusted',
            installed: false,
            status: 'available'
          }
        ],
        plugins: []
      }).catalog[0]?.signatureStatus
    ).toBe('trusted');
    expect(parseIpcRequest('author.openSourceFolder', {
      sourcePath: '/tmp/source'
    })).toMatchObject({ sourcePath: '/tmp/source' });
    expect(parseIpcRequest('author.preflight', {
      sourcePath: '/tmp/source',
      signer: 'OpenHub Test'
    })).toMatchObject({ signer: 'OpenHub Test' });
    expect(parseIpcRequest('author.createDraftPackage', {
      skillId: 'skill-1',
      sourcePath: '/tmp/source',
      outputDirectory: '/tmp/draft-package',
      changeSummary: 'Draft edits'
    })).toMatchObject({ changeSummary: 'Draft edits' });
    expect(
      desktopShellContract.authorPreparePublishPackage.response.parse({
        outputDirectory: '/tmp/publish-package',
        manifestPath: '/tmp/publish-package/author-package.json',
        signatureStatus: 'signed',
        networkUpload: false
      }).networkUpload
    ).toBe(false);
    expect(desktopShellContract.settingsGet.response.parse({
      mirrorSources: [],
      updateChecksEnabled: false,
      logLevel: 'info',
      pluginDirectories: []
    }).updateChecksEnabled).toBe(false);
    expect(parseIpcRequest('settings.addMirrorSource', {
      name: 'Local Mirror',
      url: '/tmp/mirror'
    })).toMatchObject({ name: 'Local Mirror' });
    expect(parseIpcRequest('settings.setUpdateChecks', { enabled: true })).toEqual({ enabled: true });
    expect(parseIpcRequest('settings.setLogLevel', { logLevel: 'warn' })).toEqual({ logLevel: 'warn' });
    expect(parseIpcRequest('settings.addPluginDirectory', { rootPath: '/tmp/plugins' })).toEqual({
      rootPath: '/tmp/plugins'
    });
    expect(parseIpcRequest('discover.addSource', {
      name: 'Local curated',
      sourceType: 'local',
      url: '/tmp/source',
      trustLevel: 'verified'
    })).toMatchObject({ sourceType: 'local' });
    expect('discoverMigrationPreview' in desktopShellContract).toBe(false);
  });
});
