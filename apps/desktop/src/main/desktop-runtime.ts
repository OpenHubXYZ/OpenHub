import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createBuiltInAgentAdapters, type AgentAdapter } from '@theopenhub/adapters';
import {
  createCollectionService,
  type ContentStore,
  createContentStore,
  createDiscoverService,
  createGitSyncDriver,
  createImportService,
  createInstallService,
  createMockRestSyncDriver,
  createOsKeychainSecretStore,
  createPluginService,
  createRestSyncDriver,
  createSettingsService,
  createSharedFolderSyncDriver,
  createSyncService,
  createVersionService,
  scanAgentLibraries,
  type PluginCapabilityType,
  type PluginPermission,
  type SecretStore,
  type SyncConflictRecord as CoreSyncConflictRecord,
  type SyncDriver,
  type SyncInboxRecord as CoreSyncInboxRecord,
  type SyncMode,
  type SyncOutboxRecord as CoreSyncOutboxRecord,
  type SyncProfile as CoreSyncProfile
} from '@theopenhub/core';
import {
  createFileDatabase,
  createLibraryRepository,
  createSkillRepository,
  runMigrations,
  type SkillRecord,
  type SqliteDatabase
} from '@theopenhub/db';
import {
  appInfo,
  desktopShellContract,
  parseIpcRequest,
  parseIpcResponse,
  type AgentRootTarget,
  type AppSettings,
  type DesktopWorkspaceState,
  type IpcChannel,
  type ImportedSkillResult,
  type SkillDetail,
  type SkillSummary,
  type SyncConflictRecord,
  type SyncInboxRecord,
  type SyncOutboxRecord,
  type SyncProfile,
  type SyncCenterState,
  type SyncStartupPlan
} from '@theopenhub/shared';

export interface CreateDesktopRuntimeInput {
  dataDirectory: string;
  homeDirectory?: string;
  database?: SqliteDatabase;
  secretStore?: SecretStore;
  sourceFolderOpener?: (sourcePath: string) => Promise<void> | void;
}

export interface DesktopRuntime {
  dispatch<C extends IpcChannel>(channel: C, payload: unknown): Promise<unknown>;
}

interface RuntimeMemory {
  importItems: Array<{ label: string; status: string }>;
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
  const install = createInstallService({ database, contentStore });
  const collections = createCollectionService({ database, contentStore });
  const versions = createVersionService({ database, contentStore });
  const settings = createSettingsService({ database });
  const secretStore = input.secretStore ?? createOsKeychainSecretStore();
  const sync = createSyncService({
    database,
    contentStore,
    secretStore,
    drivers: createRuntimeSyncDrivers(secretStore)
  });
  const plugins = createPluginService({ database });
  const discover = createDiscoverService({
    database,
    cacheDirectory: path.join(input.dataDirectory, 'discover-cache')
  });
  const adapters = createBuiltInAgentAdapters(
    input.homeDirectory ? { homeDirectory: input.homeDirectory } : {}
  );
  const memory: RuntimeMemory = { importItems: [] };

