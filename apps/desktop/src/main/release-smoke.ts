import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createDesktopRuntime } from './desktop-runtime';

const smokeSkillName = 'packaged-smoke-helper';

export interface DesktopReleaseSmokeInput {
  dataDirectory: string;
  workspaceDirectory?: string;
}

export interface DesktopReleaseSmokeResult {
  status: 'passed';
  importedSkillName: string;
  installedFiles: number;
  libraryCount: number;
  syncStarted: boolean;
  pluginCount: number;
}

export async function runDesktopReleaseSmoke(
  input: DesktopReleaseSmokeInput
): Promise<DesktopReleaseSmokeResult> {
  const workspaceDirectory = input.workspaceDirectory ?? path.join(input.dataDirectory, 'release-smoke');
  const sourceDirectory = path.join(workspaceDirectory, 'source');
  const targetRoot = path.join(workspaceDirectory, 'target/codex-skills');
  const runtime = createDesktopRuntime({
    dataDirectory: input.dataDirectory,
    homeDirectory: path.join(workspaceDirectory, 'home')
  });

  await createSmokeSkillFixture(sourceDirectory);

  const imported = await runtime.dispatch('import.localFolder', { folderPath: sourceDirectory });
  assertCondition(
    imported.skill.name === smokeSkillName,
    `Expected smoke import to return ${smokeSkillName}`
  );

  const plan = await runtime.dispatch('install.createPlan', {
    skillId: imported.skill.id,
    targetRoot,
    agentCode: 'codex',
    agentDisplayName: 'Codex',
    adapterVersion: 'release-smoke',
    scope: 'user'
  });
  assertCondition(plan.conflictState === 'clean', 'Expected smoke install plan to be conflict-free');
  assertCondition(plan.writes.length === 2, 'Expected smoke install plan to include two files');

  const installResult = await runtime.dispatch('install.applyPlan', { plan });
  assertCondition(installResult.status === 'installed', 'Expected smoke install to complete');

  const installedManifest = await readFile(path.join(targetRoot, `${smokeSkillName}/SKILL.md`), 'utf8');
  assertCondition(
    installedManifest.includes(smokeSkillName),
    'Expected smoke install to project SKILL.md into target root'
  );

  const library = await runtime.dispatch('library.list', {});
  assertCondition(
    library.some((skill) => skill.name === smokeSkillName && skill.installStatus === 'installed'),
    'Expected installed smoke skill in library list'
  );

  const security = await runtime.dispatch('security.scan', { skillId: imported.skill.id });
  assertCondition(!security.blocked, 'Expected smoke skill to pass security scan');

  const sync = await runtime.dispatch('sync.startupPlan', {});
  assertCondition(!sync.shouldStart, 'Expected sync to remain disabled by default');

  const plugins = await runtime.dispatch('plugins.centerState', {});
  assertCondition(plugins.plugins.length === 0, 'Expected plugins to remain disabled by default');

  return {
    status: 'passed',
    importedSkillName: imported.skill.name,
    installedFiles: plan.writes.length,
    libraryCount: library.length,
    syncStarted: sync.shouldStart,
    pluginCount: plugins.plugins.length
  };
}

async function createSmokeSkillFixture(directory: string): Promise<void> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    [
      '---',
      `name: ${smokeSkillName}`,
      `description: ${smokeSkillName} description`,
      'tags: [release, smoke]',
      '---',
      '# Packaged Smoke Helper'
    ].join('\n')
  );
  await writeFile(path.join(directory, 'references/guide.md'), `${smokeSkillName} guide`);
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
