import { describe, expect, it } from 'vitest';

import { adaptersPackage } from './index';

describe('adapters package baseline', () => {
  it('identifies the agent detection package phase', () => {
    expect(adaptersPackage).toEqual({
      name: '@theopenhub/adapters',
      phase: 'Phase 3 agent detection baseline'
    });
  });
});
