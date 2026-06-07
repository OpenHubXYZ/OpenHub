import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, rm, stat, symlink } from 'node:fs/promises';
import path from 'node:path';

import { createLibraryRepository } from '@theopenhub/db';
import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';

export type ProjectionMode = 'copy' | 'symlink';
export type InstallPlanStatus = 'ready' | 'conflict' | 'blocked';
export type InstallWriteStatus = 'clean' | 'conflict' | 'blocked';
export type InstallErrorCode =
  | 'skill_not_found'
  | 'root_not_found'
  | 'root_not_directory'
  | 'unsafe_relative_path'
  | 'path_outside_root'
  | 'parent_path_conflict'
  | 'directory_conflict'
  | 'conflict_requires_overwrite'
  | 'unexpected_target_conflict'
  | 'installation_not_found'
  | 'installation_not_active';

export interface InstallPlanWrite {
  relativePath: string;
  targetPath: string;
  sourceHash: string;
  action: ProjectionMode;
  status: InstallWriteStatus;
  reason?: string;
}

export interface InstallPlan {
  id: string;
  skillId: string;
  skillVersionId: string;
  skillName: string;
  skillSlug: string;
  targetRoot: string;
  targetSkillPath: string;
  agentCode: string;
  agentDisplayName: string;
  adapterVersion: string;
  scope: string;
  rootKind?: 'user' | 'project';
  projectionMode: ProjectionMode;
  status: InstallPlanStatus;
  writes: InstallPlanWrite[];
}

export interface CreateInstallPlanInput {
  skillId: string;
  targetRoot: string;
  agentCode: string;
  agentDisplayName: string;
  adapterVersion: string;
  scope: string;
  rootKind?: 'user' | 'project';
  projectionMode: ProjectionMode;
}

export interface ApplyInstallPlanInput {
  plan: InstallPlan;
  confirmOverwrite: boolean;
}

export interface InstallResult {
  status: 'installed';
  installationId: string;
  skillId: string;
  targetSkillPath: string;
  files: InstallPlanWrite[];
}

export interface InstallService {
  createPlan(input: CreateInstallPlanInput): Promise<InstallPlan>;
  applyPlan(input: ApplyInstallPlanInput): Promise<InstallResult>;
  uninstall(input: { installationId: string }): Promise<{ status: 'uninstalled'; installationId: string }>;
}

export class InstallServiceError extends Error {
  constructor(
    readonly code: InstallErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'InstallServiceError';
  }
}

interface CreateInstallServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
}

interface ProjectionSkill {
  id: string;
  name: string;
  slug: string;
  versionId: string;
  files: ProjectionFile[];
}

interface ProjectionFile {
  relativePath: string;
  hash: string;
}

interface TargetInspection {
  status: InstallWriteStatus;
  reason?: InstallErrorCode;
}

