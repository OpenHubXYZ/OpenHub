import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { AgentAdapter, AgentCode, AgentRoot, AgentRootScope } from '@theopenhub/adapters';
import { createLibraryRepository, createSkillRepository } from '@theopenhub/db';
import type { SqliteDatabase } from '@theopenhub/db';

import { parseSkillManifest, SkillParseError } from './skill-parser';

export interface ScanAgentLibrariesInput {
  database: SqliteDatabase;
  adapters: AgentAdapter[];
}

export interface IndexedSkillResult {
  id: string;
  name: string;
  agentCode: AgentCode;
  path: string;
  files: Array<{
    relativePath: string;
    size: number;
  }>;
}

export interface ScanErrorResult {
  agentCode: AgentCode;
  code: string;
  skillPath: string;
  message: string;
}

export interface ScanAgentLibrariesResult {
  indexedSkills: IndexedSkillResult[];
  errors: ScanErrorResult[];
}

type ScannableAgentRoot = AgentRoot & { rootKind: 'user' | 'project' };

export async function scanAgentLibraries(
  input: ScanAgentLibrariesInput
): Promise<ScanAgentLibrariesResult> {
  const skillRepository = createSkillRepository(input.database);
  const libraryRepository = createLibraryRepository(input.database);
  const indexedSkills: IndexedSkillResult[] = [];
  const errors: ScanErrorResult[] = [];

  for (const adapter of input.adapters) {
    const roots = await scannableRootsForAdapter(input.database, adapter);

    for (const root of roots) {
      let candidates: string[];
      try {
        candidates = await listSkillCandidates(root);
      } catch (error) {
        errors.push({
          agentCode: root.agentCode,
          code: 'root_unreadable',
          skillPath: root.rootPath,
          message: error instanceof Error ? error.message : 'Root could not be read'
        });
        continue;
      }

      for (const candidate of candidates) {
        const manifestPath = path.join(candidate, 'SKILL.md');
        if (!(await fileExists(manifestPath))) {
          errors.push({
            agentCode: root.agentCode,
            code: 'missing_manifest',
            skillPath: candidate,
            message: 'Skill directory is missing SKILL.md'
          });
          continue;
        }

        try {
          const manifestContent = await readFile(manifestPath, 'utf8');
          const manifest = parseSkillManifest(manifestContent, manifestPath);
          const files = await collectSkillFiles(candidate);
          const skill =
            skillRepository.getSkillBySlug(manifest.name) ??
            skillRepository.createSkill({
              slug: manifest.name,
              name: manifest.name,
              description: manifest.description,
              tags: manifest.tags,
              source: {
                type: 'agent-root',
                url: candidate
              },
              files: files.map((file) => ({
                relativePath: file.relativePath,
                contentBuffer: file.content,
                ...(file.searchableContent === null ? {} : { searchableContent: file.searchableContent })
              }))
            });

          libraryRepository.recordIndexedSkillLocation({
            skillId: skill.id,
            versionId: skill.versionId,
            agentCode: root.agentCode,
            agentDisplayName: root.agentDisplayName,
            adapterVersion: root.adapterVersion,
            rootPath: root.rootPath,
            rootScope: root.scope,
            rootKind: root.rootKind,
            writable: root.writable,
            isDefault: root.isDefault,
            skillPath: candidate,
            visibilityStatus: 'indexed'
          });

          indexedSkills.push({
            id: skill.id,
            name: skill.name,
            agentCode: root.agentCode,
            path: candidate,
            files: files.map((file) => ({
              relativePath: file.relativePath,
              size: file.size
            }))
          });
        } catch (error) {
          errors.push(toScanError(root.agentCode, candidate, error));
        }
      }
    }
  }

  return { indexedSkills, errors };
}

