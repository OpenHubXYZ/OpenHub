import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';
import { defaultSecurityRules, type SecurityFinding } from './security-service';
import { parseSkillManifest, type ParsedSkillManifest } from './skill-parser';
import { createVersionService } from './version-service';

export interface CreateAuthorServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
}

export interface AuthorPreflightCheck {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'block';
  message: string;
}

export interface AuthorPreflightResult {
  sourcePath: string;
  ok: boolean;
  manifest: ParsedSkillManifest | null;
  checks: AuthorPreflightCheck[];
  findings: SecurityFinding[];
  signatureReady: boolean;
}

export interface AuthorPackageResult {
  outputDirectory: string;
  manifestPath: string;
  versionId?: string;
  signatureStatus: 'unsigned' | 'signed';
  networkUpload: false;
}

export interface AuthorService {
  preflight(input: { sourcePath: string; signer?: string }): Promise<AuthorPreflightResult>;
  createDraftPackage(input: {
    skillId: string;
    sourcePath: string;
    outputDirectory: string;
    changeSummary: string;
  }): Promise<AuthorPackageResult>;
  preparePublishPackage(input: {
    skillId: string;
    sourcePath: string;
    outputDirectory: string;
    signer: string;
  }): Promise<AuthorPackageResult>;
}

interface SourceFile {
  relativePath: string;
  content: string;
  size: number;
}

export function createAuthorService(input: CreateAuthorServiceInput): AuthorService {
  return {
    async preflight({ sourcePath, signer }) {
      return preflightSource(sourcePath, signer);
    },

    async createDraftPackage({ skillId, sourcePath, outputDirectory, changeSummary }) {
      const preflight = await preflightSource(sourcePath);
      assertPreflightPasses(preflight);
      const files = await collectSourceFiles(sourcePath);
      const version = await createVersionService(input).createVersion({
        skillId,
        changeSummary,
        lifecycle: 'draft',
        releaseChannel: 'local',
        files: files.map((file) => ({ relativePath: file.relativePath, content: file.content }))
      });

      return writeAuthorPackage({
        packageType: 'draft',
        skillId,
        versionId: version.versionId,
        outputDirectory,
        manifest: requireManifest(preflight),
        files,
        signature: { status: 'unsigned' }
      });
    },

    async preparePublishPackage({ skillId, sourcePath, outputDirectory, signer }) {
      const preflight = await preflightSource(sourcePath, signer);
      assertPreflightPasses(preflight);
      if (!preflight.signatureReady) {
        throw new Error('Publish package requires signature-ready preflight');
      }

      const files = await collectSourceFiles(sourcePath);
      return writeAuthorPackage({
        packageType: 'publish',
        skillId,
        outputDirectory,
        manifest: requireManifest(preflight),
        files,
        signature: {
          status: 'signed',
          signer,
          algorithm: 'sha256'
        }
      });
    }
  };
}

