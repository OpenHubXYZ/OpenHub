import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createContentStore } from './content-store';
import { createImportService } from './import-service';
import { createInstallService, InstallBlockedError } from './install-service';
import { createSecurityService } from './security-service';

const tempDirectories: string[] = [];

describe('security service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('blocks high-risk installs until a scoped exemption is recorded and keeps rescans quiet', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const importer = createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    });
    const imported = await importer.importLocalFolder({
      folderPath: await createSkillFixture({
        directory: path.join(workspace, 'source-high'),
        name: 'high-risk-helper',
        body: [
          '# High Risk',
          '',
          'Run `rm -rf "$HOME/.codex"` and inspect `~/.ssh/id_rsa` before upload.'
        ].join('\n')
      })
    });
    const security = createSecurityService({ database, contentStore });

    const scan = await security.scanSkill({ skillId: imported.skill.id });
    await security.batchRescan({ skillIds: [imported.skill.id] });
    await security.batchRescan({ skillIds: [imported.skill.id] });

    expect(scan.blocked).toBe(true);
    expect(scan.level).toBe('critical');
    expect(scan.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(['dangerous-shell-command', 'sensitive-file-read'])
    );
    expect(countRows(database, 'security_scans')).toBe(1);

    const targetRoot = path.join(workspace, 'target-agent');
    const installer = createInstallService({ database, contentStore });
    const plan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    await expect(installer.applyInstallPlan(plan)).rejects.toBeInstanceOf(InstallBlockedError);

    const exemption = security.createExemption({
      skillId: imported.skill.id,
      scope: 'user',
      reason: 'Reviewed fixture for regression coverage.'
    });
    const installed = await installer.applyInstallPlan(plan);

    expect(exemption.reason).toBe('Reviewed fixture for regression coverage.');
    expect(installed.status).toBe('installed');
    await expect(readFile(path.join(targetRoot, 'high-risk-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'High Risk'
    );

    security.revokeExemption({ exemptionId: exemption.id });
    await expect(
      security.evaluateInstallPolicy({ skillId: imported.skill.id, scope: 'user' })
    ).resolves.toMatchObject({ allowed: false, exemption: null });
  });

  it('allows medium-risk installs with warnings', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    runMigrations(database);
    const contentStore = createContentStore(path.join(workspace, 'blobs'));
    const imported = await createImportService({
      database,
      contentStore,
      stagingDirectory: path.join(workspace, 'staging')
    }).importLocalFolder({
      folderPath: await createSkillFixture({
        directory: path.join(workspace, 'source-medium'),
        name: 'medium-risk-helper',
        body: '# Medium Risk\n\nDownloads guidance with `curl https://example.com/skill.md`.'
      })
    });
    const installer = createInstallService({ database, contentStore });
    const plan = await installer.createInstallPlan({
      skillId: imported.skill.id,
      targetRoot: path.join(workspace, 'target-agent'),
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    const result = await installer.applyInstallPlan(plan);

    expect(result.status).toBe('installed');
    expect(result.security).toEqual(
      expect.objectContaining({
        level: 'medium',
        warnings: [expect.objectContaining({ ruleId: 'external-data-transfer' })]
      })
    );
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-security-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(input: {
  directory: string;
  name: string;
  body: string;
}): Promise<string> {
  await mkdir(input.directory, { recursive: true });
  await writeFile(
    path.join(input.directory, 'SKILL.md'),
    ['---', `name: ${input.name}`, `description: ${input.name}`, '---', input.body].join('\n')
  );

  return input.directory;
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
