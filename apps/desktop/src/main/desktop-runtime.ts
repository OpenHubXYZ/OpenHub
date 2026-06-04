import { mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createBuiltInAgentAdapters } from '@theopenhub/adapters';
import {
  createContentStore,
  createImportService,
  createInstallService,
  createPluginService,
  createSecurityService,
  createSyncService,
  scanAgentLibraries,
  type InstallPlan as CoreInstallPlan,
  type InstallResult as CoreInstallResult,
  type SecurityScanResult as CoreSecurityScanResult
} from '@theopenhub/core';
import {
  createFileDatabase,
  createLibraryRepository,
  createReviewRepository,
  createSkillRepository,
  createUsageRepository,
  runMigrations,
  type SkillRecord,
  type SqliteDatabase
} from '@theopenhub/db';
import {
  appInfo,
  desktopShellContract,
  parseIpcRequest,
  parseIpcResponse,
  type DesktopWorkspaceState,
  type ImportedSkillResult,
  type InstallPlan,
  type InstallResult,
  type IpcChannel,
  type LibraryScanResult,
  type LibrarySkillSummary,
  type PluginsState,
  type SecurityCenterState,
  type SecurityScanResult,
  type SyncCenterState,
  type SyncStartupPlan
} from '@theopenhub/shared';

export interface CreateDesktopRuntimeInput {
  dataDirectory: string;
  homeDirectory?: string;
  database?: SqliteDatabase;
}

export interface DesktopRuntime {
  dispatch<C extends IpcChannel>(channel: C, payload: unknown): Promise<RuntimeDispatchResult<C>>;
}

type RuntimeDispatchResult<C extends IpcChannel> = C extends typeof desktopShellContract.appInfo.channel
  ? typeof appInfo
  : C extends typeof desktopShellContract.libraryList.channel
    ? LibrarySkillSummary[]
    : C extends typeof desktopShellContract.libraryScan.channel
      ? LibraryScanResult
      : C extends typeof desktopShellContract.workspaceState.channel
        ? DesktopWorkspaceState
        : C extends typeof desktopShellContract.importLocalFolder.channel
          ? ImportedSkillResult
          : C extends typeof desktopShellContract.installCreatePlan.channel
            ? InstallPlan
            : C extends typeof desktopShellContract.installApplyPlan.channel
              ? InstallResult
              : C extends typeof desktopShellContract.securityScan.channel
                ? SecurityScanResult
                : C extends typeof desktopShellContract.syncStartupPlan.channel
                  ? SyncStartupPlan
                  : C extends typeof desktopShellContract.pluginsCenterState.channel
                    ? PluginsState
                    : never;

interface RuntimeMemory {
  importItems: Array<{ label: string; status: string }>;
  installPlan: DesktopWorkspaceState['managementFlow']['installPlan'];
  installResult: DesktopWorkspaceState['managementFlow']['installResult'];
}