  return {
    async dispatch(channel, payload) {
      const request = parseIpcRequest(channel, payload);

      if (channel === desktopShellContract.appInfo.channel) {
        return parseIpcResponse(channel, appInfo);
      }

      if (channel === desktopShellContract.onboardingState.channel) {
        return parseIpcResponse(channel, await onboardingState({ database, adapters }));
      }

      if (channel === desktopShellContract.onboardingComplete.channel) {
        setAppSetting(database, 'onboarding.completed', (request as { completed: boolean }).completed);
        return parseIpcResponse(channel, await onboardingState({ database, adapters }));
      }

      if (channel === desktopShellContract.agentRootsAddProject.channel) {
        return parseIpcResponse(
          channel,
          addProjectRoot(database, adapters, request as { agentCode: string; rootPath: string })
        );
      }

      if (channel === desktopShellContract.agentRootsRemoveProject.channel) {
        return parseIpcResponse(channel, removeProjectRoot(database, request as { agentCode: string; rootPath: string }));
      }

      if (channel === desktopShellContract.agentRootsList.channel) {
        return parseIpcResponse(channel, await listAgentRootTargets(database, adapters));
      }

      if (channel === desktopShellContract.libraryList.channel) {
        return parseIpcResponse(channel, createLibraryRepository(database).listLibrarySkills());
      }

      if (channel === desktopShellContract.libraryScan.channel) {
        return parseIpcResponse(channel, await scanAgentLibraries({ database, adapters }));
      }

      if (channel === desktopShellContract.workspaceState.channel) {
        return parseIpcResponse(
          channel,
          workspaceState({ database, contentStore, memory, pluginsState: plugins.getPluginCenterState() })
        );
      }

      if (channel === desktopShellContract.importLocalFolder.channel) {
        const result = await importer.importLocalFolder(request as { folderPath: string });
        memory.importItems.unshift({ label: result.skill.name, status: 'imported' });
        return parseIpcResponse(channel, toImportedSkillResult(result));
      }

      if (channel === desktopShellContract.importGit.channel) {
        const result = await importer.importGit(request as { gitUrl: string });
        memory.importItems.unshift({ label: result.skill.name, status: 'imported' });
        return parseIpcResponse(channel, toImportedSkillResult(result));
      }

      if (channel === desktopShellContract.importZip.channel) {
        const result = await importer.importZip(request as { zipPath: string });
        memory.importItems.unshift({ label: result.skill.name, status: 'imported' });
        return parseIpcResponse(channel, toImportedSkillResult(result));
      }

      if (channel === desktopShellContract.importTar.channel) {
        const result = await importer.importTar(request as { tarPath: string });
        memory.importItems.unshift({ label: result.skill.name, status: 'imported' });
        return parseIpcResponse(channel, toImportedSkillResult(result));
      }

      if (channel === desktopShellContract.importGitSparse.channel) {
        const result = await importer.importGitSparse(request as { gitUrl: string; subpath: string });
        memory.importItems.unshift({ label: result.skill.name, status: 'imported' });
        return parseIpcResponse(channel, toImportedSkillResult(result));
      }

      if (channel === desktopShellContract.importMirror.channel) {
        const result = await importer.importMirror(request as { mirrorDirectory: string });
        memory.importItems.unshift({ label: result.skill.name, status: 'imported' });
        return parseIpcResponse(channel, toImportedSkillResult(result));
      }

      if (channel === desktopShellContract.collectionCreate.channel) {
        return parseIpcResponse(
          channel,
          collections.createCollection(request as { name: string; description: string; skillIds: string[] })
        );
      }

      if (channel === desktopShellContract.librarySearch.channel) {
        const search = request as {
          query: string;
          favoritesOnly?: boolean;
          mode?: 'fts' | 'semantic' | 'hybrid';
          filters?: { sourceTypes?: string[]; agentCodes?: string[]; tags?: string[]; favoritesOnly?: boolean };
        };
        return parseIpcResponse(
          channel,
          createSkillRepository(database).searchSkills(search.query, {
            favoritesOnly: search.favoritesOnly,
            mode: search.mode,
            filters: search.filters
          }).map(toSkillSummary)
        );
      }

      if (channel === desktopShellContract.libraryFacets.channel) {
        return parseIpcResponse(
          channel,
          createSkillRepository(database).getFacets((request as { filters?: Parameters<ReturnType<typeof createSkillRepository>['getFacets']>[0] }).filters)
        );
      }

      if (channel === desktopShellContract.librarySetFavorite.channel) {
        const { skillId, favorite } = request as { skillId: string; favorite: boolean };
        const repository = createSkillRepository(database);
        repository.setFavorite(skillId, favorite);
        const skill = repository.getSkill(skillId);
        if (!skill) {
          throw new Error(`Skill not found: ${skillId}`);
        }
        return parseIpcResponse(channel, toSkillSummary(skill));
      }

      if (channel === desktopShellContract.libraryDetail.channel) {
        const { skillId } = request as { skillId: string };
        return parseIpcResponse(channel, await skillDetail(database, contentStore, skillId));
      }

      if (channel === desktopShellContract.installCreatePlan.channel) {
        return parseIpcResponse(
          channel,
          await install.createPlan(request as Parameters<typeof install.createPlan>[0])
        );
      }

      if (channel === desktopShellContract.installApplyPlan.channel) {
        return parseIpcResponse(
          channel,
          await install.applyPlan(request as Parameters<typeof install.applyPlan>[0])
        );
      }

      if (channel === desktopShellContract.installUninstall.channel) {
        return parseIpcResponse(channel, await install.uninstall(request as { installationId: string }));
      }

      if (channel === desktopShellContract.versionList.channel) {
        return parseIpcResponse(channel, versions.listVersions(request as { skillId: string }));
      }

      if (channel === desktopShellContract.versionDiff.channel) {
        return parseIpcResponse(channel, versions.diffVersions(request as { fromVersionId: string; toVersionId: string }));
      }

      if (channel === desktopShellContract.versionCompare.channel) {
        return parseIpcResponse(channel, versions.compareVersions(request as { fromVersionId: string; toVersionId: string }));
      }

      if (channel === desktopShellContract.syncStartupPlan.channel) {
        return parseIpcResponse(channel, toSyncStartupPlan(sync.getStartupPlan()));
      }

      if (channel === desktopShellContract.syncCreateProfile.channel) {
        const profile = sync.createProfile(request as {
          mode: SyncMode;
          remoteUrl: string;
          enabled: boolean;
          authRef?: string | null;
          auth?: { label: string; token: string };
        });
        return parseIpcResponse(channel, toSyncProfile(profile));
      }

      if (channel === desktopShellContract.syncInspectCredential.channel) {
        return parseIpcResponse(channel, sync.inspectCredential(request as { authRef: string }));
      }

      if (channel === desktopShellContract.syncDeleteCredential.channel) {
        sync.deleteCredential(request as { authRef: string });
        return parseIpcResponse(channel, { status: 'deleted' });
      }

      if (channel === desktopShellContract.syncEnqueueLocalChange.channel) {
        return parseIpcResponse(
          channel,
          toSyncOutboxRecord(sync.recordLocalChange(request as {
            profileId: string;
            entityType: string;
            entityId: string;
            payload: unknown;
          }))
        );
      }

      if (channel === desktopShellContract.syncPush.channel) {
        await sync.pushOutbox(request as { profileId: string });
        return parseIpcResponse(channel, { status: 'pushed' });
      }

      if (channel === desktopShellContract.syncPull.channel) {
        return parseIpcResponse(
          channel,
          (await sync.pullInbox(request as { profileId: string })).map(toSyncInboxRecord)
        );
      }

      if (channel === desktopShellContract.syncListConflicts.channel) {
        const { profileId } = request as { profileId?: string };
        return parseIpcResponse(channel, listSyncConflicts(database, profileId));
      }

      if (channel === desktopShellContract.syncResolveConflict.channel) {
        return parseIpcResponse(
          channel,
          toSyncConflictRecord(sync.resolveConflict(request as { conflictId: string; resolution: string }))
        );
      }

      if (channel === desktopShellContract.syncApplyConflict.channel) {
        const result = await sync.applyConflictResolution(request as {
          conflictId: string;
          confirm: boolean;
          resolution:
            | { type: 'metadata'; fields: Record<string, { source: 'base' | 'local' | 'remote' | 'manual'; value?: unknown }> }
            | { type: 'file-drafts' }
            | { type: 'delete'; action: 'soft-delete' };
        });
        return parseIpcResponse(channel, {
          ...toSyncConflictRecord(result),
          ...(result.draftVersionIds ? { draftVersionIds: result.draftVersionIds } : {})
        });
      }

      if (channel === desktopShellContract.pluginsCenterState.channel) {
        return parseIpcResponse(channel, plugins.getPluginCenterState());
      }

      if (channel === desktopShellContract.pluginsInstall.channel) {
        const installed = await plugins.installPlugin(request as { rootPath: string });
        return parseIpcResponse(channel, {
          id: installed.id,
          name: installed.name,
          version: installed.version,
          status: installed.status,
          rootPath: installed.rootPath
        });
      }

      if (channel === desktopShellContract.pluginsAddDirectory.channel) {
        return parseIpcResponse(channel, plugins.addPluginDirectory(request as { rootPath: string }));
      }

      if (channel === desktopShellContract.pluginsListDirectories.channel) {
        return parseIpcResponse(channel, plugins.listPluginDirectories());
      }

      if (channel === desktopShellContract.pluginsScanDirectory.channel) {
        return parseIpcResponse(channel, await plugins.scanPluginDirectory(request as { directoryId: string }));
      }

      if (channel === desktopShellContract.pluginsRemoveDirectory.channel) {
        return parseIpcResponse(channel, plugins.removePluginDirectory(request as { directoryId: string }));
      }

      if (channel === desktopShellContract.pluginsAuthorizePermission.channel) {
        plugins.authorizePermission(request as { pluginId: string; permission: PluginPermission; reason: string });
        return parseIpcResponse(channel, { status: 'authorized' });
      }

      if (channel === desktopShellContract.pluginsEnable.channel) {
        return parseIpcResponse(channel, await plugins.enablePlugin(request as { pluginId: string }));
      }

      if (channel === desktopShellContract.pluginsDisable.channel) {
        plugins.disablePlugin(request as { pluginId: string });
        return parseIpcResponse(channel, { status: 'disabled' });
      }

      if (channel === desktopShellContract.pluginsRegistry.channel) {
        return parseIpcResponse(channel, plugins.getRegistry());
      }

      if (channel === desktopShellContract.pluginsInvokeProvider.channel) {
        return parseIpcResponse(
          channel,
          await plugins.invokeProvider(request as {
            pluginId: string;
            capabilityType: PluginCapabilityType;
            capabilityId: string;
            input: unknown;
          })
        );
      }

      if (channel === desktopShellContract.settingsGet.channel) {
        return parseIpcResponse(channel, appSettings(settings.getSettings() as AppSettings, plugins.listPluginDirectories()));
      }

      if (channel === desktopShellContract.settingsAddMirrorSource.channel) {
        return parseIpcResponse(channel, settings.addMirrorSource(request as { name: string; url: string }));
      }

      if (channel === desktopShellContract.settingsRemoveMirrorSource.channel) {
        return parseIpcResponse(channel, settings.removeMirrorSource(request as { mirrorSourceId: string }));
      }

      if (channel === desktopShellContract.settingsSetUpdateChecks.channel) {
        return parseIpcResponse(
          channel,
          appSettings(settings.setUpdateChecks(request as { enabled: boolean }) as AppSettings, plugins.listPluginDirectories())
        );
      }

      if (channel === desktopShellContract.settingsSetLogLevel.channel) {
        return parseIpcResponse(
          channel,
          appSettings(settings.setLogLevel(request as { logLevel: 'debug' | 'info' | 'warn' | 'error' }) as AppSettings, plugins.listPluginDirectories())
        );
      }

      if (channel === desktopShellContract.settingsAddPluginDirectory.channel) {
        return parseIpcResponse(channel, plugins.addPluginDirectory(request as { rootPath: string }));
      }

      if (channel === desktopShellContract.settingsListPluginDirectories.channel) {
        return parseIpcResponse(channel, plugins.listPluginDirectories());
      }

      if (channel === desktopShellContract.settingsRemovePluginDirectory.channel) {
        return parseIpcResponse(channel, plugins.removePluginDirectory(request as { directoryId: string }));
      }

      if (channel === desktopShellContract.discoverListSources.channel) {
        return parseIpcResponse(channel, discover.listSources());
      }

      if (channel === desktopShellContract.discoverAddSource.channel) {
        return parseIpcResponse(
          channel,
          discover.addSource(request as { name: string; sourceType: 'local' | 'git'; url: string })
        );
      }

      if (channel === desktopShellContract.discoverPreviewSource.channel) {
        return parseIpcResponse(channel, await discover.previewSource(request as { sourceId: string }));
      }

      if (channel === desktopShellContract.discoverRemoveSource.channel) {
        return parseIpcResponse(channel, discover.removeSource(request as { sourceId: string }));
      }

      throw new Error(`Unhandled IPC channel: ${String(channel)}`);
    }
  };
}

