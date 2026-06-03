import { describe, expect, it } from 'vitest';

import { corePackage } from './index';

describe('core package baseline', () => {
  it('identifies the plugin runtime package phase', () => {
    expect(corePackage).toEqual({
      name: '@theopenhub/core',
      phase: 'Phase 8 plugin runtime'
    });
  });
});
