import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SqliteDatabase } from '@theopenhub/db';
import YAML from 'yaml';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';
import { createSecurityService } from './security-service';
import type { InstallPolicyResult, SecurityFinding, SecurityLevel, SecurityService } from './security-service';

export type InstallConflictState = 'clean' | 'conflict';
export type InstallWriteConflict = 'none' | 'exists';
export type InstallProjectionMode = 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
export type InstallRootKind = 'user' | 'project';
export type InstallCompatibilityStatus = 'compatible' | 'incompatible';
export type InstallLifecycleStatus = 'reinstalled' | 'relinked';

export interface CreateInstallServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
  securityService?: SecurityService;
}

export interface InstallPlanWrite {
  relativePath: string;
  targetPath: string;
  hash: string;
  size: number;
  conflict: InstallWriteConflict;
}

export interface InstallPlan {
  skillId: string;
  versionId: string;
  skillName: string;
  skillSlug: string;
  targetRoot: string;
  installPath: string;
  agentCode: string;
  agentDisplayName: string;
  adapterVersion: string;
  scope: string;
  rootKind: InstallRootKind;
  projectionMode: InstallProjectionMode;
  conflictState: InstallConflictState;
  writes: InstallPlanWrite[];
}

export interface InstallCompatibilityCheck {
  status: InstallCompatibilityStatus;
  skillId: string;
  versionId: string;
  agentCode: string;
  targetRoot: string;
  supportedAgents: string[];
  reasons: string[];
}

export interface InstallResult {
  status: 'installed' | 'exported';
  installationId: string | null;
  targetRoot?: string;
  security: {
    level: SecurityLevel;
    warnings: SecurityFinding[];
  };
}

export interface MultiTargetInstallResult {
  installed: InstallResult[];
  blocked: Array<{ targetRoot: string; conflictState: InstallConflictState; reason: string }>;
}

export interface InstallLifecycleResult {
  status: InstallLifecycleStatus;
  installationId: string;
  targetRoot: string;
  projectionMode: InstallProjectionMode;
  compatibility: InstallCompatibilityCheck;
}

export interface InstallLockResult {
  status: 'locked' | 'unlocked';
  installationId: string;
  readOnlyLocked: boolean;
}

export interface InstallService {
  checkCompatibility(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: InstallRootKind;
    projectionMode?: InstallProjectionMode;
    versionId?: string;
  }): Promise<InstallCompatibilityCheck>;
  createInstallPlan(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: InstallRootKind;
    projectionMode?: InstallProjectionMode;
  }): Promise<InstallPlan>;
  createMultiTargetInstallPlan(input: {
    skillId: string;
    projectionMode?: InstallProjectionMode;
    targets: Array<{
      targetRoot: string;
      agentCode: string;
      agentDisplayName: string;
      adapterVersion: string;
      scope: string;
      rootKind?: InstallRootKind;
    }>;
  }): Promise<InstallPlan[]>;
  applyInstallPlan(plan: InstallPlan): Promise<InstallResult>;
  applyMultiTargetInstallPlan(input: { plans: InstallPlan[] }): Promise<MultiTargetInstallResult>;
  reinstall(input: { installationId: string }): Promise<InstallLifecycleResult>;
  relink(input: {
    installationId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: InstallRootKind;
    projectionMode?: InstallProjectionMode;
  }): Promise<InstallLifecycleResult>;
  setReadOnlyLock(input: { installationId: string; locked: boolean }): Promise<InstallLockResult>;
  uninstall(input: { installationId: string }): Promise<void>;
}

export class InstallBlockedError extends Error {
  public readonly code = 'install_blocked';

  constructor(public readonly policy: InstallPolicyResult) {
    super(`Install blocked by security policy: ${policy.level}`);
    this.name = 'InstallBlockedError';
  }
}

interface SkillFileRow {
  skillId: string;
  skillName: string;
  skillSlug: string;
  versionId: string;
  relativePath: string;
  blobHash: string;
  fileSize: number;
}

interface InstallTargetInput {
  skillId: string;
  targetRoot: string;
  agentCode: string;
  agentDisplayName: string;
  adapterVersion: string;
  scope: string;
  rootKind?: InstallRootKind;
  projectionMode?: InstallProjectionMode;
  versionId?: string;
}

