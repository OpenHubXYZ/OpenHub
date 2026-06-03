import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';
import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

export type InstallConflictState = 'clean' | 'conflict';
export type InstallWriteConflict = 'none' | 'exists';

export interface CreateInstallServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
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
  conflictState: InstallConflictState;
  writes: InstallPlanWrite[];
}

export interface InstallResult {
  status: 'installed';
  installationId: string;
}

export interface InstallService {
  createInstallPlan(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
  }): Promise<InstallPlan>;
  applyInstallPlan(plan: InstallPlan): Promise<InstallResult>;
  uninstall(input: { installationId: string }): Promise<void>;
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

export function createInstallService(input: CreateInstallServiceInput): InstallService {
  return {
    async createInstallPlan(planInput) {
      const files = getLatestSkillFiles(input.database, planInput.skillId);
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
        conflictState: writes.some((write) => write.conflict !== 'none') ? 'conflict' : 'clean',
        writes
      };
    },

    async applyInstallPlan(plan) {
      if (plan.conflictState === 'conflict' || plan.writes.some((write) => write.conflict !== 'none')) {
        throw new Error('Install plan has conflicts');
      }

      for (const write of plan.writes) {
        const safeTargetPath = await ensurePathInsideRoot(plan.targetRoot, write.targetPath);
        if (await fileExists(safeTargetPath)) {
          throw new Error(`Install plan has conflicts: ${write.relativePath}`);
        }
      }

      for (const write of plan.writes) {
        const safeTargetPath = await ensurePathInsideRoot(plan.targetRoot, write.targetPath);
        const content = await input.contentStore.readBlob(write.hash);

        await mkdir(path.dirname(safeTargetPath), { recursive: true });
        await writeFile(safeTargetPath, content, { flag: 'wx' });
      }

      const installationId = recordInstallation(input.database, plan);
      return {
        status: 'installed',
        installationId
      };
    },

    async uninstall({ installationId }) {
      const files = getInstallationFiles(input.database, installationId);

      for (const file of files) {
        const safeTargetPath = await ensurePathInsideRoot(file.rootPath, file.targetPath);
        try {
          await unlink(safeTargetPath);
        } catch (error) {
          if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }

      markUninstalled(input.database, installationId);
    }
  };
}

function getLatestSkillFiles(database: SqliteDatabase, skillId: string): SkillFileRow[] {
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
    .all({ skillId })
    .map(skillFileRow);
}

function recordInstallation(database: SqliteDatabase, plan: InstallPlan): string {
  const agentId = stableId('agent', plan.agentCode);
  const rootId = stableId('agent-root', `${plan.agentCode}:${plan.targetRoot}:${plan.scope}`);
  const installationId = stableId('installation', `${plan.skillId}:${rootId}:${plan.installPath}`);

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
            (id, agent_id, root_path, scope, writable, is_default)
          values
            (@id, @agentId, @rootPath, @scope, 1, 0)
          on conflict(agent_id, root_path, scope) do update set
            writable = excluded.writable
        `
      )
      .run({
        id: rootId,
        agentId,
        rootPath: plan.targetRoot,
        scope: plan.scope
      });

    database
      .prepare(
        `
          insert into installations
            (id, skill_id, agent_root_id, installed_version_id, install_scope, install_path, status)
          values
            (@id, @skillId, @rootId, @versionId, @installScope, @installPath, 'installed')
          on conflict(id) do update set
            installed_version_id = excluded.installed_version_id,
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
        installPath: plan.installPath
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
