import { describe, expect, it } from 'vitest';

import { corePackage } from './index';

describe('core package baseline', () => {
  it('identifies the library indexing package phase', () => {
    expect(corePackage).toEqual({
      name: '@theopenhub/core',
      phase: 'Phase 6 history and collections'
    });
  });
});
