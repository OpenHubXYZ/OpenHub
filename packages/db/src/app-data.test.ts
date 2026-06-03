import { describe, expect, it } from 'vitest';

import { resolveAppDataDirectory } from './app-data';

describe('app data directory resolution', () => {
  it('resolves platform-specific paths without touching real user directories', () => {
    expect(
      resolveAppDataDirectory({
        platform: 'darwin',
        homeDirectory: '/tmp/theopenhub-home',
        env: {}
      })
    ).toBe('/tmp/theopenhub-home/Library/Application Support/TheOpenHub Skills Studio');

    expect(
      resolveAppDataDirectory({
        platform: 'linux',
        homeDirectory: '/tmp/theopenhub-home',
        env: { XDG_DATA_HOME: '/tmp/theopenhub-xdg' }
      })
    ).toBe('/tmp/theopenhub-xdg/theopenhub-skills-studio');
  });
});
