import { describe, expect, it } from 'vitest';

import { createMainWindowOptions } from './window-options';

describe('desktop BrowserWindow options', () => {
  it('keeps privileged APIs outside the renderer', () => {
    const options = createMainWindowOptions('/tmp/theopenhub-preload.cjs');

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: '/tmp/theopenhub-preload.cjs'
    });
  });
});
