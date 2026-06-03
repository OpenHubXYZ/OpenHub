import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PathSafetyError, assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

describe('path safety', () => {
  it('rejects target paths outside the allowed root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'theopenhub-path-root-'));

    await expect(ensurePathInsideRoot(root, path.join(root, '..', 'escape'))).rejects.toEqual(
      new PathSafetyError('path_outside_root', path.join(root, '..', 'escape'))
    );
  });

  it('rejects symlink escapes after canonicalization', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'theopenhub-path-root-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'theopenhub-path-outside-'));
    const linkPath = path.join(root, 'linked-outside');

    await symlink(outside, linkPath);
    await writeFile(path.join(outside, 'secret.txt'), 'secret');

    await expect(ensurePathInsideRoot(root, path.join(linkPath, 'secret.txt'))).rejects.toEqual(
      new PathSafetyError('path_outside_root', path.join(linkPath, 'secret.txt'))
    );
  });

  it('rejects zip slip entry names', () => {
    expect(() => assertZipEntryPathSafe('../SKILL.md')).toThrow(
      new PathSafetyError('zip_slip', '../SKILL.md')
    );
    expect(() => assertZipEntryPathSafe('/absolute/SKILL.md')).toThrow(
      new PathSafetyError('zip_slip', '/absolute/SKILL.md')
    );
  });
});
