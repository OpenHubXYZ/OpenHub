import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { createDesktopRuntime } from './desktop-runtime';

const smokeSkillName = 'packaged-smoke-helper';
const gitSmokeSkillName = 'git-smoke-helper';
const zipSmokeSkillName = 'zip-smoke-helper';
const execFileAsync = promisify(execFile);

export interface DesktopReleaseSmokeInput {
  dataDirectory: string;
  workspaceDirectory?: string;
}

export interface DesktopReleaseSmokeResult {
  status: 'passed';
  importedSkillName: string;
  gitImportedSkillName: string;
  zipImportedSkillName: string;
  installedFiles: number;
  searchCount: number;
  exportedManifestVerified: boolean;
  uninstalledFiles: number;
  libraryCount: number;
  syncStarted: boolean;
  pluginCount: number;
}

export async function runDesktopReleaseSmoke(
  input: DesktopReleaseSmokeInput
): Promise<DesktopReleaseSmokeResult> {
  const workspaceDirectory = input.workspaceDirectory ?? path.join(input.dataDirectory, 'release-smoke');
  const sourceDirectory = path.join(workspaceDirectory, 'source');
  const gitSourceDirectory = path.join(workspaceDirectory, 'source-git');
  const zipPath = path.join(workspaceDirectory, 'source-zip.zip');
  const targetRoot = path.join(workspaceDirectory, 'target/codex-skills');
  const runtime = createDesktopRuntime({
    dataDirectory: input.dataDirectory,
    homeDirectory: path.join(workspaceDirectory, 'home')
  });

  await createSmokeSkillFixture(sourceDirectory);
  await createGitSmokeSkillFixture(gitSourceDirectory);
  await createZipSmokeSkillFixture(zipPath);

  const imported = await runtime.dispatch('import.localFolder', { folderPath: sourceDirectory });
  assertCondition(
    imported.skill.name === smokeSkillName,
    `Expected smoke import to return ${smokeSkillName}`
  );
  const gitImported = await runtime.dispatch('import.git', { gitUrl: `file://${gitSourceDirectory}` });
  assertCondition(
    gitImported.skill.name === gitSmokeSkillName,
    `Expected Git smoke import to return ${gitSmokeSkillName}`
  );
  const zipImported = await runtime.dispatch('import.zip', { zipPath });
  assertCondition(
    zipImported.skill.name === zipSmokeSkillName,
    `Expected ZIP smoke import to return ${zipSmokeSkillName}`
  );

  const search = await runtime.dispatch('library.search', { query: 'smoke' });
  assertCondition(
    search.some((skill) => skill.name === smokeSkillName) &&
      search.some((skill) => skill.name === gitSmokeSkillName) &&
      search.some((skill) => skill.name === zipSmokeSkillName),
    'Expected smoke search to find local, Git, and ZIP imported skills'
  );

  const exported = await runtime.dispatch('export.skill', {
    skillId: imported.skill.id,
    outputDirectory: path.join(workspaceDirectory, 'exported-skill')
  });
  const exportedManifest = await readFile(path.join(exported.outputDirectory, 'manifest.json'), 'utf8');
  assertCondition(
    exportedManifest.includes(smokeSkillName) && exportedManifest.includes('hash'),
    'Expected skill export manifest to include metadata and file hashes'
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

  const uninstall = await runtime.dispatch('install.uninstall', {
    installationId: installResult.installationId
  });
  assertCondition(
    uninstall.status === 'uninstalled' && uninstall.installationId === installResult.installationId,
    'Expected smoke uninstall to report the app-owned installation as uninstalled'
  );
  await assertMissing(path.join(targetRoot, `${smokeSkillName}/SKILL.md`));

  return {
    status: 'passed',
    importedSkillName: imported.skill.name,
    gitImportedSkillName: gitImported.skill.name,
    zipImportedSkillName: zipImported.skill.name,
    installedFiles: plan.writes.length,
    searchCount: search.length,
    exportedManifestVerified: true,
    uninstalledFiles: plan.writes.length,
    libraryCount: library.length,
    syncStarted: sync.shouldStart,
    pluginCount: plugins.plugins.length
  };
}

async function createSmokeSkillFixture(directory: string, name = smokeSkillName): Promise<void> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    [
      '---',
      `name: ${name}`,
      `description: ${name} description`,
      'tags: [release, smoke]',
      '---',
      '# Packaged Smoke Helper'
    ].join('\n')
  );
  await writeFile(path.join(directory, 'references/guide.md'), `${name} guide`);
}

async function createGitSmokeSkillFixture(directory: string): Promise<void> {
  await createSmokeSkillFixture(directory, gitSmokeSkillName);
  await execFileAsync('git', ['init'], { cwd: directory });
  await execFileAsync('git', ['add', '.'], { cwd: directory });
  await execFileAsync(
    'git',
    ['-c', 'user.name=OpenHub Smoke', '-c', 'user.email=smoke@example.com', 'commit', '-m', 'fixture'],
    { cwd: directory }
  );
}

async function createZipSmokeSkillFixture(zipPath: string): Promise<void> {
  await writeFile(
    zipPath,
    createRawZipArchive([
      {
        fileName: 'SKILL.md',
        content: [
          '---',
          `name: ${zipSmokeSkillName}`,
          `description: ${zipSmokeSkillName} description`,
          'tags: [release, smoke]',
          '---',
          '# ZIP Smoke Helper'
        ].join('\n')
      },
      {
        fileName: 'references/guide.md',
        content: `${zipSmokeSkillName} guide`
      }
    ])
  );
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertMissing(filePath: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }

  throw new Error(`Expected file to be removed: ${filePath}`);
}

function createRawZipArchive(files: Array<{ fileName: string; content: string }>): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  for (const file of files) {
    const fileNameBytes = Buffer.from(file.fileName);
    const contentBytes = Buffer.from(file.content);
    const checksum = crc32(contentBytes);
    const localHeader = Buffer.alloc(30);
    let offset = 0;
    localHeader.writeUInt32LE(0x04034b50, offset);
    offset += 4;
    localHeader.writeUInt16LE(20, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt32LE(checksum, offset);
    offset += 4;
    localHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    localHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    localHeader.writeUInt16LE(fileNameBytes.length, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);

    const localRecord = Buffer.concat([localHeader, fileNameBytes, contentBytes]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    offset = 0;
    centralHeader.writeUInt32LE(0x02014b50, offset);
    offset += 4;
    centralHeader.writeUInt16LE(20, offset);
    offset += 2;
    centralHeader.writeUInt16LE(20, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt32LE(checksum, offset);
    offset += 4;
    centralHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    centralHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    centralHeader.writeUInt16LE(fileNameBytes.length, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt32LE(0, offset);
    offset += 4;
    centralHeader.writeUInt32LE(localOffset, offset);
    centralRecords.push(Buffer.concat([centralHeader, fileNameBytes]));
    localOffset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endOfCentralDirectory = Buffer.alloc(22);
  let offset = 0;
  endOfCentralDirectory.writeUInt32LE(0x06054b50, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(0, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(files.length, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(files.length, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt32LE(localOffset, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);

  return Buffer.concat([...localRecords, centralDirectory, endOfCentralDirectory]);
}

function crc32(buffer: Buffer): number {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum ^= byte;
    for (let index = 0; index < 8; index += 1) {
      checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
  }

  return (checksum ^ 0xffffffff) >>> 0;
}
