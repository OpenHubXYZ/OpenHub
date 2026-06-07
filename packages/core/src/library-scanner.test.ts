import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createBuiltInAgentAdapters } from '@theopenhub/adapters';
import { createLibraryRepository, createMemoryDatabase, createSkillRepository, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { scanAgentLibraries } from './library-scanner';

const tempDirectories: string[] = [];

describe('agent library scanner', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('indexes fixture roots and records explainable errors for invalid skills', async () => {
    const homeDirectory = await mkdtemp(path.join(tmpdir(), 'theopenhub-scan-'));
    tempDirectories.push(homeDirectory);

    const codexSkill = path.join(homeDirectory, '.codex/skills/path-safety');
    const codexSystemSkill = path.join(homeDirectory, '.codex/skills/.system/openai-docs');
    const claudeMissing = path.join(homeDirectory, '.claude/skills/missing-manifest');
    const geminiMalformed = path.join(homeDirectory, '.gemini/skills/malformed');
    const opencodeSkill = path.join(homeDirectory, '.opencode/skills/story-helper');
    const agentsSkill = path.join(homeDirectory, '.agents/skills/chinese-novelist');
    const binaryAsset = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, ...Buffer.from('binary-secret-token')]);

    await mkdir(codexSkill, { recursive: true });
    await mkdir(codexSystemSkill, { recursive: true });
    await mkdir(claudeMissing, { recursive: true });
    await mkdir(geminiMalformed, { recursive: true });
    await mkdir(opencodeSkill, { recursive: true });
    await mkdir(path.join(agentsSkill, 'scripts'), { recursive: true });
    await mkdir(path.join(agentsSkill, 'assets'), { recursive: true });

    await writeFile(
      path.join(codexSkill, 'SKILL.md'),
      [
        '---',
        'name: path-safety',
        'description: Checks imports before installation.',
        'tags: [security, imports]',
        '---',
        '# Path Safety'
      ].join('\n')
    );
    await writeFile(
      path.join(codexSystemSkill, 'SKILL.md'),
      [
        '---',
        'name: openai-docs',
        'description: Searches local OpenAI docs.',
        'tags: [docs]',
        '---',
        '# OpenAI Docs'
      ].join('\n')
    );
    await writeFile(path.join(codexSkill, 'checklist.md'), 'zip slip symlink escape');
    await writeFile(path.join(geminiMalformed, 'SKILL.md'), '---\ndescription: Missing name.\n---\n');
    await writeFile(
      path.join(opencodeSkill, 'SKILL.md'),
      ['---', 'name: story-helper', 'description: Drafts story outlines.', '---', '# Story'].join(
        '\n'
      )
    );
    await writeFile(
      path.join(agentsSkill, 'SKILL.md'),
      [
        '---',
        'name: chinese-novelist',
        'description: Creates chapter hooks.',
        'tags: [writing, chapters]',
        '---',
        '# Chinese Novelist'
      ].join('\n')
    );
    await writeFile(path.join(agentsSkill, 'scripts/write.py'), 'def outline_engine():\n    return "chapter hook"\n');
    await writeFile(path.join(agentsSkill, 'assets/cover.png'), binaryAsset);

    const database = createMemoryDatabase();
    runMigrations(database);

    const result = await scanAgentLibraries({
      database,
      adapters: createBuiltInAgentAdapters({ homeDirectory, adapterVersion: 'test' })
    });

    expect(result.indexedSkills.map((skill) => skill.name).sort()).toEqual([
      'chinese-novelist',
      'openai-docs',
      'path-safety',
      'story-helper'
    ]);
    expect(result.indexedSkills.find((skill) => skill.name === 'chinese-novelist')).toMatchObject({
      agentCode: 'agents',
      files: expect.arrayContaining([
        { relativePath: 'assets/cover.png', size: binaryAsset.byteLength },
        { relativePath: 'scripts/write.py', size: Buffer.byteLength('def outline_engine():\n    return "chapter hook"\n') }
      ])
    });
    expect(result.errors).toEqual([
      expect.objectContaining({
        agentCode: 'claude',
        code: 'missing_manifest',
        skillPath: claudeMissing
      }),
      expect.objectContaining({
        agentCode: 'gemini',
        code: 'missing_name',
        skillPath: geminiMalformed
      })
    ]);

    expect(createLibraryRepository(database).listLibrarySkills()).toEqual([
      expect.objectContaining({
        name: 'chinese-novelist',
        sourceAgent: 'Agents',
        path: agentsSkill,
        visibilityStatus: 'indexed'
      }),
      expect.objectContaining({
        name: 'openai-docs',
        sourceAgent: 'Codex',
        path: codexSystemSkill,
        visibilityStatus: 'indexed'
      }),
      expect.objectContaining({
        name: 'path-safety',
        sourceAgent: 'Codex',
        path: codexSkill,
        visibilityStatus: 'indexed'
      }),
      expect.objectContaining({
        name: 'story-helper',
        sourceAgent: 'OpenCode',
        path: opencodeSkill,
        visibilityStatus: 'indexed'
      })
    ]);
    const repository = createSkillRepository(database);
    expect(repository.searchSkills('outline')).toEqual([
      expect.objectContaining({ name: 'chinese-novelist' })
    ]);
    expect(repository.searchSkills('binary')).toEqual([]);
  });
});
