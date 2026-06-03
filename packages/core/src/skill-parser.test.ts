import { describe, expect, it } from 'vitest';

import { parseSkillManifest, SkillParseError } from './skill-parser';

describe('SKILL.md parser', () => {
  it('parses frontmatter name, description, and tags', () => {
    const manifest = parseSkillManifest(
      [
        '---',
        'name: path-safety',
        'description: Checks imports before installation.',
        'tags:',
        '  - security',
        '  - imports',
        '---',
        '# Path Safety'
      ].join('\n'),
      'SKILL.md'
    );

    expect(manifest).toEqual({
      name: 'path-safety',
      description: 'Checks imports before installation.',
      tags: ['security', 'imports']
    });
  });

  it('returns an explainable error for missing required metadata', () => {
    expect(() => parseSkillManifest('---\ndescription: Missing a name.\n---\n', 'SKILL.md')).toThrow(
      new SkillParseError('missing_name', 'SKILL.md', 'SKILL.md is missing required frontmatter field: name')
    );
  });
});
