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
      phase: 'Phase 1',
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
});
