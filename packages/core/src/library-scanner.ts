import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { AgentAdapter, AgentCode, AgentRoot } from '@theopenhub/adapters';
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

export async function scanAgentLibraries(
  input: ScanAgentLibrariesInput
): Promise<ScanAgentLibrariesResult> {
  const skillRepository = createSkillRepository(input.database);
  const libraryRepository = createLibraryRepository(input.database);
  const indexedSkills: IndexedSkillResult[] = [];
  const errors: ScanErrorResult[] = [];

  for (const adapter of input.adapters) {
    const roots = await adapter.detectRoots();

    for (const root of roots) {
      const candidates = await listSkillCandidates(root);

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
          const skill = skillRepository.createSkill({
            slug: manifest.name,
            name: manifest.name,
            description: manifest.description,
            tags: manifest.tags,
            source: {
              type: 'agent-root',
              url: candidate,
              trustLevel: root.agentCode
            },
            files: files.map((file) => ({
              relativePath: file.relativePath,
              content: file.content
            }))
          });

          libraryRepository.recordScannedInstallation({
            skillId: skill.id,
            versionId: skill.versionId,
            agentCode: root.agentCode,
            agentDisplayName: root.agentDisplayName,
            adapterVersion: root.adapterVersion,
            rootPath: root.rootPath,
            rootScope: root.scope,
            writable: root.writable,
            isDefault: root.isDefault,
            skillPath: candidate,
            installStatus: 'installed'
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
): Promise<Array<{ relativePath: string; content: string; size: number }>> {
  const entries = await readdir(skillPath, { withFileTypes: true });
  const files: Array<{ relativePath: string; content: string; size: number }> = [];

  for (const entry of entries) {
    const entryPath = path.join(skillPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(entryPath, basePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = await readFile(entryPath, 'utf8');
    files.push({
      relativePath: path.relative(basePath, entryPath),
      content,
      size: Buffer.byteLength(content)
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
