import { describe, expect, it, vi } from 'vitest';

import { createLibraryRepository } from './library-repository';
import { createMemoryDatabase, runMigrations } from './migrations';
import { createSkillRepository } from './skill-repository';

describe('skill repository', () => {
  it('creates, lists, updates, searches, and deletes a skill in an isolated database', () => {
    const db = createMemoryDatabase();
    runMigrations(db);
    const repository = createSkillRepository(db);

    const skill = repository.createSkill({
      slug: 'path-safety',
      name: 'Path Safety',
      description: 'Checks imports for traversal and symlink escape.',
      tags: ['security', 'sqlite'],
      source: {
        type: 'local',
        url: null,
      },
      files: [
        {
          relativePath: 'SKILL.md',
          content: '# Path Safety\n\nReject traversal.'
        },
        {
          relativePath: 'references/path-checklist.md',
          content: 'zip slip symlink escape'
        }
      ]
    });

    expect(repository.listSkills()).toEqual([
      expect.objectContaining({
        id: skill.id,
        slug: 'path-safety',
        name: 'Path Safety',
        versionNo: 1
      })
    ]);

    repository.updateSkillMetadata(skill.id, {
      name: 'Path Safety Scanner',
      description: 'Scans local imports before installation.',
      tags: ['security', 'imports']
    });

    expect(repository.getSkill(skill.id)).toEqual(
      expect.objectContaining({
        id: skill.id,
        name: 'Path Safety Scanner',
        description: 'Scans local imports before installation.',
        tags: ['security', 'imports']
      })
    );

    expect(repository.searchSkills('imports')).toEqual([
      expect.objectContaining({ id: skill.id, name: 'Path Safety Scanner' })
    ]);
    expect(repository.searchSkills('path-checklist')).toEqual([
      expect.objectContaining({ id: skill.id, name: 'Path Safety Scanner' })
    ]);
    expect(repository.searchSkills('symlink')).toEqual([
      expect.objectContaining({ id: skill.id, name: 'Path Safety Scanner' })
    ]);

    repository.setFavorite(skill.id, true);
    expect(repository.listFavorites()).toEqual([
      expect.objectContaining({ id: skill.id, name: 'Path Safety Scanner' })
    ]);
    expect(repository.searchSkills('imports', { favoritesOnly: true })).toEqual([
      expect.objectContaining({ id: skill.id, name: 'Path Safety Scanner' })
    ]);

    repository.setFavorite(skill.id, false);
    expect(repository.listFavorites()).toEqual([]);
    expect(repository.searchSkills('imports', { favoritesOnly: true })).toEqual([]);

    repository.deleteSkill(skill.id);

    expect(repository.listSkills()).toEqual([]);
    expect(repository.searchSkills('imports')).toEqual([]);
  });

  it('supports deterministic local semantic and hybrid search without network dependencies', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled'));
    const db = createMemoryDatabase();
    runMigrations(db);
    const repository = createSkillRepository(db);

    const sqliteSkill = repository.createSkill({
      slug: 'sqlite-store',
      name: 'SQLite Store',
      description: 'Local source of truth with schema migrations.',
      tags: ['sqlite', 'storage'],
      source: {
        type: 'local',
        url: null,
      },
      files: [
        {
          relativePath: 'SKILL.md',
          content: '# SQLite Store\n\nIndexes migration tables and schema state.'
        }
      ]
    });
    const exactDatabaseSkill = repository.createSkill({
      slug: 'database-importer',
      name: 'Database Importer',
      description: 'Exact database import helper.',
      tags: ['import'],
      source: {
        type: 'local',
        url: null,
      },
      files: [
        {
          relativePath: 'SKILL.md',
          content: '# Database Importer'
        }
      ]
    });
    repository.createSkill({
      slug: 'path-safety',
      name: 'Path Safety',
      description: 'Blocks traversal and symlink escapes.',
      tags: ['security'],
      source: {
        type: 'local',
        url: null,
      },
      files: [
        {
          relativePath: 'SKILL.md',
          content: '# Path Safety'
        }
      ]
    });

    expect(repository.searchSkills('db', { mode: 'fts' })).toEqual([]);
    expect(repository.searchSkills('db', { mode: 'semantic' }).map((skill) => skill.id)).toEqual([
      sqliteSkill.id,
      exactDatabaseSkill.id
    ]);
    expect(repository.searchSkills('database', { mode: 'hybrid' }).map((skill) => skill.id)).toEqual([
      exactDatabaseSkill.id,
      sqliteSkill.id
    ]);
    expect(repository.searchSkills('database', { mode: 'hybrid' }).map((skill) => skill.id)).toEqual([
      exactDatabaseSkill.id,
      sqliteSkill.id
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('indexes text files and paths without indexing binary payload bytes', () => {
    const db = createMemoryDatabase();
    runMigrations(db);
    const repository = createSkillRepository(db);
    const binaryPayload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, ...Buffer.from('binary-secret-token')]);

    const skill = repository.createSkill({
      slug: 'chinese-novelist',
      name: 'chinese-novelist',
      description: 'Chapter writing helper.',
      tags: ['writing'],
      source: {
        type: 'agent-root',
        url: '/tmp/.agents/skills/chinese-novelist',
      },
      files: [
        {
          relativePath: 'SKILL.md',
          content: '# Chinese Novelist\n\nUses chapter hooks.'
        },
        {
          relativePath: 'scripts/write.py',
          contentBuffer: Buffer.from('def outline_engine():\n    return "chapter-hook"\n'),
          searchableContent: 'def outline_engine():\n    return "chapter-hook"\n'
        },
        {
          relativePath: 'assets/cover.png',
          contentBuffer: binaryPayload
        }
      ]
    });

    expect(repository.searchSkills('chapter')).toEqual([
      expect.objectContaining({ id: skill.id, name: 'chinese-novelist' })
    ]);
    expect(repository.searchSkills('cover')).toEqual([
      expect.objectContaining({ id: skill.id, name: 'chinese-novelist' })
    ]);
    expect(repository.searchSkills('binary')).toEqual([]);
  });

  it('skips corrupt local semantic index JSON without throwing', () => {
    const db = createMemoryDatabase();
    runMigrations(db);
    const repository = createSkillRepository(db);
    const healthy = repository.createSkill({
      slug: 'healthy-search',
      name: 'Healthy Search',
      description: 'Database helper.',
      tags: ['sqlite'],
      source: {
        type: 'local',
        url: null,
      },
      files: [{ relativePath: 'SKILL.md', content: '# Healthy Search' }]
    });
    const corrupt = repository.createSkill({
      slug: 'corrupt-search',
      name: 'Corrupt Search',
      description: 'Database helper.',
      tags: ['sqlite'],
      source: {
        type: 'local',
        url: null,
      },
      files: [{ relativePath: 'SKILL.md', content: '# Corrupt Search' }]
    });
    db.prepare('update skill_similarity_index set tokens_json = ? where skill_id = ?').run('{bad json', corrupt.id);

    expect(() => repository.searchSkills('db', { mode: 'semantic' })).not.toThrow();
    expect(repository.searchSkills('db', { mode: 'semantic' })).toEqual([
      expect.objectContaining({ id: healthy.id })
    ]);
  });

  it('filters library search by source, agent, tags, and favorites while returning facet counts', () => {
    const db = createMemoryDatabase();
    runMigrations(db);
    const repository = createSkillRepository(db);
    const library = createLibraryRepository(db);

    const local = repository.createSkill({
      slug: 'local-helper',
      name: 'Local Helper',
      description: 'Local helper',
      tags: ['runtime', 'local'],
      source: {
        type: 'local',
        url: null,
      },
      files: [{ relativePath: 'SKILL.md', content: '# Local Helper' }]
    });
    const git = repository.createSkill({
      slug: 'git-import-helper',
      name: 'Git Import Helper',
      description: 'Imports shared packages.',
      tags: ['imports', 'runtime'],
      source: {
        type: 'git',
        url: 'file:///tmp/git-helper',
      },
      files: [{ relativePath: 'SKILL.md', content: '# Git Import Helper\n\nPackage importer.' }]
    });
    repository.createSkill({
      slug: 'zip-helper',
      name: 'ZIP Helper',
      description: 'Archive helper',
      tags: ['archive'],
      source: {
        type: 'zip',
        url: '/tmp/helper.zip',
      },
      files: [{ relativePath: 'SKILL.md', content: '# ZIP Helper' }]
    });

    library.recordIndexedSkillLocation({
      skillId: git.id,
      versionId: git.versionId,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      rootPath: '/tmp/.codex/skills',
      rootScope: 'user',
      writable: true,
      isDefault: true,
      skillPath: '/tmp/.codex/skills/git-import-helper',
      visibilityStatus: 'indexed'
    });
    repository.setFavorite(git.id, true);

    expect(
      repository.searchSkills('package', {
        mode: 'hybrid',
        filters: {
          sourceTypes: ['git'],
          agentCodes: ['codex'],
          tags: ['imports'],
          favoritesOnly: true
        }
      })
    ).toEqual([expect.objectContaining({ id: git.id, name: 'Git Import Helper' })]);
    expect(
      repository.searchSkills('', {
        filters: {
          sourceTypes: ['local']
        }
      })
    ).toEqual([expect.objectContaining({ id: local.id, name: 'Local Helper' })]);

    expect(repository.getFacets()).toMatchObject({
      sources: expect.arrayContaining([
        { value: 'git', count: 1 },
        { value: 'local', count: 1 },
        { value: 'zip', count: 1 }
      ]),
      agents: [{ value: 'codex', count: 1 }],
      tags: expect.arrayContaining([
        { value: 'imports', count: 1 },
        { value: 'runtime', count: 2 }
      ]),
      favorites: { value: 'favorites', count: 1 }
    });

    repository.setFavorite(git.id, false);
    expect(repository.getFacets().favorites.count).toBe(0);
  });
});
