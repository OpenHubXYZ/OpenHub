import { createHash } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export interface RecordIndexedSkillLocationInput {
  skillId: string;
  versionId: string;
  agentCode: string;
  agentDisplayName: string;
  adapterVersion: string;
  rootPath: string;
  rootScope: string;
  rootKind?: 'user' | 'project';
  writable: boolean;
  isDefault: boolean;
  skillPath: string;
  visibilityStatus: string;
}

export interface LibrarySkillSummary {
  id: string;
  name: string;
  sourceAgent: string;
  path: string;
  visibilityStatus: string;
  favorite: boolean;
}

export interface LibraryRepository {
  recordIndexedSkillLocation(input: RecordIndexedSkillLocationInput): void;
  listLibrarySkills(): LibrarySkillSummary[];
}

export function createLibraryRepository(database: SqliteDatabase): LibraryRepository {
  return {
    recordIndexedSkillLocation(input) {
      const agentId = stableId('agent', input.agentCode);
      const rootId = stableId('agent-root', `${input.agentCode}:${input.rootPath}:${input.rootScope}`);
      const locationId = stableId('indexed-skill-location', `${input.skillId}:${rootId}:${input.skillPath}`);

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
            code: input.agentCode,
            displayName: input.agentDisplayName,
            adapterVersion: input.adapterVersion,
            osScope: input.rootScope
          });

        database
          .prepare(
            `
              insert into agent_roots
                (id, agent_id, root_path, scope, writable, is_default, root_kind)
              values
                (@id, @agentId, @rootPath, @scope, @writable, @isDefault, @rootKind)
              on conflict(agent_id, root_path, scope) do update set
                writable = excluded.writable,
                is_default = excluded.is_default,
                root_kind = excluded.root_kind
            `
          )
          .run({
            id: rootId,
            agentId,
            rootPath: input.rootPath,
            scope: input.rootScope,
            rootKind: input.rootKind ?? 'user',
            writable: input.writable ? 1 : 0,
            isDefault: input.isDefault ? 1 : 0
          });

        database
          .prepare(
            `
              insert into indexed_skill_locations
                (id, skill_id, agent_root_id, skill_version_id, skill_path, visibility_status, last_indexed_at)
              values
                (@id, @skillId, @rootId, @versionId, @skillPath, @visibilityStatus, current_timestamp)
              on conflict(id) do update set
                skill_version_id = excluded.skill_version_id,
                visibility_status = excluded.visibility_status,
                last_indexed_at = current_timestamp
            `
          )
          .run({
            id: locationId,
            skillId: input.skillId,
            rootId,
            versionId: input.versionId,
            skillPath: input.skillPath,
            visibilityStatus: input.visibilityStatus
          });
      });

      record();
    },

    listLibrarySkills() {
      return database
        .prepare(
          `
            select
              s.id,
              s.name,
              a.display_name as sourceAgent,
              isl.skill_path as path,
              isl.visibility_status as visibilityStatus,
              case when sfav.skill_id is null then 0 else 1 end as favorite
            from indexed_skill_locations isl
            join skills s on s.id = isl.skill_id
            join agent_roots ar on ar.id = isl.agent_root_id
            join agents a on a.id = ar.agent_id
            left join skill_favorites sfav on sfav.skill_id = s.id
            order by s.name collate nocase, a.display_name collate nocase
          `
        )
        .all()
        .map(librarySkillRow);
    }
  };
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}

function librarySkillRow(row: unknown): LibrarySkillSummary {
  const typed = row as Omit<LibrarySkillSummary, 'favorite'> & { favorite: number };
  return { ...typed, favorite: typed.favorite === 1 };
}
