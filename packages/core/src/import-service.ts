import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
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

export type ImportSourceType = 'local' | 'git' | 'git-sparse' | 'zip' | 'tar' | 'mirror';
export type ImportSignatureStatus = 'unsigned' | 'signed' | 'untrusted';

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
  signatureStatus?: ImportSignatureStatus;
}

export interface ImportService {
  importLocalFolder(input: { folderPath: string }): Promise<ImportedSkillResult>;
  importGit(input: { gitUrl: string }): Promise<ImportedSkillResult>;
  importGitSparse(input: { gitUrl: string; subpath: string }): Promise<ImportedSkillResult>;
  importZip(input: { zipPath: string }): Promise<ImportedSkillResult>;
  importTar(input: { tarPath: string }): Promise<ImportedSkillResult>;
  importMirror(input: { mirrorDirectory: string }): Promise<ImportedSkillResult>;
}

interface StagedImportInput {
  stagedDirectory: string;
  sourceType: ImportSourceType;
  sourceUrl: string | null;
  signatureStatus?: ImportSignatureStatus;
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

    async importGitSparse({ gitUrl, subpath }) {
      const outerStage = await createStageDirectory(input.stagingDirectory);
      const repositoryStage = path.join(outerStage, 'repo');
      const stagedDirectory = path.join(outerStage, 'skill');
      const safeSubpath = assertZipEntryPathSafe(subpath);

      await execFileAsync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', gitUrl, repositoryStage]);
      await execFileAsync('git', ['sparse-checkout', 'set', safeSubpath], { cwd: repositoryStage });
      const sourceRoot = await ensurePathInsideRoot(repositoryStage, path.join(repositoryStage, safeSubpath));
      await mkdir(stagedDirectory, { recursive: true });
      await copyDirectoryIntoStage({
        sourceRoot,
        currentSource: sourceRoot,
        stagedRoot: stagedDirectory,
        relativePrefix: ''
      });

      return importFromStage(input, {
        stagedDirectory,
        sourceType: 'git-sparse',
        sourceUrl: `${gitUrl}#${safeSubpath}`
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
    },

    async importTar({ tarPath }) {
      const stagedDirectory = await createStageDirectory(input.stagingDirectory);
      await assertTarArchiveSafe(tarPath);
      await execFileAsync('tar', ['-xf', tarPath, '-C', stagedDirectory]);

      return importFromStage(input, {
        stagedDirectory,
        sourceType: 'tar',
        sourceUrl: tarPath
      });
    },

    async importMirror({ mirrorDirectory }) {
      const sourceRoot = await ensurePathInsideRoot(mirrorDirectory, mirrorDirectory);
      const manifestPath = await ensurePathInsideRoot(sourceRoot, path.join(sourceRoot, 'manifest.json'));
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as MirrorManifest;
      const filesDirectory = await ensurePathInsideRoot(sourceRoot, path.join(sourceRoot, 'files'));
      const stagedDirectory = await createStageDirectory(input.stagingDirectory);

      for (const file of manifest.files) {
        const relativePath = assertZipEntryPathSafe(file.relativePath);
        const sourcePath = await ensurePathInsideRoot(filesDirectory, path.join(filesDirectory, ...relativePath.split('/')));
        const content = await readFile(sourcePath);
        const actualHash = createHash('sha256').update(content).digest('hex');
        if (actualHash !== file.hash) {
          throw new Error(`Mirror hash mismatch: ${relativePath}`);
        }

        const targetPath = await ensurePathInsideRoot(stagedDirectory, path.join(stagedDirectory, ...relativePath.split('/')));
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content);
      }

      return importFromStage(input, {
        stagedDirectory,
        sourceType: 'mirror',
        sourceUrl: mirrorDirectory,
        signatureStatus: verifyMirrorSignature(manifest)
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
    stagedFrom: importInput.stagedDirectory,
    ...(importInput.signatureStatus ? { signatureStatus: importInput.signatureStatus } : {})
  };
}

interface MirrorManifest {
  name?: string;
  slug?: string;
  versionNo?: number;
  files: Array<{ relativePath: string; hash: string; size: number }>;
  signature?: {
    status?: ImportSignatureStatus;
    algorithm?: 'sha256';
    signer?: string;
    value?: string;
  };
}

async function assertTarArchiveSafe(tarPath: string): Promise<void> {
  const { stdout: names } = await execFileAsync('tar', ['-tf', tarPath]);
  for (const rawName of names.split(/\r?\n/).filter(Boolean)) {
    if (rawName === '.' || rawName === './') {
      continue;
    }
    assertZipEntryPathSafe(rawName);
  }

  const { stdout: listing } = await execFileAsync('tar', ['-tvf', tarPath]);
  const unsafeLink = listing
    .split(/\r?\n/)
    .filter(Boolean)
    .find((line) => line.startsWith('l') || line.startsWith('h'));
  if (unsafeLink) {
    throw new Error(`unsafe TAR link: ${unsafeLink}`);
  }
}

function verifyMirrorSignature(manifest: MirrorManifest): ImportSignatureStatus {
  if (!manifest.signature || manifest.signature.status === 'unsigned') {
    return 'unsigned';
  }

  if (
    manifest.signature.status === 'signed' &&
    manifest.signature.algorithm === 'sha256' &&
    manifest.signature.value === signedManifestValue(manifest, manifest.signature.signer ?? '')
  ) {
    return 'signed';
  }

  return 'untrusted';
}

export function signedManifestValue(manifest: MirrorManifest, signer: string): string {
  const payload = {
    name: manifest.name,
    slug: manifest.slug,
    versionNo: manifest.versionNo,
    files: manifest.files
  };
  return createHash('sha256').update(`${JSON.stringify(payload)}:${signer}`).digest('hex');
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
