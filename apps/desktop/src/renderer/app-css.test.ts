import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const cssPath = path.resolve(__dirname, 'app.css');

describe('renderer layout containment CSS', () => {
  it('keeps the desktop shell inside the viewport without document scrollbars', async () => {
    const css = await readFile(cssPath, 'utf8');
    const shellBlock = cssBlock(css, '.screen');

    expect(cssBlock(css, 'html,\nbody,\n#root')).toContain('overflow: hidden;');
    expect(shellBlock).toContain('width: 100%;');
    expect(shellBlock).toContain('height: 100%;');
    expect(shellBlock).toContain('min-height: 0;');
    expect(shellBlock).not.toContain('width: 100vw;');
    expect(shellBlock).not.toContain('min-height: 760px;');
  });

  it('clips compact status pills inside their table cells', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactPillBlock = cssBlock(css, '.tag,\n.risk,\n.status');

    expect(compactPillBlock).toContain('max-width: 100%;');
    expect(compactPillBlock).toContain('overflow: hidden;');
    expect(compactPillBlock).toContain('text-overflow: ellipsis;');
  });

  it('lets page title actions wrap instead of squeezing buttons out of their pane', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, '.page-title')).toContain('flex-wrap: wrap;');
    expect(cssBlock(css, '.sub-actions')).toContain('flex: 0 0 auto;');
    expect(css).toContain('@media (max-width: 1100px)');
    expect(css).toContain('.split-two,\n  .section-grid,\n  .management-flow');
    expect(css).toContain('grid-template-columns: 1fr;');
  });

  it('gives first launch a full-window layout instead of the desktop workbench rows', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, '.first-launch-screen')).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(cssBlock(css, '.first-launch-frame')).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(cssBlock(css, '.first-launch-frame')).toContain('overflow: hidden;');
    expect(cssBlock(css, '.first-launch-body')).toContain('overflow: auto;');
  });
});

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`Missing CSS block for ${selector}`);
  }

  const blockStart = css.indexOf('{', start);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}
