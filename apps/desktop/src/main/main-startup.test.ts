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
});
