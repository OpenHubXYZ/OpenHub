import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SqliteDatabase } from '@theopenhub/db';

export type PolicyScanLevel = 'safe' | 'warning' | 'critical';

export interface PolicyPack {
  id: string;
  name: string;
  allowedSources: string[];
  blockedRules: string[];
  requiredScanLevel: PolicyScanLevel;
  approvedPlugins: string[];
}

export interface PolicyEvaluation {
  allowed: boolean;
  reasons: string[];
}

export interface TeamBaselinePackage {
  name: string;
  collections: string[];
  policyPack: PolicyPack;
  rootTemplates: Array<{
    agentCode: string;
    scope: string;
    rootPathTemplate: string;
  }>;
}

export interface TeamBaselinePreview {
  name: string;
  changes: string[];
  writesAgentRoots: false;
}

export interface CreatePolicyServiceInput {
  database: SqliteDatabase;
}

export interface PolicyService {
  createPolicyPack(input: Omit<PolicyPack, 'id'>): PolicyPack;
  evaluateInstall(input: {
    policyPackId: string;
    sourceType: string;
    findingRuleIds: string[];
    scanLevel: PolicyScanLevel;
    pluginIds: string[];
  }): PolicyEvaluation;
  exportTeamBaseline(input: {
    outputDirectory: string;
    name: string;
    collectionIds: string[];
    policyPackId: string;
    rootTemplates: TeamBaselinePackage['rootTemplates'];
  }): Promise<{ outputDirectory: string }>;
  previewTeamBaseline(input: { packageDirectory: string }): Promise<TeamBaselinePreview>;
  applyTeamBaseline(input: { packageDirectory: string; confirm: boolean }): Promise<TeamBaselinePreview>;
}

export function createPolicyService(input: CreatePolicyServiceInput): PolicyService {
  return {
    createPolicyPack(policyInput) {
      const policy: PolicyPack = { id: randomUUID(), ...policyInput };
      input.database
        .prepare(
          `
            insert into policy_packs
              (id, name, allowed_sources_json, blocked_rules_json, required_scan_level, approved_plugins_json)
            values
              (@id, @name, @allowedSourcesJson, @blockedRulesJson, @requiredScanLevel, @approvedPluginsJson)
          `
        )
        .run({
          id: policy.id,
          name: policy.name,
          allowedSourcesJson: JSON.stringify(policy.allowedSources),
          blockedRulesJson: JSON.stringify(policy.blockedRules),
          requiredScanLevel: policy.requiredScanLevel,
          approvedPluginsJson: JSON.stringify(policy.approvedPlugins)
        });
      return policy;
    },

    evaluateInstall(evaluationInput) {
      const policy = getPolicyPack(input.database, evaluationInput.policyPackId);
      const reasons: string[] = [];

      if (!policy.allowedSources.includes(evaluationInput.sourceType)) {
        reasons.push(`source-blocked:${evaluationInput.sourceType}`);
      }
      for (const ruleId of evaluationInput.findingRuleIds) {
        if (policy.blockedRules.includes(ruleId)) {
          reasons.push(`rule-blocked:${ruleId}`);
        }
      }
      if (scanRank(evaluationInput.scanLevel) > scanRank(policy.requiredScanLevel)) {
        reasons.push(`scan-level-too-high:${evaluationInput.scanLevel}`);
      }
      for (const pluginId of evaluationInput.pluginIds) {
        if (!policy.approvedPlugins.includes(pluginId)) {
          reasons.push(`plugin-unapproved:${pluginId}`);
        }
      }

      return { allowed: reasons.length === 0, reasons };
    },

    async exportTeamBaseline({ outputDirectory, name, collectionIds, policyPackId, rootTemplates }) {
      const policyPack = getPolicyPack(input.database, policyPackId);
      const baseline: TeamBaselinePackage = {
        name,
        collections: collectionIds,
        policyPack,
        rootTemplates
      };

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(path.join(outputDirectory, 'baseline.json'), JSON.stringify(baseline, null, 2));
      return { outputDirectory };
    },

    async previewTeamBaseline({ packageDirectory }) {
      return previewBaseline(await readBaseline(packageDirectory));
    },

    async applyTeamBaseline({ packageDirectory, confirm }) {
      if (!confirm) {
        throw new Error('Baseline application requires explicit confirmation');
      }
      const baseline = await readBaseline(packageDirectory);
      const preview = previewBaseline(baseline);
      const policyId = randomUUID();
      input.database
        .prepare(
          `
            insert into policy_packs
              (id, name, allowed_sources_json, blocked_rules_json, required_scan_level, approved_plugins_json)
            values
              (@id, @name, @allowedSourcesJson, @blockedRulesJson, @requiredScanLevel, @approvedPluginsJson)
          `
        )
        .run({
          id: policyId,
          name: baseline.policyPack.name,
          allowedSourcesJson: JSON.stringify(baseline.policyPack.allowedSources),
          blockedRulesJson: JSON.stringify(baseline.policyPack.blockedRules),
          requiredScanLevel: baseline.policyPack.requiredScanLevel,
          approvedPluginsJson: JSON.stringify(baseline.policyPack.approvedPlugins)
        });
      input.database
        .prepare('insert into team_baselines (id, name, package_json) values (?, ?, ?)')
        .run(randomUUID(), baseline.name, JSON.stringify(baseline));
      return preview;
    }
  };
}

async function readBaseline(packageDirectory: string): Promise<TeamBaselinePackage> {
  return JSON.parse(await readFile(path.join(packageDirectory, 'baseline.json'), 'utf8')) as TeamBaselinePackage;
}

function previewBaseline(baseline: TeamBaselinePackage): TeamBaselinePreview {
  return {
    name: baseline.name,
    changes: [
      `policy-pack:create:${baseline.policyPack.name}`,
      ...baseline.collections.map((collectionId) => `collection:include:${collectionId}`),
      ...baseline.rootTemplates.map(
        (template) => `root-template:${template.agentCode}:${template.scope}:${template.rootPathTemplate}`
      )
    ],
    writesAgentRoots: false
  };
}

function getPolicyPack(database: SqliteDatabase, policyPackId: string): PolicyPack {
  const row = database
    .prepare(
      `
        select
          id,
          name,
          allowed_sources_json as allowedSourcesJson,
          blocked_rules_json as blockedRulesJson,
          required_scan_level as requiredScanLevel,
          approved_plugins_json as approvedPluginsJson
        from policy_packs
        where id = ?
      `
    )
    .get(policyPackId);

  if (!row) {
    throw new Error(`Policy pack not found: ${policyPackId}`);
  }

  const policy = row as {
    id: string;
    name: string;
    allowedSourcesJson: string;
    blockedRulesJson: string;
    requiredScanLevel: PolicyScanLevel;
    approvedPluginsJson: string;
  };
  return {
    id: policy.id,
    name: policy.name,
    allowedSources: JSON.parse(policy.allowedSourcesJson) as string[],
    blockedRules: JSON.parse(policy.blockedRulesJson) as string[],
    requiredScanLevel: policy.requiredScanLevel,
    approvedPlugins: JSON.parse(policy.approvedPluginsJson) as string[]
  };
}

function scanRank(level: PolicyScanLevel): number {
  return { safe: 0, warning: 1, critical: 2 }[level];
}