interface InstallationRow {
  id: string;
  skillId: string;
  versionId: string;
  rootPath: string;
  agentCode: string;
  agentDisplayName: string;
  adapterVersion: string;
  scope: string;
  rootKind: InstallRootKind;
  installPath: string;
  projectionMode: InstallProjectionMode;
  status: string;
  readOnlyLocked: number;
}

export function createInstallService(input: CreateInstallServiceInput): InstallService {
  const securityService = input.securityService ?? createSecurityService(input);

  return {
    async checkCompatibility(checkInput) {
      const versionId = checkInput.versionId ?? first(getLatestSkillFiles(input.database, checkInput.skillId)).versionId;
      return checkCompatibility(input.database, input.contentStore, {
        skillId: checkInput.skillId,
        versionId,
        agentCode: checkInput.agentCode,
        targetRoot: checkInput.targetRoot
      });
    },

    async createInstallPlan(planInput) {
      return createInstallPlanForVersion(input.database, planInput);
    },

    async createMultiTargetInstallPlan({ skillId, projectionMode = 'copy', targets }) {
      return Promise.all(
        targets.map((target) =>
          this.createInstallPlan({
            skillId,
            ...target,
            projectionMode
          })
        )
      );
    },

    async applyInstallPlan(plan) {
      return writeInstallPlan(input, securityService, plan);
    },

    async applyMultiTargetInstallPlan({ plans }) {
      const installed: InstallResult[] = [];
      const blocked: MultiTargetInstallResult['blocked'] = [];

      for (const plan of plans) {
        if (plan.conflictState === 'conflict') {
          blocked.push({
            targetRoot: plan.targetRoot,
            conflictState: plan.conflictState,
            reason: 'conflict'
          });
          continue;
        }

        installed.push(await this.applyInstallPlan(plan));
      }

      return { installed, blocked };
    },

    async reinstall({ installationId }) {
      const installation = getInstallation(input.database, installationId);
      assertInstallationWritable(installation);
      const compatibility = await checkCompatibility(input.database, input.contentStore, {
        skillId: installation.skillId,
        versionId: installation.versionId,
        agentCode: installation.agentCode,
        targetRoot: installation.rootPath
      });
      assertCompatible(compatibility);

      await removeInstallationFiles(input.database, installationId);
      const plan = await createInstallPlanForVersion(input.database, {
        skillId: installation.skillId,
        versionId: installation.versionId,
        targetRoot: installation.rootPath,
        agentCode: installation.agentCode,
        agentDisplayName: installation.agentDisplayName,
        adapterVersion: installation.adapterVersion,
        scope: installation.scope,
        rootKind: installation.rootKind,
        projectionMode: installation.projectionMode
      });
      const result = await writeInstallPlan(input, securityService, plan, installationId);
      return {
        status: 'reinstalled',
        installationId: result.installationId ?? installationId,
        targetRoot: plan.targetRoot,
        projectionMode: plan.projectionMode,
        compatibility
      };
    },

    async relink(relinkInput) {
      const installation = getInstallation(input.database, relinkInput.installationId);
      assertInstallationWritable(installation);
      const projectionMode = normalizeProjectionMode(relinkInput.projectionMode);
      if (projectionMode === 'mirror-export') {
        throw new Error('Relink requires an installed projection mode');
      }
      const plan = await createInstallPlanForVersion(input.database, {
        skillId: installation.skillId,
        versionId: installation.versionId,
        targetRoot: relinkInput.targetRoot,
        agentCode: relinkInput.agentCode,
        agentDisplayName: relinkInput.agentDisplayName,
        adapterVersion: relinkInput.adapterVersion,
        scope: relinkInput.scope,
        ...(relinkInput.rootKind ? { rootKind: relinkInput.rootKind } : {}),
        projectionMode
      });
      const compatibility = await checkCompatibility(input.database, input.contentStore, {
        skillId: installation.skillId,
        versionId: installation.versionId,
        agentCode: relinkInput.agentCode,
        targetRoot: relinkInput.targetRoot
      });
      assertCompatible(compatibility);
      if (plan.conflictState === 'conflict' || plan.writes.some((write) => write.conflict !== 'none')) {
        throw new Error('Install plan has conflicts');
      }

      await removeInstallationFiles(input.database, relinkInput.installationId);
      const result = await writeInstallPlan(input, securityService, plan, relinkInput.installationId);
      return {
        status: 'relinked',
        installationId: result.installationId ?? relinkInput.installationId,
        targetRoot: plan.targetRoot,
        projectionMode: plan.projectionMode,
        compatibility
      };
    },

    async setReadOnlyLock({ installationId, locked }) {
      getInstallation(input.database, installationId);
      input.database
        .prepare(
          `
            update installations
            set read_only_locked = @locked,
                last_verified_at = current_timestamp
            where id = @installationId
          `
        )
        .run({ installationId, locked: locked ? 1 : 0 });
      return {
        status: locked ? 'locked' : 'unlocked',
        installationId,
        readOnlyLocked: locked
      };
    },

    async uninstall({ installationId }) {
      const installation = getInstallation(input.database, installationId);
      assertInstallationWritable(installation);
      await removeInstallationFiles(input.database, installationId);
      markUninstalled(input.database, installationId);
    }
  };
}

