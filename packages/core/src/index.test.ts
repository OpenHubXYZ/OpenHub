import { describe, expect, it } from 'vitest';

import { corePackage } from './index';

describe('core package baseline', () => {
  it('identifies the core package without enabling product features early', () => {
    expect(corePackage).toEqual({
      name: '@theopenhub/core',
      phase: 'Phase 1 tooling baseline'
    });
  });
});
