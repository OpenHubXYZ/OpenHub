import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBuiltInAgentAdapters } from './built-in-adapters';

const tempDirectories: string[] = [];

describe('built-in agent adapters', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('detects common local skill roots for Codex, Claude, Gemini, and OpenCode', async () => {
    const homeDirectory = await mkdtemp(path.join(tmpdir(), 'theopenhub-adapters-'));
    tempDirectories.push(homeDirectory);

    for (const root of ['.codex/skills', '.claude/skills', '.gemini/skills', '.opencode/skills']) {
      await mkdir(path.join(homeDirectory, root), { recursive: true });
    }

    const adapters = createBuiltInAgentAdapters({ homeDirectory, adapterVersion: 'test' });
    const roots = (await Promise.all(adapters.map((adapter) => adapter.detectRoots()))).flat();

    expect(roots.map((root) => [root.agentCode, root.rootPath])).toEqual([
      ['codex', path.join(homeDirectory, '.codex/skills')],
      ['claude', path.join(homeDirectory, '.claude/skills')],
      ['gemini', path.join(homeDirectory, '.gemini/skills')],
      ['opencode', path.join(homeDirectory, '.opencode/skills')]
    ]);
  });

  it('lists installed skill directories that contain SKILL.md files', async () => {
    const homeDirectory = await mkdtemp(path.join(tmpdir(), 'theopenhub-adapters-'));
    tempDirectories.push(homeDirectory);
    const rootPath = path.join(homeDirectory, '.codex/skills');
    const skillPath = path.join(rootPath, 'path-safety');
    const nestedSkillPath = path.join(rootPath, '.system/openai-docs');

    await mkdir(skillPath, { recursive: true });
    await writeFile(path.join(skillPath, 'SKILL.md'), '---\nname: path-safety\n---\n');
    await mkdir(nestedSkillPath, { recursive: true });
    await writeFile(path.join(nestedSkillPath, 'SKILL.md'), '---\nname: openai-docs\n---\n');
    await mkdir(path.join(rootPath, 'not-a-skill'));

    const codexAdapter = createBuiltInAgentAdapters({ homeDirectory, adapterVersion: 'test' })[0];
    if (!codexAdapter) {
      throw new Error('Codex adapter was not created');
    }
    const installed = await codexAdapter.listInstalled({
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      rootPath,
      scope: 'user',
      writable: true,
      isDefault: true
    });

    expect(installed).toEqual([
      {
        agentCode: 'codex',
        rootPath,
        skillPath: nestedSkillPath,
        manifestPath: path.join(nestedSkillPath, 'SKILL.md')
      },
      {
        agentCode: 'codex',
        rootPath,
        skillPath,
        manifestPath: path.join(skillPath, 'SKILL.md')
      }
    ]);
  });
});
