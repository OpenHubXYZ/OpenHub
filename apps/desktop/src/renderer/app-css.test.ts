import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const cssPath = path.resolve(__dirname, 'app.css');

describe('renderer layout containment CSS', () => {
  it('defines Stitch-derived OpenHub design tokens', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, ':root')).toContain('--oh-surface: #f7f9fb;');
    expect(cssBlock(css, ':root')).toContain('--oh-sidebar: #131b2e;');
    expect(cssBlock(css, ':root')).toContain('--oh-action: #0058be;');
    expect(cssBlock(css, ':root')).toContain('--oh-border: #c6c6cd;');
    expect(cssBlock(css, ':root')).toContain('--oh-radius: 8px;');
  });

  it('keeps the desktop shell inside the viewport without document scrollbars', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, 'html,\nbody,\n#root')).toContain('overflow: hidden;');
    expect(cssBlock(css, '.screen')).toContain('height: 100%;');
    expect(cssBlock(css, '.screen')).toContain('grid-template-columns: var(--oh-sidebar-width) minmax(0, 1fr);');
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

  it('lets the collapsed topbar reserve vertical space for wrapped command buttons', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.app-frame {');
    expect(compactRules).toContain('grid-template-rows: auto minmax(0, 1fr);');
  });

  it('keeps mobile dashboard metrics compact so start actions remain reachable', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.metric-grid {');
    expect(compactRules).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(compactRules).toContain('.metric {');
    expect(compactRules).toContain('padding: 12px;');
  });

  it('lets narrow settings rows show long local paths instead of collapsing to ellipses', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.key-row.three-col {');
    expect(compactRules).toContain('grid-template-columns: 1fr;');
    expect(compactRules).toContain('.key-row.three-col strong {');
    expect(compactRules).toContain('white-space: normal;');
    expect(compactRules).toContain('overflow-wrap: anywhere;');
    expect(compactRules).toContain('text-overflow: clip;');
  });

  it('stacks mobile conflict confirmations so file names stay readable', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.conflict-box {');
    expect(compactRules).toContain('flex-direction: column;');
    expect(compactRules).toContain('align-items: stretch;');
    expect(compactRules).toContain('.conflict-files code {');
    expect(compactRules).toContain('white-space: normal;');
    expect(compactRules).toContain('overflow-wrap: anywhere;');
    expect(compactRules).toContain('text-overflow: clip;');
  });

  it('lets mobile skill tables and detail file rows wrap long paths', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.skills-table .table-head {');
    expect(compactRules).toContain('display: none;');
    expect(compactRules).toContain('.skills-table .table-row {');
    expect(compactRules).toContain('grid-template-columns: 1fr;');
    expect(compactRules).toContain('.skills-table .table-row span {');
    expect(compactRules).toContain('overflow-wrap: anywhere;');
    expect(compactRules).toContain('.detail-heading {');
    expect(compactRules).toContain('flex-direction: column;');
    expect(compactRules).toContain('.detail-panel .key-row {');
    expect(compactRules).toContain('grid-template-columns: 1fr;');
  });

  it('lets skill detail file and version rows wrap long values at every viewport size', async () => {
    const css = await readFile(cssPath, 'utf8');
    const baseCss = css.slice(0, css.indexOf('@media (max-width: 900px)'));
    const detailValueBlock = cssBlock(baseCss, '.detail-panel .key-row strong');

    expect(detailValueBlock).toContain('white-space: normal;');
    expect(detailValueBlock).toContain('overflow-wrap: anywhere;');
    expect(detailValueBlock).toContain('text-overflow: clip;');
  });

  it('lets mobile page status messages wrap instead of truncating long skill names', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.page-title .status {');
    expect(compactRules).toContain('flex-basis: 100%;');
    expect(compactRules).toContain('white-space: normal;');
    expect(compactRules).toContain('overflow-wrap: anywhere;');
    expect(compactRules).toContain('text-overflow: clip;');
  });

  it('stacks mobile root headers so skill counts do not collapse beside long paths', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.root-header {');
    expect(compactRules).toContain('flex-direction: column;');
    expect(compactRules).toContain('align-items: flex-start;');
    expect(compactRules).toContain('.root-header strong,');
    expect(compactRules).toContain('.root-header span {');
    expect(compactRules).toContain('white-space: normal;');
    expect(compactRules).toContain('overflow-wrap: anywhere;');
    expect(compactRules).toContain('text-overflow: clip;');
  });

  it('lets mobile marketplace candidate names and source paths wrap', async () => {
    const css = await readFile(cssPath, 'utf8');
    const compactRules = atRuleBlock(css, '@media (max-width: 900px)');

    expect(compactRules).toContain('.candidate-heading {');
    expect(compactRules).toContain('flex-direction: column;');
    expect(compactRules).toContain('align-items: flex-start;');
    expect(compactRules).toContain('.candidate strong,');
    expect(compactRules).toContain('.candidate > span {');
    expect(compactRules).toContain('white-space: normal;');
    expect(compactRules).toContain('overflow-wrap: anywhere;');
    expect(compactRules).toContain('text-overflow: clip;');
  });

  it('keeps compact labels clipped inside table cells', async () => {
    const css = await readFile(cssPath, 'utf8');
    const tagBlock = cssBlock(css, '.tag,\n.status');

    expect(tagBlock).toContain('max-width: 100%;');
    expect(tagBlock).toContain('min-width: 0;');
    expect(tagBlock).toContain('overflow: hidden;');
    expect(tagBlock).toContain('text-overflow: ellipsis;');
  });

  it('separates repeated panel section headings from preceding rows', async () => {
    const css = await readFile(cssPath, 'utf8');
    const sectionHeadingBlock = cssBlock(css, '.panel h2:not(:first-child)');

    expect(sectionHeadingBlock).toContain('margin-top: 20px;');
  });

  it('allows long command error statuses to wrap without clipping', async () => {
    const css = await readFile(cssPath, 'utf8');
    const statusErrorBlock = cssBlock(css, '.status-error');

    expect(statusErrorBlock).toContain('overflow: visible;');
    expect(statusErrorBlock).toContain('text-overflow: clip;');
    expect(statusErrorBlock).toContain('white-space: normal;');
    expect(statusErrorBlock).toContain('overflow-wrap: anywhere;');
    expect(cssBlock(css, '.page-title .status-error')).toContain('flex-basis: 100%;');
  });

  it('contains long marketplace candidate paths inside the split panel', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, '.candidate-list')).toContain('min-width: 0;');
    expect(cssBlock(css, '.candidate')).toContain('min-width: 0;');
    expect(cssBlock(css, '.candidate')).toContain('max-width: 100%;');
    expect(cssBlock(css, '.candidate strong,\n.candidate span')).toContain('max-width: 100%;');
    expect(cssBlock(css, '.skill-card')).toContain('display: grid;');
    expect(cssBlock(css, '.tag-row')).toContain('flex-wrap: wrap;');
  });

  it('wraps the selected marketplace install target path', async () => {
    const css = await readFile(cssPath, 'utf8');
    const selectedPathBlock = cssBlock(css, '.selected-path');

    expect(selectedPathBlock).toContain('min-width: 0;');
    expect(selectedPathBlock).toContain('max-width: 100%;');
    expect(selectedPathBlock).toContain('white-space: normal;');
    expect(selectedPathBlock).toContain('overflow-wrap: anywhere;');
  });

  it('wraps long skill detail metadata tags instead of truncating source URLs', async () => {
    const css = await readFile(cssPath, 'utf8');
    const detailTagBlock = cssBlock(css, '.detail-panel .tag-row .tag');

    expect(detailTagBlock).toContain('white-space: normal;');
    expect(detailTagBlock).toContain('overflow-wrap: anywhere;');
    expect(detailTagBlock).toContain('text-overflow: clip;');
  });

  it('keeps indexed skill row actions visible without horizontal clipping', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(cssBlock(css, '.skills-table .table-head,\n.skills-table .table-row')).toContain('minmax(176px, 0.7fr)');
    expect(cssBlock(css, '.skills-table .table-row > span:last-child')).toContain('overflow: visible;');
    expect(cssBlock(css, '.skills-table .table-row > span:last-child')).toContain('white-space: normal;');
    expect(cssBlock(css, '.row-actions')).toContain('flex-wrap: wrap;');
    expect(cssBlock(css, '.row-actions')).toContain('justify-content: flex-end;');
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

function atRuleBlock(css: string, atRule: string): string {
  const start = css.indexOf(`${atRule} {`);
  if (start === -1) {
    throw new Error(`Missing CSS at-rule for ${atRule}`);
  }

  const blockStart = css.indexOf('{', start);
  let depth = 0;
  for (let index = blockStart; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    }
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(blockStart + 1, index);
      }
    }
  }

  throw new Error(`Unclosed CSS at-rule for ${atRule}`);
}
