import { execFile } from 'node:child_process';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import AdmZip from 'adm-zip';
import { createSkillRepository } from '@theopenhub/db';
import type { SkillRecord, SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';
import { parseSkillManifest } from './skill-parser';

const execFileAsync = promisify(execFile);

export type ImportSourceType = 'local' | 'git' | 'zip';

export interface CreateImportServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
  stagingDirectory: string;
}

export interface ImportedSkillFile {
  relativePath: string;
  hash: string;
  size: number;
}

export interface ImportedSkillResult {
  skill: SkillRecord;
  files: ImportedSkillFile[];
  stagedFrom: string;
}

export interface ImportService {
  importLocalFolder(input: { folderPath: string }): Promise<ImportedSkillResult>;
  importGit(input: { gitUrl: string }): Promise<ImportedSkillResult>;
  importZip(input: { zipPath: string }): Promise<ImportedSkillResult>;
}

interface StagedImportInput {
  stagedDirectory: string;
  sourceType: ImportSourceType;
  sourceUrl: string | null;
}

interface CollectedSkillFile {
  relativePath: string;
  content: string;
  size: number;
}

export function createImportService(input: CreateImportServiceInput): ImportService {
  return {
    async importLocalFolder({ folderPath }) {
      const sourceRoot = await ensurePathInsideRoot(folderPath, folderPath);
      const stagedDirectory = await createStageDirectory(input.stagingDirectory);

      await copyDirectoryIntoStage({
        sourceRoot,
        currentSource: sourceRoot,
        stagedRoot: stagedDirectory,
        relativePrefix: ''
      });

      return importFromStage(input, {
        stagedDirectory,
        sourceType: 'local',
        sourceUrl: folderPath
      });
    },

    async importGit({ gitUrl }) {
      const stagedDirectory = await createStageDirectory(input.stagingDirectory);

      await execFileAsync('git', ['clone', '--depth', '1', gitUrl, stagedDirectory]);

      return importFromStage(input, {
        stagedDirectory,
        sourceType: 'git',
        sourceUrl: gitUrl
      });
    },

    async importZip({ zipPath }) {
      const stagedDirectory = await createStageDirectory(input.stagingDirectory);
      const zip = new AdmZip(zipPath);

      for (const entry of zip.getEntries()) {
        const relativePath = assertZipEntryPathSafe(entry.entryName);
        const destinationPath = path.join(stagedDirectory, ...relativePath.split('/'));
        const safeDestinationPath = await ensurePathInsideRoot(stagedDirectory, destinationPath);

        if (entry.isDirectory) {
          await mkdir(safeDestinationPath, { recursive: true });
          continue;
        }

        await mkdir(path.dirname(safeDestinationPath), { recursive: true });
        await writeFile(safeDestinationPath, entry.getData());
      }

      return importFromStage(input, {
        stagedDirectory,
        sourceType: 'zip',
        sourceUrl: zipPath
      });
    }
  };
}

async function importFromStage(
  serviceInput: CreateImportServiceInput,
  importInput: StagedImportInput
): Promise<ImportedSkillResult> {
  const manifestPath = path.join(importInput.stagedDirectory, 'SKILL.md');
  const manifestContent = await readFile(manifestPath, 'utf8');
  const manifest = parseSkillManifest(manifestContent, manifestPath);
  const files = await collectSkillFiles(importInput.stagedDirectory);
  const storedFiles: ImportedSkillFile[] = [];

  for (const file of files) {
    const stored = await serviceInput.contentStore.writeBlob(file.content);
    storedFiles.push({
      relativePath: file.relativePath,
      hash: stored.hash,
      size: stored.size
    });
  }

  const skill = createSkillRepository(serviceInput.database).createSkill({
    slug: slugify(manifest.name),
    name: manifest.name,
    description: manifest.description,
    tags: manifest.tags,
    source: {
      type: importInput.sourceType,
      url: importInput.sourceUrl,
      trustLevel: 'user'
    },
    files: files.map((file) => ({
      relativePath: file.relativePath,
      content: file.content
    }))
  });

  return {
    skill,
    files: storedFiles,
    stagedFrom: importInput.stagedDirectory
  };
}

async function createStageDirectory(stagingDirectory: string): Promise<string> {
  await mkdir(stagingDirectory, { recursive: true });
  return mkdtemp(path.join(stagingDirectory, 'import-'));
}

async function copyDirectoryIntoStage(input: {
  sourceRoot: string;
  currentSource: string;
  stagedRoot: string;
  relativePrefix: string;
}): Promise<void> {
  const entries = await readdir(input.currentSource, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === '.git') {
      continue;
    }

    const sourcePath = path.join(input.currentSource, entry.name);
    const relativePath = path.join(input.relativePrefix, entry.name);
    const targetPath = path.join(input.stagedRoot, relativePath);
    const safeSourcePath = await ensurePathInsideRoot(input.sourceRoot, sourcePath);
    const safeTargetPath = await ensurePathInsideRoot(input.stagedRoot, targetPath);
    const entryStats = await lstat(sourcePath);

    if (entryStats.isSymbolicLink()) {
      const targetStats = await stat(safeSourcePath);
      if (targetStats.isDirectory()) {
        await mkdir(safeTargetPath, { recursive: true });
        await copyDirectoryIntoStage({
          sourceRoot: input.sourceRoot,
          currentSource: safeSourcePath,
          stagedRoot: input.stagedRoot,
          relativePrefix: relativePath
        });
        continue;
      }

      if (targetStats.isFile()) {
        await mkdir(path.dirname(safeTargetPath), { recursive: true });
        await copyFile(safeSourcePath, safeTargetPath);
      }

      continue;
    }

    if (entryStats.isDirectory()) {
      await mkdir(safeTargetPath, { recursive: true });
      await copyDirectoryIntoStage({
        sourceRoot: input.sourceRoot,
        currentSource: sourcePath,
        stagedRoot: input.stagedRoot,
        relativePrefix: relativePath
      });
      continue;
    }

    if (!entryStats.isFile()) {
      continue;
    }

    await mkdir(path.dirname(safeTargetPath), { recursive: true });
    await copyFile(safeSourcePath, safeTargetPath);
  }
}

async function collectSkillFiles(
  directory: string,
  baseDirectory = directory
): Promise<CollectedSkillFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: CollectedSkillFile[] = [];

  for (const entry of entries) {
    if (entry.name === '.git') {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(entryPath, baseDirectory)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = await readFile(entryPath, 'utf8');
    const relativePath = toPosixPath(path.relative(baseDirectory, entryPath));
    files.push({
      relativePath,
      content,
      size: Buffer.byteLength(content)
    });
  }

  return files.sort(compareSkillFiles);
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `skill-${Date.now()}`;
}

function compareSkillFiles(left: CollectedSkillFile, right: CollectedSkillFile): number {
  if (left.relativePath === 'SKILL.md') {
    return -1;
  }

  if (right.relativePath === 'SKILL.md') {
    return 1;
  }

  return left.relativePath.localeCompare(right.relativePath);
}

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}