export function createInstallService(input: CreateInstallServiceInput): InstallService {
  return {
    async createPlan(planInput) {
      const skill = getProjectionSkill(input.database, planInput.skillId);
      const skillSlug = safeDirectoryName(skill.slug, skill.name);
      const normalizedFiles = skill.files.map((file) => ({
        ...file,
        relativePath: normalizeRelativePath(file.relativePath)
      }));
      const rootPath = await normalizeRoot(planInput.targetRoot);
      const targetSkillPath = path.join(rootPath, skillSlug);
      const writes: InstallPlanWrite[] = [];

      for (const file of normalizedFiles) {
        const relativePath = file.relativePath;
        const targetPath = path.join(targetSkillPath, ...relativePath.split('/'));
        const inspection = await inspectTargetPath(rootPath, targetPath);
        writes.push({
          relativePath,
          targetPath,
          sourceHash: file.hash,
          action: planInput.projectionMode,
          status: inspection.status,
          ...(inspection.reason ? { reason: inspection.reason } : {})
        });
      }

      return {
        id: randomUUID(),
        skillId: skill.id,
        skillVersionId: skill.versionId,
        skillName: skill.name,
        skillSlug,
        targetRoot: rootPath,
        targetSkillPath,
        agentCode: planInput.agentCode,
        agentDisplayName: planInput.agentDisplayName,
        adapterVersion: planInput.adapterVersion,
        scope: planInput.scope,
        ...(planInput.rootKind ? { rootKind: planInput.rootKind } : {}),
        projectionMode: planInput.projectionMode,
        status: planStatus(writes),
        writes
      };
    },

    async applyPlan({ plan, confirmOverwrite }) {
      const rootPath = await normalizeRoot(plan.targetRoot);
      if (path.resolve(rootPath) !== path.resolve(plan.targetRoot)) {
        throw new InstallServiceError('path_outside_root', `Plan root changed after canonicalization: ${plan.targetRoot}`);
      }

      for (const write of plan.writes) {
        normalizeRelativePath(write.relativePath);
        const inspection = await inspectTargetPath(plan.targetRoot, write.targetPath);
        if (inspection.status === 'blocked') {
          throw new InstallServiceError(inspection.reason ?? 'path_outside_root', `Blocked target path: ${write.targetPath}`);
        }
        if (inspection.status === 'conflict' && write.status !== 'conflict') {
          throw new InstallServiceError('unexpected_target_conflict', `Unexpected target conflict: ${write.targetPath}`);
        }
        if (inspection.status === 'conflict' && !confirmOverwrite) {
          throw new InstallServiceError('conflict_requires_overwrite', `Target conflict requires overwrite confirmation: ${write.targetPath}`);
        }
      }

      if (plan.writes.some((write) => write.status === 'blocked')) {
        const blocked = plan.writes.find((write) => write.status === 'blocked');
        throw new InstallServiceError(
          (blocked?.reason as InstallErrorCode | undefined) ?? 'path_outside_root',
          `Blocked install plan: ${blocked?.targetPath ?? plan.targetSkillPath}`
        );
      }

      for (const write of plan.writes) {
        if (write.status === 'conflict') {
          await rm(write.targetPath, { force: false });
        }
        await mkdir(path.dirname(write.targetPath), { recursive: true });
        const sourcePath = input.contentStore.resolveBlobPath(write.sourceHash);
        if (plan.projectionMode === 'copy') {
          await copyFile(sourcePath, write.targetPath);
        } else {
          await symlink(sourcePath, write.targetPath);
        }
      }

      const installationId = randomUUID();
      recordInstallation(input.database, plan, installationId);

      return {
        status: 'installed',
        installationId,
        skillId: plan.skillId,
        targetSkillPath: plan.targetSkillPath,
        files: plan.writes
      };
    },

    async uninstall({ installationId }) {
      const installation = getActiveInstallation(input.database, installationId);
      const files = listInstallationFiles(input.database, installationId);

      for (const file of files) {
        const inspection = await inspectTargetPath(installation.targetRootPath, file.targetPath);
        if (inspection.status === 'blocked') {
          throw new InstallServiceError(inspection.reason ?? 'path_outside_root', `Blocked uninstall path: ${file.targetPath}`);
        }
        if (inspection.status === 'conflict') {
          await rm(file.targetPath, { force: true });
        }
      }

      const markUninstalled = input.database.transaction(() => {
        input.database
          .prepare('update installation_files set removed_at = current_timestamp where installation_id = ?')
          .run(installationId);
        input.database
          .prepare(
            `
              update installations
              set status = 'uninstalled',
                  uninstalled_at = current_timestamp
              where id = ?
            `
          )
          .run(installationId);
        input.database
          .prepare(
            `
              update indexed_skill_locations
              set visibility_status = 'uninstalled',
                  last_indexed_at = current_timestamp
              where installation_id = ?
            `
          )
          .run(installationId);
      });
      markUninstalled();

      return { status: 'uninstalled', installationId };
    }
  };
}