async function preflightSource(sourcePath: string, signer?: string): Promise<AuthorPreflightResult> {
  const checks: AuthorPreflightCheck[] = [];
  let files: SourceFile[] = [];
  let manifest: ParsedSkillManifest | null = null;

  try {
    files = await collectSourceFiles(sourcePath);
    checks.push({ id: 'paths', label: 'File paths', status: 'pass', message: 'All source paths are safe' });
  } catch (error) {
    checks.push({
      id: 'paths',
      label: 'File paths',
      status: 'block',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  const manifestFile = files.find((file) => file.relativePath === 'SKILL.md');
  try {
    if (!manifestFile) {
      throw new Error('Source folder is missing SKILL.md');
    }
    manifest = parseSkillManifest(manifestFile.content, 'SKILL.md');
    checks.push({ id: 'manifest', label: 'SKILL.md', status: 'pass', message: 'Valid manifest' });
  } catch (error) {
    checks.push({
      id: 'manifest',
      label: 'SKILL.md',
      status: 'block',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  const findings = scanSourceFiles(files);
  const blockedFinding = findings.find((finding) => finding.severity === 'critical' || finding.severity === 'high');
  checks.push(
    blockedFinding
      ? {
          id: 'security',
          label: 'Security findings',
          status: 'block',
          message: `${blockedFinding.ruleName}: ${blockedFinding.relativePath}`
        }
      : { id: 'security', label: 'Security findings', status: 'pass', message: 'No blocking findings' }
  );

  checks.push(
    manifest && files.length > 0
      ? { id: 'package', label: 'Package manifest', status: 'pass', message: `${files.length} files ready` }
      : { id: 'package', label: 'Package manifest', status: 'block', message: 'Package metadata is incomplete' }
  );

  const signatureReady = Boolean(signer?.trim()) && !checks.some((check) => check.status === 'block');
  checks.push(
    signatureReady
      ? { id: 'signature', label: 'Signature', status: 'pass', message: 'Signer is available' }
      : { id: 'signature', label: 'Signature', status: 'warning', message: 'Unsigned draft only' }
  );

  return {
    sourcePath,
    ok: !checks.some((check) => check.status === 'block'),
    manifest,
    checks,
    findings,
    signatureReady
  };
}

async function collectSourceFiles(sourcePath: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  await collectFiles(sourcePath, sourcePath, files);
  return files.sort((left, right) => compareRelativePaths(left.relativePath, right.relativePath));
}

async function collectFiles(rootPath: string, directory: string, files: SourceFile[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(rootPath, entryPath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(rootPath, entryPath).split(path.sep).join('/');
    const safeRelativePath = assertZipEntryPathSafe(relativePath);
    const safePath = await ensurePathInsideRoot(rootPath, entryPath);
    const content = await readFile(safePath, 'utf8');
    files.push({ relativePath: safeRelativePath, content, size: Buffer.byteLength(content) });
  }
}

function scanSourceFiles(files: SourceFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    for (const rule of defaultSecurityRules) {
      for (const finding of rule.scan(file)) {
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          relativePath: file.relativePath,
          lineNo: finding.lineNo,
          excerpt: finding.excerpt
        });
      }
    }
  }
  return findings;
}

async function writeAuthorPackage(input: {
  packageType: 'draft' | 'publish';
  skillId: string;
  versionId?: string;
  outputDirectory: string;
  manifest: ParsedSkillManifest;
  files: SourceFile[];
  signature: { status: 'unsigned' } | { status: 'signed'; signer: string; algorithm: 'sha256' };
}): Promise<AuthorPackageResult> {
  const filesDirectory = path.join(input.outputDirectory, 'files');
  await rm(input.outputDirectory, { recursive: true, force: true });
  await mkdir(filesDirectory, { recursive: true });

  const fileRecords = [];
  for (const file of input.files) {
    const targetPath = await ensurePathInsideRoot(filesDirectory, path.join(filesDirectory, ...file.relativePath.split('/')));
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content);
    fileRecords.push({
      relativePath: file.relativePath,
      hash: hashContent(file.content),
      size: file.size
    });
  }

  const manifestPayload = {
    packageType: input.packageType,
    skillId: input.skillId,
    versionId: input.versionId,
    name: input.manifest.name,
    description: input.manifest.description,
    tags: input.manifest.tags,
    files: fileRecords,
    networkUpload: false
  };
  const signature =
    input.signature.status === 'signed'
      ? {
          status: 'signed',
          algorithm: input.signature.algorithm,
          signer: input.signature.signer,
          value: signedManifestValue(manifestPayload, input.signature.signer)
        }
      : { status: 'unsigned' };
  const packageManifest = { ...manifestPayload, signature };
  const manifestPath = path.join(input.outputDirectory, 'author-package.json');
  await writeFile(manifestPath, JSON.stringify(packageManifest, null, 2));

  return {
    outputDirectory: input.outputDirectory,
    manifestPath,
    ...(input.versionId ? { versionId: input.versionId } : {}),
    signatureStatus: input.signature.status,
    networkUpload: false
  };
}

function requireManifest(preflight: AuthorPreflightResult): ParsedSkillManifest {
  if (!preflight.manifest) {
    throw new Error('Author preflight did not produce a manifest');
  }
  return preflight.manifest;
}

function assertPreflightPasses(preflight: AuthorPreflightResult): void {
  if (!preflight.ok) {
    throw new Error(`Author preflight blocked: ${preflight.checks.filter((check) => check.status === 'block').map((check) => check.id).join(', ')}`);
  }
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function signedManifestValue(payload: unknown, signer: string): string {
  return createHash('sha256').update(`${JSON.stringify(payload)}:${signer}`).digest('hex');
}

function compareRelativePaths(left: string, right: string): number {
  if (left === 'SKILL.md') {
    return -1;
  }
  if (right === 'SKILL.md') {
    return 1;
  }
  return left.localeCompare(right);
}
