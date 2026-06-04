import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const mainSourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.ts');

describe('desktop main startup', () => {
  it('uses the ready event instead of top-level waiting for Electron readiness', async () => {
    const source = await readFile(mainSourcePath, 'utf8');

    expect(source).toContain("app.on('ready'");
    expect(source).not.toContain('await app.whenReady()');
  });

  it('sets the runtime app name before creating windows or tray', async () => {
    const source = await readFile(mainSourcePath, 'utf8');

    expect(source).toContain('app.setName(PRODUCT_NAME)');
  });

  it('shows the main window after either ready-to-show or did-finish-load', async () => {
    const source = await readFile(mainSourcePath, 'utf8');

    expect(source).toContain("mainWindow.once('ready-to-show', showMainWindow)");
    expect(source).toContain("mainWindow.webContents.once('did-finish-load', showMainWindow)");
  });

  it('allows isolated runtime data and home directories for desktop QA', async () => {
    const source = await readFile(mainSourcePath, 'utf8');

    expect(source).toContain('OPENHUB_DATA_DIR');
    expect(source).toContain('OPENHUB_HOME_DIR');
  });
});