function getProjectionSkill(database: SqliteDatabase, skillId: string): ProjectionSkill {
  const skill = database
    .prepare(
      `
        select
          s.id,
          s.name,
          s.slug,
          sv.id as versionId
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        where s.id = ?
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = s.id
          )
      `
    )
    .get(skillId) as Omit<ProjectionSkill, 'files'> | undefined;

  if (!skill) {
    throw new InstallServiceError('skill_not_found', `Skill not found: ${skillId}`);
  }

  const files = database
    .prepare(
      `
        select
          sf.relative_path as relativePath,
          sf.blob_hash as hash
        from skill_files sf
        where sf.skill_version_id = ?
        order by
          case when sf.relative_path = 'SKILL.md' then 0 else 1 end,
          sf.relative_path collate nocase
      `
    )
    .all(skill.versionId) as ProjectionFile[];

  return { ...skill, files };
}

async function normalizeRoot(targetRoot: string): Promise<string> {
  const rootPath = path.resolve(targetRoot);
  try {
    const rootStats = await stat(rootPath);
    if (!rootStats.isDirectory()) {
      throw new InstallServiceError('root_not_directory', `Install root is not a directory: ${targetRoot}`);
    }
  } catch (error) {
    if (error instanceof InstallServiceError) {
      throw error;
    }
    throw new InstallServiceError('root_not_found', `Install root not found: ${targetRoot}`);
  }
  return rootPath;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'));
  if (
    normalized.length === 0 ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    throw new InstallServiceError('unsafe_relative_path', `Unsafe skill file path: ${relativePath}`);
  }
  return normalized;
}

function safeDirectoryName(slug: string, name: string): string {
  const candidate = slug.trim() || name.trim();
  if (
    candidate.length > 0 &&
    !candidate.includes('/') &&
    !candidate.includes('\\') &&
    candidate !== '.' &&
    candidate !== '..'
  ) {
    return candidate;
  }

  const fallback = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!fallback) {
    throw new InstallServiceError('unsafe_relative_path', `Unsafe skill directory name: ${name}`);
  }
  return fallback;
}

async function inspectTargetPath(rootPath: string, targetPath: string): Promise<TargetInspection> {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  if (!isInsideOrEqual(resolvedRoot, resolvedTarget)) {
    return { status: 'blocked', reason: 'path_outside_root' };
  }

  const parentInspection = await inspectParentPath(resolvedRoot, path.dirname(resolvedTarget));
  if (parentInspection.status === 'blocked') {
    return parentInspection;
  }

  try {
    const targetStats = await lstat(resolvedTarget);
    if (targetStats.isDirectory()) {
      return { status: 'blocked', reason: 'directory_conflict' };
    }
    return { status: 'conflict' };
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'clean' };
    }
    throw error;
  }
}

async function inspectParentPath(rootPath: string, parentPath: string): Promise<TargetInspection> {
  if (!isInsideOrEqual(rootPath, parentPath)) {
    return { status: 'blocked', reason: 'path_outside_root' };
  }

  const relativeParent = path.relative(rootPath, parentPath);
  if (!relativeParent) {
    return { status: 'clean' };
  }

  let current = rootPath;
  for (const segment of relativeParent.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        return { status: 'blocked', reason: 'path_outside_root' };
      }
      if (!stats.isDirectory()) {
        return { status: 'blocked', reason: 'parent_path_conflict' };
      }
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { status: 'clean' };
      }
      throw error;
    }
  }

  return { status: 'clean' };
}

function planStatus(writes: InstallPlanWrite[]): InstallPlanStatus {
  if (writes.some((write) => write.status === 'blocked')) {
    return 'blocked';
  }
  if (writes.some((write) => write.status === 'conflict')) {
    return 'conflict';
  }
  return 'ready';
}

