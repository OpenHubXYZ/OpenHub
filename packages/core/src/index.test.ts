import { describe, expect, it } from 'vitest';

import { corePackage } from './index';

describe('core package baseline', () => {
  it('identifies the library indexing package phase', () => {
    expect(corePackage).toEqual({
      name: '@theopenhub/core',
      phase: 'Phase 4 P0 import and install loop'
    });
  });
});
