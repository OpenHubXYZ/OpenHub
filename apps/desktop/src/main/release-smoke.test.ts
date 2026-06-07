import { rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runDesktopReleaseSmoke } from './release-smoke';

const tempDirectories: string[] = [];

describe('desktop release smoke', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('runs the packaged startup skills flow in isolated directories', async () => {
    const workspace = await tempDir();
    const result = await runDesktopReleaseSmoke({
      dataDirectory: path.join(workspace, 'app-data'),
      workspaceDirectory: path.join(workspace, 'workspace')
    });

    expect(result).toEqual({
      status: 'passed',
      importedSkillName: 'packaged-smoke-helper',
      gitImportedSkillName: 'git-smoke-helper',
      zipImportedSkillName: 'zip-smoke-helper',
      indexedSkillName: 'indexed-smoke-helper',
      searchCount: 3,
      libraryCount: 1,
      previewCount: 1,
      syncStarted: false,
      pluginCount: 0
    });
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-release-smoke-test-'));
  tempDirectories.push(directory);
  return directory;
}