function createRuntimeSyncDrivers(secretStore: SecretStore): Partial<Record<SyncMode, SyncDriver>> {
  const mockRest = createMockRestSyncDriver();
  return {
    'shared-folder': {
      push(profile, records) {
        return createSharedFolderSyncDriver({ directory: profile.remoteUrl }).push(profile, records);
      },
      pull(profile) {
        return createSharedFolderSyncDriver({ directory: profile.remoteUrl }).pull(profile);
      }
    },
    git: {
      push(profile, records) {
        return createGitSyncDriver({ repositoryDirectory: profile.remoteUrl }).push(profile, records);
      },
      pull(profile) {
        return createGitSyncDriver({ repositoryDirectory: profile.remoteUrl }).pull(profile);
      }
    },
    rest: createRestSyncDriver({
      secretStore,
      async request(request) {
        const init: RequestInit = {
          method: request.method,
          headers: request.headers,
          ...(request.body === undefined ? {} : { body: request.body })
        };
        const response = await fetch(request.url, init);
        return {
          status: response.status,
          json: () => response.json() as Promise<unknown>
        };
      }
    }),
    'mock-rest': mockRest
  };
}

async function onboardingState(input: {
  database: SqliteDatabase;
  adapters: AgentAdapter[];
}): Promise<{ completed: boolean; detectedRoots: Awaited<ReturnType<typeof listAgentRootTargets>> }> {
  return {
    completed: readAppSetting<boolean>(input.database, 'onboarding.completed') ?? false,
    detectedRoots: await listAgentRootTargets(input.database, input.adapters)
  };
}

