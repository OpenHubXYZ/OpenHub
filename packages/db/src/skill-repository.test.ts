import { describe, expect, it } from 'vitest';

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
        trustLevel: 'user'
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
});
