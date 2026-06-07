import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const cssPath = path.resolve(__dirname, 'app.css');

describe('renderer layout containment CSS', () => {
  it('keeps the desktop shell inside the viewport without document scrollbars', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, 'html,\nbody,\n#root')).toContain('overflow: hidden;');
    expect(cssBlock(css, '.screen')).toContain('height: 100%;');
    expect(cssBlock(css, '.screen')).toContain('grid-template-columns: 248px minmax(0, 1fr);');
    expect(css).not.toContain('100vw');
  });

  it('defines the retained four-page workbench layout', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, '.app-frame')).toContain('grid-template-rows: 72px minmax(0, 1fr);');
    expect(cssBlock(css, '.workspace')).toContain('overflow: auto;');
    expect(cssBlock(css, '.split-two')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).not.toContain('.right-pane');
    expect(css).not.toContain('.statusbar');
    expect(css).not.toMatch(/deploy|trust|install|security/i);
  });

  it('keeps compact labels clipped inside table cells', async () => {
    const css = await readFile(cssPath, 'utf8');
    const tagBlock = cssBlock(css, '.tag,\n.status');

    expect(tagBlock).toContain('max-width: 100%;');
    expect(tagBlock).toContain('overflow: hidden;');
    expect(tagBlock).toContain('text-overflow: ellipsis;');
  });

  it('collapses split layouts on narrow screens', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('.screen {');
    expect(css).toContain('grid-template-columns: 84px minmax(0, 1fr);');
    expect(css).toContain('.split-two {');
    expect(css).toContain('grid-template-columns: 1fr;');
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