export function createDesktopRuntime(input: CreateDesktopRuntimeInput): DesktopRuntime {
  mkdirSync(input.dataDirectory, { recursive: true });
  const database = input.database ?? createFileDatabase(path.join(input.dataDirectory, 'theopenhub.sqlite3'));
  runMigrations(database);

  const contentStore = createContentStore(path.join(input.dataDirectory, 'blobs'));
  const importer = createImportService({
    database,
    contentStore,
    stagingDirectory: path.join(input.dataDirectory, 'staging')
  });
  const installer = createInstallService({ database, contentStore });
  const security = createSecurityService({ database, contentStore });
  const sync = createSyncService({ database });
  const plugins = createPluginService({ database });
  const adapters = createBuiltInAgentAdapters(
    input.homeDirectory ? { homeDirectory: input.homeDirectory } : {}
  );
  const memory: RuntimeMemory = {
    importItems: [],
    installPlan: null,
    installResult: null
  };

  return {
    async dispatch<C extends IpcChannel>(
      channel: C,
      payload: unknown
    ): Promise<RuntimeDispatchResult<C>> {
      const request = parseIpcRequest(channel, payload);

      if (channel === desktopShellContract.appInfo.channel) {
        return parseIpcResponse(channel, appInfo) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.libraryList.channel) {
        return parseIpcResponse(channel, listLibrarySkills(database)) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.libraryScan.channel) {
        const result = await scanAgentLibraries({ database, adapters });
        createUsageRepository(database).recordEvent({
          eventType: 'agent.scan',
          subject: `Scanned ${result.indexedSkills.length} local agent skills`,
          metadata: {
            indexedSkills: result.indexedSkills.length,
            errors: result.errors.length
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.workspaceState.channel) {
        return parseIpcResponse(
          channel,
          workspaceState(database, memory, plugins.getPluginCenterState())
        ) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.importLocalFolder.channel) {
        await mkdir(input.dataDirectory, { recursive: true });
        const imported = await importer.importLocalFolder(request as { folderPath: string });
        const result = toImportedSkillResult(imported);
        memory.importItems = [{ label: result.skill.name, status: 'imported' }, ...memory.importItems].slice(0, 5);
        createUsageRepository(database).recordEvent({
          eventType: 'skill.import',
          skillId: result.skill.id,
          skillName: result.skill.name,
          subject: `Imported ${result.skill.name}`,
          metadata: {
            fileCount: result.files.length,
            stagedFrom: result.stagedFrom
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installCreatePlan.channel) {
        const plan = await installer.createInstallPlan(
          request as {
            skillId: string;
            targetRoot: string;
            agentCode: string;
            agentDisplayName: string;
            adapterVersion: string;
            scope: string;
          }
        );
        const result = toInstallPlan(plan);
        memory.installPlan = {
          skillName: result.skillName,
          targetRoot: result.targetRoot,
          conflictState: result.conflictState,
          writeCount: result.writes.length
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.plan',
          skillId: result.skillId,
          skillName: result.skillName,
          agentCode: result.agentCode,
          agentDisplayName: result.agentDisplayName,
          subject: `Planned ${result.skillName} for ${result.agentDisplayName}`,
          metadata: {
            conflictState: result.conflictState,
            writeCount: result.writes.length,
            targetRoot: result.targetRoot
          }
        });
        if (result.conflictState === 'conflict') {
          createReviewRepository(database).upsertReviewItem({
            itemType: 'install.conflict',
            subjectId: `${result.skillId}:${result.targetRoot}`,
            skillId: result.skillId,
            skillName: result.skillName,
            title: `${result.skillName} install conflict`,
            detail: `${result.writes.length} planned writes`,
            reason: 'Existing files conflict',
            source: 'Install plan',
            reviewer: 'Maintainer',
            risk: 'Medium',
            status: 'Open',
            metadata: {
              agentCode: result.agentCode,
              targetRoot: result.targetRoot
            }
          });
        }
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installApplyPlan.channel) {
        const { plan } = request as { plan: InstallPlan };
        const result = toInstallResult(await installer.applyInstallPlan(plan as CoreInstallPlan));
        memory.installResult = {
          status: result.status,
          message: `Installed ${plan.writes.length} files by copy projection.`
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.apply',
          skillId: plan.skillId,
          skillName: plan.skillName,
          agentCode: plan.agentCode,
          agentDisplayName: plan.agentDisplayName,
          subject: `Installed ${plan.skillName} to ${plan.agentDisplayName}`,
          metadata: {
            installationId: result.installationId,
            writeCount: plan.writes.length
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.securityScan.channel) {
        const result = toSecurityScanResult(await security.scanSkill(request as { skillId: string }));
        const skill = createSkillRepository(database).getSkill(result.skillId);
        const skillName = skill?.name ?? result.skillId;
        createUsageRepository(database).recordEvent({
          eventType: 'security.scan',
          skillId: result.skillId,
          skillName,
          subject: `Security scanned ${skillName}`,
          metadata: {
            level: result.level,
            blocked: result.blocked,
            findingCount: result.findings.length
          }
        });
        recordReviewForSecurityScan(database, result, skill);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncStartupPlan.channel) {
        return parseIpcResponse(channel, sync.getStartupPlan()) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsCenterState.channel) {
        return parseIpcResponse(channel, plugins.getPluginCenterState()) as RuntimeDispatchResult<C>;
      }

      throw new Error(`Unhandled IPC channel: ${channel}`);
    }
  };
}

function listLibrarySkills(database: SqliteDatabase): LibrarySkillSummary[] {
  return createLibraryRepository(database).listLibrarySkills();
}

function workspaceState(
  database: SqliteDatabase,
  memory: RuntimeMemory,
  plugins: PluginsState
): DesktopWorkspaceState {
  return {
    appInfo,
    librarySkills: listLibrarySkills(database),
    skills: createSkillRepository(database).listSkills().map(toSkillSummary),
    managementFlow: {
      importItems: memory.importItems,
      installPlan: memory.installPlan,
      installResult: memory.installResult
    },
    securityCenter: securityCenterState(database),
    usageCenter: createUsageRepository(database).getUsageCenterState(),
    reviewCenter: createReviewRepository(database).getReviewCenterState(),
    governance: governanceState(database),
    syncCenter: syncCenterState(database),
    plugins
  };
}

function securityCenterState(database: SqliteDatabase): SecurityCenterState {
  const scans = database
    .prepare(
      `
        select
          s.name as skillName,
          ss.score as score,
          ss.level as level,
          ss.blocked as blocked,
          ss.scanned_at as scannedAt
        from security_scans ss
        join skill_versions sv on sv.id = ss.skill_version_id
        join skills s on s.id = sv.skill_id
        order by ss.scanned_at desc
      `
    )
    .all() as Array<{ skillName: string; score: number; level: string; blocked: number; scannedAt: string }>;
  const findings = database
    .prepare(
      `
        select rule_id as ruleId, severity
        from security_findings
        order by severity desc, rule_id
        limit 20
      `
    )
    .all() as Array<{ ruleId: string; severity: string }>;
  const exemptions = database
    .prepare(
      `
        select s.name as skillName, se.scope, se.reason
        from security_exemptions se
        join skills s on s.id = se.skill_id
        where se.revoked_at is null
        order by se.created_at desc
      `
    )
    .all() as Array<{ skillName: string; scope: string; reason: string }>;

  const posture = scans.reduce<(typeof scans)[number] | null>((highest, scan) => {
    if (!highest || scan.score > highest.score) {
      return scan;
    }

    if (scan.score === highest.score && scan.scannedAt > highest.scannedAt) {
      return scan;
    }

    return highest;
  }, null);

  return {
    queue: scans.map((scan) => ({
      skillName: scan.skillName,
      status: scan.blocked ? 'blocked' : 'passed'
    })),
    riskScore: posture?.score ?? 0,
    level: posture?.level ?? 'safe',
    findings: findings.map((finding) => ({
      ruleName: titleizeRuleId(finding.ruleId),
      severity: finding.severity
    })),
    history: scans.map((scan) => ({
      skillName: scan.skillName,
      level: scan.level
    })),
    exemptions
  };
}

function governanceState(database: SqliteDatabase): DesktopWorkspaceState['governance'] {
  const history = database
    .prepare(
      `
        select version_no as versionNo, coalesce(change_summary, '') as summary
        from skill_versions
        order by created_at desc
        limit 10
      `
    )
    .all() as Array<{ versionNo: number; summary: string }>;
  const collections = database
    .prepare(
      `
        select c.name, count(ci.skill_id) as skillCount
        from collections c
        left join collection_items ci on ci.collection_id = c.id
        group by c.id
        order by c.name collate nocase
      `
    )
    .all() as Array<{ name: string; skillCount: number }>;

  return {
    history,
    diff: [],
    collections
  };
}

function syncCenterState(database: SqliteDatabase): SyncCenterState {
  const profiles = database
    .prepare(
      "select mode, case when enabled = 1 then 'enabled' else 'disabled' end as status from sync_profiles order by created_at desc"
    )
    .all() as Array<{ mode: string; status: string }>;
  const outbox = database
    .prepare('select entity_type as entityType, status from sync_outbox order by created_at desc limit 20')
    .all() as Array<{ entityType: string; status: string }>;
  const inbox = database
    .prepare('select entity_type as entityType, status from sync_inbox order by received_at desc limit 20')
    .all() as Array<{ entityType: string; status: string }>;
  const conflicts = database
    .prepare('select entity_type as entityType, status from sync_conflicts order by created_at desc limit 20')
    .all() as Array<{ entityType: string; status: string }>;

  return { profiles, outbox, inbox, conflicts };
}

function toImportedSkillResult(input: {
  skill: SkillRecord;
  files: ImportedSkillResult['files'];
  stagedFrom: string;
}): ImportedSkillResult {
  return {
    skill: toSkillSummary(input.skill),
    files: input.files,
    stagedFrom: input.stagedFrom
  };
}

function toSkillSummary(skill: SkillRecord): DesktopWorkspaceState['skills'][number] {
  return {
    id: skill.id,
    versionId: skill.versionId,
    name: skill.name,
    description: skill.description,
    versionNo: skill.versionNo
  };
}

function toInstallPlan(plan: CoreInstallPlan): InstallPlan {
  return {
    skillId: plan.skillId,
    versionId: plan.versionId,
    skillName: plan.skillName,
    skillSlug: plan.skillSlug,
    targetRoot: plan.targetRoot,
    installPath: plan.installPath,
    agentCode: plan.agentCode,
    agentDisplayName: plan.agentDisplayName,
    adapterVersion: plan.adapterVersion,
    scope: plan.scope,
    conflictState: plan.conflictState,
    writes: plan.writes
  };
}

function toInstallResult(result: CoreInstallResult): InstallResult {
  return {
    status: result.status,
    installationId: result.installationId,
    security: {
      level: result.security.level,
      warnings: result.security.warnings
    }
  };
}

function toSecurityScanResult(result: CoreSecurityScanResult): SecurityScanResult {
  return {
    id: result.id,
    skillId: result.skillId,
    versionId: result.versionId,
    score: result.score,
    level: result.level,
    blocked: result.blocked,
    rulesetVersion: result.rulesetVersion,
    findings: result.findings
  };
}

function recordReviewForSecurityScan(
  database: SqliteDatabase,
  result: SecurityScanResult,
  skill: SkillRecord | null
): void {
  const finding = result.findings.find((candidate) =>
    ['medium', 'high', 'critical'].includes(candidate.severity.toLowerCase())
  );
  if (!finding) {
    return;
  }

  const skillName = skill?.name ?? result.skillId;
  createReviewRepository(database).upsertReviewItem({
    itemType: 'security.finding',
    subjectId: result.id,
    skillId: result.skillId,
    skillName,
    title: `${skillName} security review`,
    detail: `v${skill?.versionNo ?? 1} security scan`,
    reason: finding.ruleName,
    source: 'Security scan',
    reviewer: 'Maintainer',
    risk: titleizeRuleId(result.level),
    status: 'Open',
    metadata: {
      scanId: result.id,
      ruleId: finding.ruleId,
      category: finding.category,
      relativePath: finding.relativePath,
      lineNo: finding.lineNo
    }
  });
}

function titleizeRuleId(ruleId: string): string {
  return ruleId
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
