import { describe, expect, it } from 'vitest';

import { dbPackage } from './index';

describe('db package baseline', () => {
  it('identifies the SQLite foundation package phase', () => {
    expect(dbPackage).toEqual({
      name: '@theopenhub/db',
      phase: 'Phase 2 SQLite domain foundation'
    });
  });
});
