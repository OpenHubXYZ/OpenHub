import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import AdmZip from 'adm-zip';
import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createImportService } from './import-service';
import { createContentStore } from './content-store';
import { PathSafetyError } from './path-safety';

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];

describe('import service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('imports local, Git, and ZIP fixtures into SQLite and content storage', async () => {
    const workspace = await tempDir('theopenhub-import-');
    const localSkill = await createSkillFixture(path.join(workspace, 'local-skill'), 'local-helper');
    const gitSource = await createGitFixture(path.join(workspace, 'git-skill'), 'git-helper');
    const zipPath = await createZipFixture(path.join(workspace, 'zip-skill.zip'), 'zip-helper');

    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const importer = createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    });

    const localResult = await importer.importLocalFolder({ folderPath: localSkill });
    const gitResult = await importer.importGit({ gitUrl: `file://${gitSource}` });
    const zipResult = await importer.importZip({ zipPath });

    expect([localResult.skill.name, gitResult.skill.name, zipResult.skill.name]).toEqual([
      'local-helper',
      'git-helper',
      'zip-helper'
    ]);

    for (const result of [localResult, gitResult, zipResult]) {
      const manifest = result.files.find((file) => file.relativePath === 'SKILL.md');
      expect(manifest).toBeDefined();
      await expect(readFile(contentStore.resolveBlobPath(manifest!.hash), 'utf8')).resolves.toContain(
        result.skill.name
      );
      expect(result.stagedFrom).toContain(path.join(workspace, 'staging'));
    }
  });

  it('rejects zip slip and symlink escape import fixtures', async () => {
    const workspace = await tempDir('theopenhub-import-risk-');
    const database = createMemoryDatabase();
    runMigrations(database);
    const importer = createImportService({
      database,
      contentStore: createContentStore(path.join(workspace, 'blobs')),
      stagingDirectory: path.join(workspace, 'staging')
    });

    const zipPath = path.join(workspace, 'zip-slip.zip');
    await writeFile(zipPath, createRawZipSlipArchive('../SKILL.md', '---\nname: bad\n---\n'));

    await expect(importer.importZip({ zipPath })).rejects.toEqual(
      new PathSafetyError('zip_slip', '../SKILL.md')
    );

    const outside = await mkdtemp(path.join(tmpdir(), 'theopenhub-outside-'));
    tempDirectories.push(outside);
    const source = path.join(workspace, 'symlink-skill');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'SKILL.md'), '---\nname: symlink-skill\n---\n');
    await writeFile(path.join(outside, 'secret.md'), 'secret');
    await import('node:fs/promises').then(({ symlink }) =>
      symlink(path.join(outside, 'secret.md'), path.join(source, 'secret.md'))
    );

    await expect(importer.importLocalFolder({ folderPath: source })).rejects.toMatchObject({
      code: 'path_outside_root'
    });
  });

  it('imports TAR, Git sparse subpaths, and verified offline mirrors', async () => {
    const workspace = await tempDir('theopenhub-import-expanded-');
    const tarSource = await createSkillFixture(path.join(workspace, 'tar-skill'), 'tar-helper');
    const tarPath = path.join(workspace, 'tar-helper.tar');
    await execFileAsync('tar', ['-cf', tarPath, '-C', tarSource, '.']);
    const sparseRepo = path.join(workspace, 'sparse-repo');
    await createSkillFixture(path.join(sparseRepo, 'skills/git-sparse-helper'), 'git-sparse-helper');
    await createSkillFixture(path.join(sparseRepo, 'other/ignored-helper'), 'ignored-helper');
    await execFileAsync('git', ['init'], { cwd: sparseRepo });
    await execFileAsync('git', ['add', '.'], { cwd: sparseRepo });
    await execFileAsync(
      'git',
      ['-c', 'user.name=OpenHub Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
      { cwd: sparseRepo }
    );

    const mirrorDirectory = path.join(workspace, 'mirror');
    await mkdir(path.join(mirrorDirectory, 'files'), { recursive: true });
    const mirrorContent = ['---', 'name: mirror-helper', 'description: Mirror helper', '---'].join('\n');
    const mirrorHash = await import('node:crypto').then(({ createHash }) =>
      createHash('sha256').update(mirrorContent).digest('hex')
    );
    await writeFile(path.join(mirrorDirectory, 'files/SKILL.md'), mirrorContent);
    await writeFile(
      path.join(mirrorDirectory, 'manifest.json'),
      JSON.stringify(
        {
          name: 'mirror-helper',
          slug: 'mirror-helper',
          versionNo: 1,
          files: [{ relativePath: 'SKILL.md', hash: mirrorHash, size: Buffer.byteLength(mirrorContent) }]
        },
        null,
        2
      )
    );

    const database = createMemoryDatabase();
    runMigrations(database);
    const importer = createImportService({
      database,
      contentStore: createContentStore(path.join(workspace, 'blobs')),
      stagingDirectory: path.join(workspace, 'staging')
    });

    const tarResult = await importer.importTar({ tarPath });
    const sparseResult = await importer.importGitSparse({
      gitUrl: `file://${sparseRepo}`,
      subpath: 'skills/git-sparse-helper'
    });
    const mirrorResult = await importer.importMirror({ mirrorDirectory });

    expect([tarResult.skill.name, sparseResult.skill.name, mirrorResult.skill.name]).toEqual([
      'tar-helper',
      'git-sparse-helper',
      'mirror-helper'
    ]);
    expect('signatureStatus' in mirrorResult).toBe(false);
    expect(countRows(database, 'skills')).toBe(3);
  });

  it('rejects tar slip and unsafe TAR link fixtures', async () => {
    const workspace = await tempDir('theopenhub-import-tar-risk-');
    const importer = createImportService({
      database: createMemoryDatabase(),
      contentStore: createContentStore(path.join(workspace, 'blobs')),
      stagingDirectory: path.join(workspace, 'staging')
    });

    await expect(
      importer.importTar({ tarPath: await createRawTarArchive(path.join(workspace, 'tar-slip.tar'), '../SKILL.md') })
    ).rejects.toMatchObject({ code: 'zip_slip' });
    await expect(
      importer.importTar({
        tarPath: await createRawTarArchive(path.join(workspace, 'tar-link.tar'), 'SKILL.md', {
          typeFlag: '2',
          linkName: '/etc/passwd'
        })
      })
    ).rejects.toThrow(/unsafe TAR link/);
  });
});

