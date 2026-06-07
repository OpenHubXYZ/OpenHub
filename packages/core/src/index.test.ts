import { describe, expect, it } from 'vitest';

import { corePackage } from './index';

describe('core package baseline', () => {
  it('identifies the skills workspace package phase', () => {
    expect(corePackage).toEqual({
      name: '@theopenhub/core',
      phase: 'Phase 10 skills workspace operations'
    });
  });
});