async function listAgentRootTargets(database: SqliteDatabase, adapters: AgentAdapter[]) {
  const detected: AgentRootTarget[] = (await Promise.all(adapters.map((adapter) => adapter.detectRoots()))).flat().map((root) => ({
    ...root,
    rootKind: 'user' as const
  }));
  const stored = database
    .prepare(
      `
        select
          a.code as agentCode,
          a.display_name as agentDisplayName,
          a.adapter_version as adapterVersion,
          ar.root_path as rootPath,
          ar.scope,
          ar.root_kind as rootKind,
          ar.writable,
          ar.is_default as isDefault
        from agent_roots ar
        join agents a on a.id = ar.agent_id
        order by ar.created_at
      `
    )
    .all()
    .map(agentRootRow);

  const byKey = new Map<string, AgentRootTarget>();
  for (const root of [...detected, ...stored]) {
    byKey.set(`${root.agentCode}:${root.rootPath}:${root.scope}`, root);
  }
  return [...byKey.values()];
}

function addProjectRoot(database: SqliteDatabase, adapters: AgentAdapter[], input: { agentCode: string; rootPath: string }) {
  const adapter = adapters.find((candidate) => candidate.id === input.agentCode);
  const agentId = stableId('agent', input.agentCode);
  const rootId = stableId('agent-root', `${input.agentCode}:${input.rootPath}:project`);
  const target = {
    agentCode: input.agentCode,
    agentDisplayName: adapter?.displayName ?? input.agentCode,
    adapterVersion: adapter?.adapterVersion ?? 'project',
    rootPath: input.rootPath,
    scope: 'project',
    rootKind: 'project' as const,
    writable: true,
    isDefault: false
  };

  const record = database.transaction(() => {
    database
      .prepare(
        `
          insert into agents (id, code, display_name, adapter_version, detected, os_scope)
          values (@id, @code, @displayName, @adapterVersion, 1, 'project')
          on conflict(code) do update set
            display_name = excluded.display_name,
            adapter_version = excluded.adapter_version,
            detected = 1,
            os_scope = 'project',
            updated_at = current_timestamp
        `
      )
      .run({
        id: agentId,
        code: target.agentCode,
        displayName: target.agentDisplayName,
        adapterVersion: target.adapterVersion
      });
    database
      .prepare(
        `
          insert into agent_roots (id, agent_id, root_path, scope, writable, is_default, root_kind)
          values (@id, @agentId, @rootPath, 'project', 1, 0, 'project')
          on conflict(agent_id, root_path, scope) do update set
            writable = 1,
            is_default = 0,
            root_kind = 'project'
        `
      )
      .run({ id: rootId, agentId, rootPath: target.rootPath });
  });
  record();
  return target;
}

