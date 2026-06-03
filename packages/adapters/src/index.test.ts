import { describe, expect, it } from 'vitest';

import { adaptersPackage } from './index';

describe('adapters package baseline', () => {
  it('keeps adapter detection implementation out of Phase 1', () => {
    expect(adaptersPackage).toEqual({
      name: '@theopenhub/adapters',
      phase: 'Phase 1 tooling baseline'
    });
  });
});