function recordInstallation(database: SqliteDatabase, plan: InstallPlan, installationId: string): void {
  const agentId = stableId('agent', plan.agentCode);
  const rootId = stableId('agent-root', `${plan.agentCode}:${plan.targetRoot}:${plan.scope}`);
  const locationId = stableId('indexed-skill-location', `${plan.skillId}:${rootId}:${plan.targetSkillPath}`);

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
            writable = 1,
            root_kind = excluded.root_kind
        `
      )
      .run({
        id: rootId,
        agentId,
        rootPath: plan.targetRoot,
        scope: plan.scope,
        rootKind: plan.rootKind ?? 'user'
      });

    database
      .prepare(
        `
          insert into installations
            (id, skill_id, skill_version_id, agent_root_id, target_root_path, skill_path, projection_mode, read_only_locked, status)
          values
            (@id, @skillId, @versionId, @rootId, @targetRootPath, @skillPath, @projectionMode, 0, 'installed')
        `
      )
      .run({
        id: installationId,
        skillId: plan.skillId,
        versionId: plan.skillVersionId,
        rootId,
        targetRootPath: plan.targetRoot,
        skillPath: plan.targetSkillPath,
        projectionMode: plan.projectionMode
      });

    const insertFile = database.prepare(
      `
        insert into installation_files
          (id, installation_id, relative_path, target_path, source_hash, projection_mode)
        values
          (@id, @installationId, @relativePath, @targetPath, @sourceHash, @projectionMode)
      `
    );
    for (const write of plan.writes) {
      insertFile.run({
        id: randomUUID(),
        installationId,
        relativePath: write.relativePath,
        targetPath: write.targetPath,
        sourceHash: write.sourceHash,
        projectionMode: plan.projectionMode
      });
    }

    database
      .prepare(
        `
          insert into indexed_skill_locations
            (id, skill_id, agent_root_id, skill_version_id, skill_path, visibility_status, installation_id, ownership, last_indexed_at)
          values
            (@id, @skillId, @rootId, @versionId, @skillPath, 'installed', @installationId, 'app-owned', current_timestamp)
          on conflict(id) do update set
            skill_version_id = excluded.skill_version_id,
            visibility_status = 'installed',
            installation_id = excluded.installation_id,
            ownership = 'app-owned',
            last_indexed_at = current_timestamp
        `
      )
      .run({
        id: locationId,
        skillId: plan.skillId,
        rootId,
        versionId: plan.skillVersionId,
        skillPath: plan.targetSkillPath,
        installationId
      });
  });

  record();

  createLibraryRepository(database).recordIndexedSkillLocation({
    skillId: plan.skillId,
    versionId: plan.skillVersionId,
    agentCode: plan.agentCode,
    agentDisplayName: plan.agentDisplayName,
    adapterVersion: plan.adapterVersion,
    rootPath: plan.targetRoot,
    rootScope: plan.scope,
    rootKind: plan.rootKind ?? 'user',
    writable: true,
    isDefault: false,
    skillPath: plan.targetSkillPath,
    visibilityStatus: 'installed',
    installationId,
    ownership: 'app-owned'
  });
}

function getActiveInstallation(database: SqliteDatabase, installationId: string): {
  id: string;
  targetRootPath: string;
  status: string;
} {
  const installation = database
    .prepare(
      `
        select id, target_root_path as targetRootPath, status
        from installations
        where id = ?
      `
    )
    .get(installationId) as { id: string; targetRootPath: string; status: string } | undefined;

  if (!installation) {
    throw new InstallServiceError('installation_not_found', `Installation not found: ${installationId}`);
  }
  if (installation.status !== 'installed') {
    throw new InstallServiceError('installation_not_active', `Installation is not active: ${installationId}`);
  }
  return installation;
}

function listInstallationFiles(database: SqliteDatabase, installationId: string): Array<{ targetPath: string }> {
  return database
    .prepare(
      `
        select target_path as targetPath
        from installation_files
        where installation_id = ?
          and removed_at is null
        order by target_path desc
      `
    )
    .all(installationId) as Array<{ targetPath: string }>;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}

function isInsideOrEqual(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