async function scannableRootsForAdapter(database: SqliteDatabase, adapter: AgentAdapter): Promise<ScannableAgentRoot[]> {
  const detectedRoots = (await adapter.detectRoots()).map<ScannableAgentRoot>((root) => ({ ...root, rootKind: 'user' }));
  const storedRoots = database
    .prepare(
      `
        select
          a.code as agentCode,
          a.display_name as agentDisplayName,
          a.adapter_version as adapterVersion,
          ar.root_path as rootPath,
          ar.scope,
          ar.root_kind as rootKind,
          ar.writable,
          ar.is_default as isDefault
        from agent_roots ar
        join agents a on a.id = ar.agent_id
        where a.code = ?
        order by ar.created_at
      `
    )
    .all(adapter.id)
    .map(scannableRootRow);

  const byKey = new Map<string, ScannableAgentRoot>();
  for (const root of [...detectedRoots, ...storedRoots]) {
    byKey.set(`${root.agentCode}:${root.rootPath}:${root.scope}`, root);
  }
  return [...byKey.values()];
}

function scannableRootRow(row: unknown): ScannableAgentRoot {
  const typed = row as {
    agentCode: AgentCode;
    agentDisplayName: string;
    adapterVersion: string;
    rootPath: string;
    scope: AgentRootScope;
    rootKind: 'user' | 'project';
    writable: number;
    isDefault: number;
  };
  return {
    agentCode: typed.agentCode,
    agentDisplayName: typed.agentDisplayName,
    adapterVersion: typed.adapterVersion,
    rootPath: typed.rootPath,
    scope: typed.scope,
    rootKind: typed.rootKind,
    writable: typed.writable === 1,
    isDefault: typed.isDefault === 1
  };
}

async function listSkillCandidates(root: AgentRoot): Promise<string[]> {
  const entries = await readdir(root.rootPath, { withFileTypes: true });
  const candidates: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directChildPath = path.join(root.rootPath, entry.name);
    const nestedCandidates = await collectSkillCandidates(directChildPath);
    candidates.push(...(nestedCandidates.length > 0 ? nestedCandidates : [directChildPath]));
  }

  return candidates.sort();
}

async function collectSkillCandidates(directoryPath: string): Promise<string[]> {
  if (await fileExists(path.join(directoryPath, 'SKILL.md'))) {
    return [directoryPath];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const candidates: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    candidates.push(...(await collectSkillCandidates(path.join(directoryPath, entry.name))));
  }

  return candidates;
}

async function collectSkillFiles(
  skillPath: string,
  basePath = skillPath
): Promise<Array<{ relativePath: string; content: Buffer; searchableContent: string | null; size: number }>> {
  const entries = await readdir(skillPath, { withFileTypes: true });
  const files: Array<{ relativePath: string; content: Buffer; searchableContent: string | null; size: number }> = [];

  for (const entry of entries) {
    const entryPath = path.join(skillPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(entryPath, basePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = await readFile(entryPath);
    const relativePath = toPosixPath(path.relative(basePath, entryPath));
    files.push({
      relativePath,
      content,
      searchableContent: searchableContentForFile(relativePath, content),
      size: content.byteLength
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function searchableContentForFile(relativePath: string, content: Buffer): string | null {
  if (isKnownBinaryPath(relativePath) || content.includes(0)) {
    return null;
  }

  const decoded = content.toString('utf8');
  if (decoded.includes('\uFFFD') || hasHighControlCharacterRatio(decoded)) {
    return null;
  }

  return decoded;
}

function isKnownBinaryPath(relativePath: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|tar|gz|tgz|wasm|exe|dll|dylib|so)$/i.test(relativePath);
}

function hasHighControlCharacterRatio(input: string): boolean {
  if (input.length === 0) {
    return false;
  }

  let controlCharacters = 0;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if ((code >= 1 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      controlCharacters += 1;
    }
  }

  return controlCharacters / input.length > 0.05;
}

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function toScanError(agentCode: AgentCode, skillPath: string, error: unknown): ScanErrorResult {
  if (error instanceof SkillParseError) {
    return {
      agentCode,
      code: error.code,
      skillPath,
      message: error.message
    };
  }

  return {
    agentCode,
    code: 'scan_error',
    skillPath,
    message: error instanceof Error ? error.message : 'Unknown scan error'
  };
}
