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
});
