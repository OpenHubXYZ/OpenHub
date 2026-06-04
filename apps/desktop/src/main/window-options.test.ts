import { describe, expect, it } from 'vitest';

import { createMainWindowOptions } from './window-options';

describe('desktop BrowserWindow options', () => {
  it('keeps privileged APIs outside the renderer', () => {
    const options = createMainWindowOptions('/tmp/theopenhub-preload.cjs', '/tmp/openhub-icon.png');

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: '/tmp/theopenhub-preload.cjs'
    });
  });

  it('uses OpenHub branding and the bundled app icon', () => {
    const options = createMainWindowOptions('/tmp/theopenhub-preload.cjs', '/tmp/openhub-icon.png');

    expect(options.title).toBe('OpenHub');
    expect(options.icon).toBe('/tmp/openhub-icon.png');
  });
});
