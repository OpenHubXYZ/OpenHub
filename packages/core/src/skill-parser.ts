import YAML from 'yaml';

export type SkillParseErrorCode = 'missing_name' | 'malformed_frontmatter';

export interface ParsedSkillManifest {
  name: string;
  description: string;
  tags: string[];
}

export class SkillParseError extends Error {
  constructor(
    public readonly code: SkillParseErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = 'SkillParseError';
  }
}

export function parseSkillManifest(content: string, manifestPath: string): ParsedSkillManifest {
  const frontmatter = extractFrontmatter(content);
  let parsed: unknown;

  try {
    parsed = YAML.parse(frontmatter);
  } catch (error) {
    throw new SkillParseError(
      'malformed_frontmatter',
      manifestPath,
      `SKILL.md has malformed frontmatter: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  const metadata = parsed as { name?: unknown; description?: unknown; tags?: unknown };

  if (typeof metadata?.name !== 'string' || metadata.name.trim() === '') {
    throw new SkillParseError(
      'missing_name',
      manifestPath,
      'SKILL.md is missing required frontmatter field: name'
    );
  }

  return {
    name: metadata.name.trim(),
    description: typeof metadata.description === 'string' ? metadata.description.trim() : '',
    tags: parseTags(metadata.tags)
  };
}

function extractFrontmatter(content: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return match?.[1] ?? '';
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim());
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}