function removeProjectRoot(database: SqliteDatabase, input: { agentCode: string; rootPath: string }) {
  const agentId = stableId('agent', input.agentCode);
  const remove = database.transaction(() => {
    database
      .prepare(
        `
          delete from agent_roots
          where agent_id = ?
            and root_path = ?
            and scope = 'project'
            and root_kind = 'project'
        `
      )
      .run(agentId, input.rootPath);

    const orphanedAgentRootSkills = database
      .prepare(
        `
          select s.id, s.canonical_source_id as sourceId
          from skills s
          join sources src on src.id = s.canonical_source_id
          where src.source_type = 'agent-root'
            and not exists (
              select 1
              from indexed_skill_locations isl
              where isl.skill_id = s.id
            )
        `
      )
      .all() as Array<{ id: string; sourceId: string }>;

    if (orphanedAgentRootSkills.length === 0) {
      return;
    }

    const skillIds = orphanedAgentRootSkills.map((row) => row.id);
    const skillPlaceholders = skillIds.map(() => '?').join(', ');
    database.prepare(`delete from skill_search where skill_id in (${skillPlaceholders})`).run(...skillIds);
    database.prepare(`delete from skill_similarity_index where skill_id in (${skillPlaceholders})`).run(...skillIds);
    database.prepare(`delete from skills where id in (${skillPlaceholders})`).run(...skillIds);

    const sourceIds = [...new Set(orphanedAgentRootSkills.map((row) => row.sourceId))];
    const sourcePlaceholders = sourceIds.map(() => '?').join(', ');
    database
      .prepare(
        `
          delete from sources
          where id in (${sourcePlaceholders})
            and not exists (
              select 1
              from skills s
              where s.canonical_source_id = sources.id
            )
        `
      )
      .run(...sourceIds);
  });
  remove();
  return { status: 'removed' };
}

