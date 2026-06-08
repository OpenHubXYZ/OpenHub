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
    parsed = parseFlatFrontmatter(frontmatter);
    if (!parsed) {
      throw new SkillParseError(
        'malformed_frontmatter',
        manifestPath,
        `SKILL.md has malformed frontmatter: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
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

function parseFlatFrontmatter(frontmatter: string): Record<string, unknown> | null {
  const metadata: Record<string, unknown> = {};
  const listValues = new Map<string, string[]>();
  let activeListKey: string | null = null;

  for (const line of frontmatter.split(/\r?\n/)) {
    if (line.trim() === '') {
      continue;
    }

    const listItem = /^\s+-\s*(.*)$/.exec(line);
    if (activeListKey && listItem) {
      listValues.get(activeListKey)?.push(stripWrappingQuotes(listItem[1]?.trim() ?? ''));
      continue;
    }

    const keyValue = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!keyValue) {
      return null;
    }

    const key = keyValue[1];
    if (!key) {
      return null;
    }
    const value = keyValue[2] ?? '';
    if (value === '') {
      const list: string[] = [];
      listValues.set(key, list);
      metadata[key] = list;
      activeListKey = key;
      continue;
    }

    metadata[key] = parseFlatValue(value);
    activeListKey = null;
  }

  return metadata;
}

function parseFlatValue(value: string): string | string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((entry) => stripWrappingQuotes(entry.trim()))
      .filter(Boolean);
  }
  return stripWrappingQuotes(trimmed);
}

function stripWrappingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
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
