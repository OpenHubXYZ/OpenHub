import { describe, expect, it } from 'vitest';

import { corePackage } from './index';

describe('core package baseline', () => {
  it('identifies the release readiness package phase', () => {
    expect(corePackage).toEqual({
      name: '@theopenhub/core',
      phase: 'Phase 9 release readiness'
    });
  });
});