async function createInstallPlanForVersion(
  database: SqliteDatabase,
  planInput: InstallTargetInput
): Promise<InstallPlan> {
  const projectionMode = normalizeProjectionMode(planInput.projectionMode);
  const files = getSkillFiles(database, {
    skillId: planInput.skillId,
    ...(planInput.versionId ? { versionId: planInput.versionId } : {})
  });
  if (files.length === 0) {
    throw new Error(`Skill has no files: ${planInput.skillId}`);
  }

  await mkdir(planInput.targetRoot, { recursive: true });
  const firstFile = first(files);
  const installPath = path.join(planInput.targetRoot, firstFile.skillSlug);
  const writes: InstallPlanWrite[] = [];

  for (const file of files) {
    const relativePath = assertZipEntryPathSafe(file.relativePath);
    const targetPath = path.join(installPath, ...relativePath.split('/'));
    const safeTargetPath = await ensurePathInsideRoot(planInput.targetRoot, targetPath);
    const conflict: InstallWriteConflict = (await fileExists(safeTargetPath)) ? 'exists' : 'none';

    writes.push({
      relativePath,
      targetPath: safeTargetPath,
      hash: file.blobHash,
      size: file.fileSize,
      conflict
    });
  }

  return {
    skillId: planInput.skillId,
    versionId: firstFile.versionId,
    skillName: firstFile.skillName,
    skillSlug: firstFile.skillSlug,
    targetRoot: planInput.targetRoot,
    installPath,
    agentCode: planInput.agentCode,
    agentDisplayName: planInput.agentDisplayName,
    adapterVersion: planInput.adapterVersion,
    scope: planInput.scope,
    rootKind: planInput.rootKind ?? (planInput.scope === 'project' ? 'project' : 'user'),
    projectionMode,
    conflictState: writes.some((write) => write.conflict !== 'none') ? 'conflict' : 'clean',
    writes
  };
}

async function writeInstallPlan(
  input: CreateInstallServiceInput,
  securityService: SecurityService,
  plan: InstallPlan,
  installationIdOverride?: string
): Promise<InstallResult> {
  normalizeProjectionMode(plan.projectionMode);
  assertInstallPlanTargetWritable(input.database, plan, installationIdOverride);
  const compatibility = await checkCompatibility(input.database, input.contentStore, {
    skillId: plan.skillId,
    versionId: plan.versionId,
    agentCode: plan.agentCode,
    targetRoot: plan.targetRoot
  });
  assertCompatible(compatibility);

  if (plan.conflictState === 'conflict' || plan.writes.some((write) => write.conflict !== 'none')) {
    throw new Error('Install plan has conflicts');
  }

  for (const write of plan.writes) {
    const safeTargetPath = await ensurePathInsideRoot(plan.targetRoot, write.targetPath);
    if (await fileExists(safeTargetPath)) {
      throw new Error(`Install plan has conflicts: ${write.relativePath}`);
    }
  }

  const policy = await securityService.evaluateInstallPolicy({
    skillId: plan.skillId,
    scope: plan.scope
  });
  if (!policy.allowed) {
    throw new InstallBlockedError(policy);
  }

  for (const write of plan.writes) {
    await projectWrite(input.contentStore, plan, write);
  }

  if (plan.projectionMode === 'mirror-export') {
    return {
      status: 'exported',
      installationId: null,
      targetRoot: plan.targetRoot,
      security: {
        level: policy.level,
        warnings: policy.scan.findings
      }
    };
  }

  const installationId = recordInstallation(input.database, plan, installationIdOverride);
  return {
    status: 'installed',
    installationId,
    targetRoot: plan.targetRoot,
    security: {
      level: policy.level,
      warnings: policy.scan.findings
    }
  };
}

