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
    expect(Object.values(desktopShellContract).map((contract) => contract.channel)).toEqual(
      expect.arrayContaining([
        'import.git',
        'import.zip',
        'export.skill',
        'collection.create',
        'collection.export',
        'collection.import',
        'library.search',
        'library.detail',
        'install.listTargets',
        'install.uninstall',
        'version.list',
        'version.diff',
        'version.rollback',
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
        'plugins.authorizePermission',
        'plugins.enable',
        'plugins.disable',
        'plugins.registry',
        'discover.addSource',
        'discover.previewSource',
        'discover.migrationPreview'
      ])
    );

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
    expect(parseIpcRequest('install.uninstall', { installationId: 'installation-1' })).toEqual({
      installationId: 'installation-1'
    });
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
      permission: 'network:fetch',
      reason: 'Needed for catalog fetches'
    })).toMatchObject({ permission: 'network:fetch' });
    expect(parseIpcRequest('discover.addSource', {
      name: 'Local curated',
      sourceType: 'local',
      url: '/tmp/source',
      trustLevel: 'verified'
    })).toMatchObject({ sourceType: 'local' });
  });
});