async function tempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(directory: string, name: string): Promise<string> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${name} description`, 'tags: [p0, import]', '---', '# Skill'].join(
      '\n'
    )
  );
  await writeFile(path.join(directory, 'references/guide.md'), `${name} guide`);
  return directory;
}

async function createGitFixture(directory: string, name: string): Promise<string> {
  await createSkillFixture(directory, name);
  await execFileAsync('git', ['init'], { cwd: directory });
  await execFileAsync('git', ['add', '.'], { cwd: directory });
  await execFileAsync(
    'git',
    ['-c', 'user.name=OpenHub Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
    { cwd: directory }
  );
  return directory;
}

async function createZipFixture(zipPath: string, name: string): Promise<string> {
  const zip = new AdmZip();
  zip.addFile('SKILL.md', Buffer.from(['---', `name: ${name}`, 'description: Zip import', '---'].join('\n')));
  zip.addFile('references/guide.md', Buffer.from(`${name} guide`));
  zip.writeZip(zipPath);
  return zipPath;
}

function createRawZipSlipArchive(fileName: string, content: string): Buffer {
  const fileNameBytes = Buffer.from(fileName);
  const contentBytes = Buffer.from(content);
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
  localHeader.writeUInt32LE(0, offset);
  offset += 4;
  localHeader.writeUInt32LE(contentBytes.length, offset);
  offset += 4;
  localHeader.writeUInt32LE(contentBytes.length, offset);
  offset += 4;
  localHeader.writeUInt16LE(fileNameBytes.length, offset);
  offset += 2;
  localHeader.writeUInt16LE(0, offset);

  const localRecord = Buffer.concat([localHeader, fileNameBytes, contentBytes]);
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
  centralHeader.writeUInt32LE(0, offset);
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
  centralHeader.writeUInt32LE(0, offset);

  const centralRecord = Buffer.concat([centralHeader, fileNameBytes]);
  const endOfCentralDirectory = Buffer.alloc(22);
  offset = 0;
  endOfCentralDirectory.writeUInt32LE(0x06054b50, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(0, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(1, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(1, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt32LE(centralRecord.length, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt32LE(localRecord.length, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);

  return Buffer.concat([localRecord, centralRecord, endOfCentralDirectory]);
}

async function createRawTarArchive(
  tarPath: string,
  fileName: string,
  options: { typeFlag?: string; linkName?: string } = {}
): Promise<string> {
  const content = Buffer.from('---\nname: bad\n---\n');
  const header = Buffer.alloc(512, 0);
  header.write(fileName, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write((options.typeFlag ? 0 : content.length).toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write('00000000000\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write(options.typeFlag ?? '0', 156, 1, 'ascii');
  if (options.linkName) {
    header.write(options.linkName, 157, 100, 'utf8');
  }
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  await writeFile(tarPath, Buffer.concat([header, options.typeFlag ? Buffer.alloc(0) : content, Buffer.alloc(1024)]));
  return tarPath;
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
