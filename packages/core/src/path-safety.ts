import { realpath } from 'node:fs/promises';
import path from 'node:path';

export type PathSafetyErrorCode = 'path_outside_root' | 'zip_slip';

export class PathSafetyError extends Error {
  constructor(
    public readonly code: PathSafetyErrorCode,
    public readonly path: string
  ) {
    super(`${code}: ${path}`);
    this.name = 'PathSafetyError';
  }
}

export function assertZipEntryPathSafe(entryName: string): string {
  const normalized = entryName.replaceAll('\\', '/').replace(/^\.\/+/, '');
  const trimmed = normalized.replace(/\/+$/, '');

  if (
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    path.win32.isAbsolute(entryName) ||
    path.posix.isAbsolute(normalized) ||
    trimmed === ''
  ) {
    throw new PathSafetyError('zip_slip', entryName);
  }

  const segments = trimmed.split('/');
  if (segments.some((segment) => segment === '..' || segment === '')) {
    throw new PathSafetyError('zip_slip', entryName);
  }

  return trimmed;
}

export async function ensurePathInsideRoot(rootPath: string, candidatePath: string): Promise<string> {
  const canonicalRoot = await realpath(path.resolve(rootPath));
  const canonicalCandidate = await canonicalizeCandidate(path.resolve(candidatePath));

  if (!isInsideOrEqual(canonicalRoot, canonicalCandidate)) {
    throw new PathSafetyError('path_outside_root', candidatePath);
  }

  return canonicalCandidate;
}

async function canonicalizeCandidate(candidatePath: string): Promise<string> {
  const unresolvedSegments: string[] = [];
  let currentPath = candidatePath;

  while (true) {
    try {
      const canonicalExistingPath = await realpath(currentPath);
      return path.join(canonicalExistingPath, ...unresolvedSegments.reverse());
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        throw error;
      }

      unresolvedSegments.push(path.basename(currentPath));
      currentPath = parentPath;
    }
  }
}

function isInsideOrEqual(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
