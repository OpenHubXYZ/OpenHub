import { describe, expect, it } from 'vitest';

import { dbPackage } from './index';

describe('db package baseline', () => {
  it('keeps SQLite implementation out of Phase 1', () => {
    expect(dbPackage).toEqual({
      name: '@theopenhub/db',
      phase: 'Phase 1 tooling baseline'
    });
  });
});
