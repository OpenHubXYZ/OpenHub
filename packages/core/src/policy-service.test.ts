import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createPolicyService } from './policy-service';

const tempDirectories: string[] = [];

describe('policy service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('enforces local policy packs and previews team baselines before applying them', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'theopenhub-policy-'));
    tempDirectories.push(workspace);
    const database = createMemoryDatabase();
    runMigrations(database);
    const policies = createPolicyService({ database });

    const policy = policies.createPolicyPack({
      name: 'Team Safe Baseline',
      allowedSources: ['local', 'mirror'],
      blockedRules: ['dangerous-shell'],
      requiredScanLevel: 'safe',
      approvedPlugins: ['signed-importer']
    });

    expect(
      policies.evaluateInstall({
        policyPackId: policy.id,
        sourceType: 'git',
        findingRuleIds: [],
        scanLevel: 'safe',
        pluginIds: ['signed-importer']
      })
    ).toMatchObject({ allowed: false, reasons: ['source-blocked:git'] });
    expect(
      policies.evaluateInstall({
        policyPackId: policy.id,
        sourceType: 'local',
        findingRuleIds: ['dangerous-shell'],
        scanLevel: 'safe',
        pluginIds: ['signed-importer']
      })
    ).toMatchObject({ allowed: false, reasons: ['rule-blocked:dangerous-shell'] });

    const baselineDirectory = path.join(workspace, 'baseline-package');
    const exported = await policies.exportTeamBaseline({
      outputDirectory: baselineDirectory,
      name: 'Frontend Team',
      collectionIds: ['collection-1'],
      policyPackId: policy.id,
      rootTemplates: [
        {
          agentCode: 'codex',
          scope: 'project',
          rootPathTemplate: '.codex/skills'
        }
      ]
    });
    const preview = await policies.previewTeamBaseline({ packageDirectory: exported.outputDirectory });

    expect(JSON.parse(await readFile(path.join(baselineDirectory, 'baseline.json'), 'utf8'))).toMatchObject({
      name: 'Frontend Team',
      policyPack: { name: 'Team Safe Baseline' }
    });
    expect(preview).toMatchObject({
      name: 'Frontend Team',
      changes: [
        'policy-pack:create:Team Safe Baseline',
        'collection:include:collection-1',
        'root-template:codex:project:.codex/skills'
      ],
      writesAgentRoots: false
    });

    const beforeAgentRoots = countRows(database, 'agent_roots');
    await policies.applyTeamBaseline({ packageDirectory: exported.outputDirectory, confirm: true });
    expect(countRows(database, 'agent_roots')).toBe(beforeAgentRoots);
  });
});

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
