import { describe, expect, it } from 'vitest';

import { desktopShellContract, parseIpcRequest } from './ipc-contracts';

describe('desktop shell IPC contract', () => {
  it('defines the app info channel with an empty request payload', () => {
    expect(desktopShellContract.appInfo.channel).toBe('app.info');
    expect(desktopShellContract.appInfo.request.parse({})).toEqual({});
  });

  it('validates app info responses', () => {
    const response = desktopShellContract.appInfo.response.parse({
      productName: 'TheOpenHub Skills Studio',
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
        productName: 'TheOpenHub Skills Studio',
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
});