function agentRootRow(row: unknown) {
  const typed = row as {
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    rootPath: string;
    scope: string;
    rootKind: 'user' | 'project';
    writable: number;
    isDefault: number;
  };
  return {
    agentCode: typed.agentCode,
    agentDisplayName: typed.agentDisplayName,
    adapterVersion: typed.adapterVersion,
    rootPath: typed.rootPath,
    scope: typed.scope,
    rootKind: typed.rootKind,
    writable: typed.writable === 1,
    isDefault: typed.isDefault === 1
  };
}

function workspaceState(input: {
  database: SqliteDatabase;
  contentStore: ContentStore;
  memory: RuntimeMemory;
  pluginsState: DesktopWorkspaceState['plugins'];
}): DesktopWorkspaceState {
  const skills = createSkillRepository(input.database).listSkills().map(toSkillSummary);
  return {
    appInfo,
    librarySkills: createLibraryRepository(input.database).listLibrarySkills(),
    skills,
    managementFlow: {
      importItems: input.memory.importItems.slice(0, 8)
    },
    governance: governanceState(input.database),
    syncCenter: syncCenterState(input.database),
    plugins: input.pluginsState
  };
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

function toSkillSummary(skill: SkillRecord): SkillSummary {
  return {
    id: skill.id,
    versionId: skill.versionId,
    name: skill.name,
    description: skill.description,
    versionNo: skill.versionNo,
    favorite: skill.favorite
  };
}

function governanceState(database: SqliteDatabase): DesktopWorkspaceState['governance'] {
  const history = database
    .prepare(
      `
        select version_no as versionNo, coalesce(change_summary, '') as summary
        from skill_versions
        order by created_at desc
        limit 8
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
        order by c.created_at desc
      `
    )
    .all() as Array<{ name: string; skillCount: number }>;
  return { history, diff: [], collections };
}

function syncCenterState(database: SqliteDatabase): SyncCenterState {
  return {
    profiles: database
      .prepare("select mode, case when enabled = 1 then 'enabled' else 'disabled' end as status from sync_profiles order by created_at desc")
      .all() as Array<{ mode: string; status: string }>,
    outbox: database
      .prepare('select entity_type as entityType, status from sync_outbox order by created_at desc limit 20')
      .all() as Array<{ entityType: string; status: string }>,
    inbox: database
      .prepare('select entity_type as entityType, status from sync_inbox order by received_at desc limit 20')
      .all() as Array<{ entityType: string; status: string }>,
    conflicts: database
      .prepare('select entity_type as entityType, status from sync_conflicts order by created_at desc limit 20')
      .all() as Array<{ entityType: string; status: string }>
  };
}

async function skillDetail(
  database: SqliteDatabase,
  contentStore: ContentStore,
  skillId: string
): Promise<SkillDetail> {
  const skill = createSkillRepository(database).getSkill(skillId);
  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }
  const source = database
    .prepare(
      `
        select coalesce(src.source_type, 'unknown') as type, src.url
        from skills s
        left join sources src on src.id = s.canonical_source_id
        where s.id = ?
      `
    )
    .get(skillId) as { type: string; url: string | null } | undefined;
  const files = latestSkillFiles(database, skillId);
  const manifest = files.find((file) => file.relativePath === 'SKILL.md');
  const skillMarkdown = manifest ? await readSkillMarkdown(contentStore, manifest, source) : '';

  return {
    skill,
    source: source ?? { type: 'unknown', url: null },
    versions: createVersionService({ database, contentStore }).listVersions({ skillId }),
    files,
    skillMarkdown
  };
}