async function checkCompatibility(
  database: SqliteDatabase,
  contentStore: ContentStore,
  input: { skillId: string; versionId: string; agentCode: string; targetRoot: string }
): Promise<InstallCompatibilityCheck> {
  const supportedAgents = await supportedAgentsForVersion(database, contentStore, input.versionId);
  const agentCode = input.agentCode.trim().toLowerCase();
  const compatible = supportedAgents.length === 0 || supportedAgents.includes(agentCode);

  return {
    status: compatible ? 'compatible' : 'incompatible',
    skillId: input.skillId,
    versionId: input.versionId,
    agentCode: input.agentCode,
    targetRoot: input.targetRoot,
    supportedAgents,
    reasons: compatible ? [] : [`Skill supports ${supportedAgents.join(', ')} only`]
  };
}

function assertCompatible(compatibility: InstallCompatibilityCheck): void {
  if (compatibility.status === 'incompatible') {
    throw new Error(`Install target is incompatible: ${compatibility.reasons.join('; ')}`);
  }
}

async function supportedAgentsForVersion(
  database: SqliteDatabase,
  contentStore: ContentStore,
  versionId: string
): Promise<string[]> {
  const manifest = database
    .prepare(
      `
        select blob_hash as blobHash
        from skill_files
        where skill_version_id = ?
          and relative_path = 'SKILL.md'
      `
    )
    .get(versionId) as { blobHash: string } | undefined;
  if (!manifest) {
    return [];
  }

  const content = await contentStore.readBlob(manifest.blobHash);
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content.toString('utf8'))?.[1] ?? '';
  const metadata = YAML.parse(frontmatter) as
    | {
        supported_agents?: unknown;
        supportedAgents?: unknown;
        compatible_agents?: unknown;
        compatibleAgents?: unknown;
        agents?: unknown;
      }
    | null;
  const declared =
    metadata?.supported_agents ??
    metadata?.supportedAgents ??
    metadata?.compatible_agents ??
    metadata?.compatibleAgents ??
    metadata?.agents;
  return parseSupportedAgents(declared);
}

function parseSupportedAgents(input: unknown): string[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,\s]+/)
      : [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort();
}