async function readSkillMarkdown(
  contentStore: ContentStore,
  manifest: SkillDetail['files'][number],
  source: { type: string; url: string | null } | undefined
): Promise<string> {
  try {
    return (await contentStore.readBlob(manifest.hash)).toString('utf8');
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
    const sourceMarkdown = await readSourceMarkdown(source, manifest.relativePath);
    if (sourceMarkdown !== null) {
      return sourceMarkdown;
    }
    throw error;
  }
}

async function readSourceMarkdown(
  source: { type: string; url: string | null } | undefined,
  relativePath: string
): Promise<string | null> {
  if (!source?.url || !['agent-root', 'local'].includes(source.type)) {
    return null;
  }

  const sourceRoot = path.resolve(source.url);
  const sourceFile = path.resolve(sourceRoot, relativePath);
  if (sourceFile !== sourceRoot && !sourceFile.startsWith(`${sourceRoot}${path.sep}`)) {
    return null;
  }

  try {
    return await readFile(sourceFile, 'utf8');
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT';
}

function latestSkillFiles(database: SqliteDatabase, skillId: string): SkillDetail['files'] {
  return database
    .prepare(
      `
        select
          sf.relative_path as relativePath,
          sf.blob_hash as hash,
          sf.file_size as size,
          sf.file_kind as kind
        from skill_files sf
        join skill_versions sv on sv.id = sf.skill_version_id
        where sv.skill_id = ?
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = ?
          )
        order by
          case when sf.relative_path = 'SKILL.md' then 0 else 1 end,
          sf.relative_path collate nocase
      `
    )
    .all(skillId, skillId) as SkillDetail['files'];
}

function toSyncStartupPlan(plan: { shouldStart: boolean; enabledProfiles: CoreSyncProfile[] }): SyncStartupPlan {
  return {
    shouldStart: plan.shouldStart,
    enabledProfiles: plan.enabledProfiles.map((profile) => ({
      id: profile.id,
      mode: profile.mode,
      remoteUrl: profile.remoteUrl,
      enabled: profile.enabled
    }))
  };
}

function toSyncProfile(profile: CoreSyncProfile): SyncProfile {
  return {
    id: profile.id,
    mode: profile.mode === 'mock-rest' ? 'rest' : profile.mode,
    remoteUrl: profile.remoteUrl,
    authRef: profile.authRef,
    enabled: profile.enabled,
    lastSyncedAt: null
  };
}

function toSyncOutboxRecord(record: CoreSyncOutboxRecord): SyncOutboxRecord {
  return {
    id: record.id,
    profileId: record.profileId,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status,
    sentAt: null
  };
}

function toSyncInboxRecord(record: CoreSyncInboxRecord): SyncInboxRecord {
  return {
    id: record.id,
    profileId: record.profileId,
    remoteEventId: record.remoteEventId,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status,
    appliedAt: null
  };
}

function toSyncConflictRecord(record: CoreSyncConflictRecord): SyncConflictRecord {
  return {
    id: record.id,
    profileId: record.profileId,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status,
    resolution: record.resolution,
    resolvedAt: null
  };
}

function listSyncConflicts(database: SqliteDatabase, profileId?: string): SyncConflictRecord[] {
  const rows = profileId
    ? database
        .prepare(
          `
            select id, profile_id as profileId, entity_type as entityType, entity_id as entityId, status, resolution_json as resolution, resolved_at as resolvedAt
            from sync_conflicts
            where profile_id = ?
            order by created_at desc
          `
        )
        .all(profileId)
    : database
        .prepare(
          `
            select id, profile_id as profileId, entity_type as entityType, entity_id as entityId, status, resolution_json as resolution, resolved_at as resolvedAt
            from sync_conflicts
            order by created_at desc
          `
        )
        .all();
  return rows.map((row) => {
    const typed = row as SyncConflictRecord;
    return {
      id: typed.id,
      profileId: typed.profileId,
      entityType: typed.entityType,
      entityId: typed.entityId,
      status: typed.status,
      resolution: typed.resolution,
      resolvedAt: typed.resolvedAt
    };
  });
}

function appSettings(
  settings: Pick<AppSettings, 'mirrorSources' | 'updateChecksEnabled' | 'logLevel'>,
  pluginDirectories: AppSettings['pluginDirectories']
): AppSettings {
  return {
    mirrorSources: settings.mirrorSources,
    updateChecksEnabled: settings.updateChecksEnabled,
    logLevel: settings.logLevel,
    pluginDirectories
  };
}

function readAppSetting<T>(database: SqliteDatabase, key: string): T | null {
  const row = database.prepare('select value_json as valueJson from app_settings where key = ?').get(key) as
    | { valueJson: string }
    | undefined;
  return row ? (JSON.parse(row.valueJson) as T) : null;
}

function setAppSetting(database: SqliteDatabase, key: string, value: unknown): void {
  database
    .prepare(
      `
        insert into app_settings (key, value_json, updated_at)
        values (@key, @valueJson, current_timestamp)
        on conflict(key) do update set
          value_json = excluded.value_json,
          updated_at = current_timestamp
      `
    )
    .run({ key, valueJson: JSON.stringify(value) });
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}