async function removeInstallationFiles(database: SqliteDatabase, installationId: string): Promise<void> {
  for (const file of getInstallationFiles(database, installationId)) {
    const safeTargetPath = await ensurePathInsideRoot(file.rootPath, file.targetPath);
    try {
      await unlink(safeTargetPath);
    } catch (error) {
      if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

function assertInstallationWritable(installation: InstallationRow): void {
  if (installation.readOnlyLocked === 1) {
    throw new Error(`Installation is read-only locked: ${installation.id}`);
  }
}

function assertInstallPlanTargetWritable(
  database: SqliteDatabase,
  plan: InstallPlan,
  installationIdOverride?: string
): void {
  if (installationIdOverride) {
    assertInstallationWritable(getInstallation(database, installationIdOverride));
    return;
  }

  const rootId = stableId('agent-root', `${plan.agentCode}:${plan.targetRoot}:${plan.scope}`);
  const installationId = stableId('installation', `${plan.skillId}:${rootId}:${plan.installPath}`);
  const row = database
    .prepare('select read_only_locked as readOnlyLocked from installations where id = ?')
    .get(installationId) as { readOnlyLocked: number } | undefined;
  if (row?.readOnlyLocked === 1) {
    throw new Error(`Installation is read-only locked: ${installationId}`);
  }
}

async function projectWrite(
  contentStore: ContentStore,
  plan: InstallPlan,
  write: InstallPlanWrite
): Promise<void> {
  const safeTargetPath = await ensurePathInsideRoot(plan.targetRoot, write.targetPath);
  await mkdir(path.dirname(safeTargetPath), { recursive: true });

  if (plan.projectionMode === 'copy' || plan.projectionMode === 'mirror-export') {
    const content = await contentStore.readBlob(write.hash);
    await writeFile(safeTargetPath, content, { flag: 'wx' });
    return;
  }

  if (plan.projectionMode === 'symlink') {
    const mirrorPath = await mirrorBlobInsideRoot(contentStore, plan.targetRoot, write.hash);
    await symlink(path.relative(path.dirname(safeTargetPath), mirrorPath), safeTargetPath);
    return;
  }

  const blobPath = contentStore.resolveBlobPath(write.hash);
  try {
    await link(blobPath, safeTargetPath);
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    throw new Error(`Projection mode hardlink is unsupported by this filesystem: ${code ?? 'unknown'}`);
  }
}

async function mirrorBlobInsideRoot(
  contentStore: ContentStore,
  targetRoot: string,
  hash: string
): Promise<string> {
  const mirrorPath = await ensurePathInsideRoot(targetRoot, path.join(targetRoot, '.openhub-blobs', hash));
  if (!(await fileExists(mirrorPath))) {
    await mkdir(path.dirname(mirrorPath), { recursive: true });
    await writeFile(mirrorPath, await contentStore.readBlob(hash), { flag: 'wx' }).catch((error: unknown) => {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EEXIST') {
        return;
      }

      throw error;
    });
  }

  return mirrorPath;
}

function normalizeProjectionMode(input: InstallProjectionMode | undefined): InstallProjectionMode {
  const mode = input ?? 'copy';
  if (!['copy', 'symlink', 'hardlink', 'mirror-export'].includes(mode)) {
    throw new Error(`Unsupported projection mode: ${String(mode)}`);
  }

  return mode;
}

function getLatestSkillFiles(database: SqliteDatabase, skillId: string): SkillFileRow[] {
  return getSkillFiles(database, { skillId });
}

function getSkillFiles(
  database: SqliteDatabase,
  input: { skillId: string; versionId?: string }
): SkillFileRow[] {
  if (input.versionId) {
    return database
      .prepare(
        `
          select
            s.id as skillId,
            s.name as skillName,
            s.slug as skillSlug,
            sv.id as versionId,
            sf.relative_path as relativePath,
            sf.blob_hash as blobHash,
            sf.file_size as fileSize
          from skills s
          join skill_versions sv on sv.skill_id = s.id
          join skill_files sf on sf.skill_version_id = sv.id
          where s.id = @skillId
            and sv.id = @versionId
          order by
            case when sf.relative_path = 'SKILL.md' then 0 else 1 end,
            sf.relative_path collate nocase
        `
      )
      .all(input)
      .map(skillFileRow);
  }

  return database
    .prepare(
      `
        select
          s.id as skillId,
          s.name as skillName,
          s.slug as skillSlug,
          sv.id as versionId,
          sf.relative_path as relativePath,
          sf.blob_hash as blobHash,
          sf.file_size as fileSize
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        join skill_files sf on sf.skill_version_id = sv.id
        where s.id = @skillId
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = @skillId
          )
        order by
          case when sf.relative_path = 'SKILL.md' then 0 else 1 end,
          sf.relative_path collate nocase
      `
    )
    .all({ skillId: input.skillId })
    .map(skillFileRow);
}

function recordInstallation(
  database: SqliteDatabase,
  plan: InstallPlan,
  installationIdOverride?: string
): string {
  const agentId = stableId('agent', plan.agentCode);
  const rootId = stableId('agent-root', `${plan.agentCode}:${plan.targetRoot}:${plan.scope}`);
  const installationId = installationIdOverride ?? stableId('installation', `${plan.skillId}:${rootId}:${plan.installPath}`);

  const record = database.transaction(() => {
    database
      .prepare(
        `
          insert into agents
            (id, code, display_name, adapter_version, detected, os_scope, updated_at)
          values
            (@id, @code, @displayName, @adapterVersion, 1, @osScope, current_timestamp)
          on conflict(code) do update set
            display_name = excluded.display_name,
            adapter_version = excluded.adapter_version,
            detected = 1,
            os_scope = excluded.os_scope,
            updated_at = current_timestamp
        `
      )
      .run({
        id: agentId,
        code: plan.agentCode,
        displayName: plan.agentDisplayName,
        adapterVersion: plan.adapterVersion,
        osScope: plan.scope
      });

    database
      .prepare(
        `
          insert into agent_roots
            (id, agent_id, root_path, scope, writable, is_default, root_kind)
          values
            (@id, @agentId, @rootPath, @scope, 1, 0, @rootKind)
          on conflict(agent_id, root_path, scope) do update set
            writable = excluded.writable,
            root_kind = excluded.root_kind
        `
      )
      .run({
        id: rootId,
        agentId,
        rootPath: plan.targetRoot,
        scope: plan.scope,
        rootKind: plan.rootKind
      });

    database
      .prepare(
        `
          insert into installations
            (id, skill_id, agent_root_id, installed_version_id, install_scope, install_path, status, projection_mode)
          values
            (@id, @skillId, @rootId, @versionId, @installScope, @installPath, 'installed', @projectionMode)
          on conflict(id) do update set
            agent_root_id = excluded.agent_root_id,
            installed_version_id = excluded.installed_version_id,
            install_scope = excluded.install_scope,
            install_path = excluded.install_path,
            projection_mode = excluded.projection_mode,
            status = 'installed',
            last_verified_at = current_timestamp
        `
      )
      .run({
        id: installationId,
        skillId: plan.skillId,
        rootId,
        versionId: plan.versionId,
        installScope: plan.scope,
        installPath: plan.installPath,
        projectionMode: plan.projectionMode
      });

    database.prepare('delete from installation_files where installation_id = ?').run(installationId);
    const insertFile = database.prepare(
      `
        insert into installation_files
          (id, installation_id, relative_path, target_path, blob_hash)
        values
          (@id, @installationId, @relativePath, @targetPath, @blobHash)
      `
    );

    for (const write of plan.writes) {
      insertFile.run({
        id: randomUUID(),
        installationId,
        relativePath: write.relativePath,
        targetPath: write.targetPath,
        blobHash: write.hash
      });
    }
  });

  record();
  return installationId;
}

function getInstallation(database: SqliteDatabase, installationId: string): InstallationRow {
  const row = database
    .prepare(
      `
        select
          i.id,
          i.skill_id as skillId,
          i.installed_version_id as versionId,
          ar.root_path as rootPath,
          a.code as agentCode,
          a.display_name as agentDisplayName,
          a.adapter_version as adapterVersion,
          ar.scope,
          ar.root_kind as rootKind,
          i.install_path as installPath,
          i.projection_mode as projectionMode,
          i.status,
          i.read_only_locked as readOnlyLocked
        from installations i
        join agent_roots ar on ar.id = i.agent_root_id
        join agents a on a.id = ar.agent_id
        where i.id = ?
      `
    )
    .get(installationId) as InstallationRow | undefined;

  if (!row) {
    throw new Error(`Installation not found: ${installationId}`);
  }

  return row;
}

function getInstallationFiles(
  database: SqliteDatabase,
  installationId: string
): Array<{ rootPath: string; targetPath: string }> {
  return database
    .prepare(
      `
        select ar.root_path as rootPath, installation_files.target_path as targetPath
        from installation_files
        join installations i on i.id = installation_files.installation_id
        join agent_roots ar on ar.id = i.agent_root_id
        where installation_files.installation_id = ?
        order by length(installation_files.target_path) desc
      `
    )
    .all(installationId) as Array<{ rootPath: string; targetPath: string }>;
}

function markUninstalled(database: SqliteDatabase, installationId: string): void {
  const update = database.transaction(() => {
    database
      .prepare("update installations set status = 'uninstalled', last_verified_at = current_timestamp where id = ?")
      .run(installationId);
    database.prepare('delete from installation_files where installation_id = ?').run(installationId);
  });

  update();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function skillFileRow(row: unknown): SkillFileRow {
  return row as SkillFileRow;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}

function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) {
    throw new Error('Expected at least one item');
  }

  return item;
}
