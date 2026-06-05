import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createBuiltInAgentAdapters, type AgentAdapter } from '@theopenhub/adapters';
import {
  createCollectionService,
  type ContentStore,
  createContentStore,
  createDiscoverService,
  createExportService,
  createGitSyncDriver,
  createImportService,
  createInstallService,
  createMockRestSyncDriver,
  createOsKeychainSecretStore,
  createPolicyService,
  createPluginService,
  createRestSyncDriver,
  createSecurityService,
  createSharedFolderSyncDriver,
  createSyncService,
  createVersionService,
  scanAgentLibraries,
  type DiscoverPreviewResult as CoreDiscoverPreviewResult,
  type InstallPlan as CoreInstallPlan,
  type InstallResult as CoreInstallResult,
  type PluginCapabilityType,
  type PluginPermission,
  type PluginService,
  type PolicyPack as CorePolicyPack,
  type PolicyService,
  type SecurityExemption as CoreSecurityExemption,
  type SecurityScanResult as CoreSecurityScanResult,
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
  type CollectionExportResult,
  type CollectionImportResult,
  type CollectionRecord,
  type DiscoverPreviewResult,
  type DiscoverSource,
  type DesktopWorkspaceState,
  type ExportSkillResult,
  type FileDiff,
  type ImportedSkillResult,
  type InstallCompatibility,
  type InstallLifecycleResult,
  type InstallLockResult,
  type InstallPlan,
  type InstallResult,
  type InstallTarget,
  type InstallUninstallResult,
  type IpcChannel,
  type LibraryScanResult,
  type LibraryFacets,
  type LibrarySearchFilters,
  type LibrarySkillSummary,
  type MigrationPreviewResult,
  type MultiTargetInstallResult,
  type OnboardingState,
  type BaselineExportResult,
  type BaselinePreview,
  type PolicyEvaluation,
  type PolicyPack,
  type PluginInstallResult,
  type PluginRegistry,
  type PluginsState,
  type SecurityCenterState,
  type SecurityExemption,
  type SecurityFindingDetail,
  type SecurityRevokeExemptionResult,
  type SecurityScanResult,
  type SkillDetail,
  type SkillSummary,
  type SkillVersionSummary,
  type StatusOnlyResult,
  type SyncConflictRecord,
  type SyncInboxRecord,
  type SyncOutboxRecord,
  type SyncProfile,
  type SyncCenterState,
  type SyncStartupPlan,
  type VersionComparisonReport,
  type VersionRollbackResult
} from '@theopenhub/shared';

export interface CreateDesktopRuntimeInput {
  dataDirectory: string;
  homeDirectory?: string;
  database?: SqliteDatabase;
  secretStore?: SecretStore;
}

export interface DesktopRuntime {
  dispatch<C extends IpcChannel>(channel: C, payload: unknown): Promise<RuntimeDispatchResult<C>>;
}

type RuntimeDispatchResult<C extends IpcChannel> = C extends typeof desktopShellContract.appInfo.channel
  ? typeof appInfo
  : C extends typeof desktopShellContract.onboardingState.channel
    ? OnboardingState
    : C extends typeof desktopShellContract.onboardingComplete.channel
      ? OnboardingState
      : C extends typeof desktopShellContract.onboardingImportMigration.channel
        ? ImportedSkillResult[]
        : C extends typeof desktopShellContract.agentRootsAddProject.channel
          ? InstallTarget
          : C extends typeof desktopShellContract.agentRootsList.channel
            ? InstallTarget[]
  : C extends typeof desktopShellContract.libraryList.channel
    ? LibrarySkillSummary[]
    : C extends typeof desktopShellContract.libraryScan.channel
      ? LibraryScanResult
      : C extends typeof desktopShellContract.workspaceState.channel
        ? DesktopWorkspaceState
        : C extends typeof desktopShellContract.importLocalFolder.channel
          ? ImportedSkillResult
          : C extends typeof desktopShellContract.importGit.channel
            ? ImportedSkillResult
            : C extends typeof desktopShellContract.importZip.channel
              ? ImportedSkillResult
              : C extends typeof desktopShellContract.importTar.channel
                ? ImportedSkillResult
                : C extends typeof desktopShellContract.importGitSparse.channel
                  ? ImportedSkillResult
                  : C extends typeof desktopShellContract.importMirror.channel
                    ? ImportedSkillResult
                    : C extends typeof desktopShellContract.exportSkill.channel
                      ? ExportSkillResult
                      : C extends typeof desktopShellContract.exportSignedSkill.channel
                        ? ExportSkillResult
                        : C extends typeof desktopShellContract.collectionCreate.channel
                          ? CollectionRecord
                          : C extends typeof desktopShellContract.collectionExport.channel
                            ? CollectionExportResult
                          : C extends typeof desktopShellContract.collectionImport.channel
                            ? CollectionImportResult
                            : C extends typeof desktopShellContract.librarySearch.channel
                              ? SkillSummary[]
                              : C extends typeof desktopShellContract.libraryFacets.channel
                                ? LibraryFacets
                                : C extends typeof desktopShellContract.librarySetFavorite.channel
                                ? SkillSummary
                                : C extends typeof desktopShellContract.libraryDetail.channel
                                  ? SkillDetail
                                  : C extends typeof desktopShellContract.installCreatePlan.channel
                                    ? InstallPlan
                                    : C extends typeof desktopShellContract.installCheckCompatibility.channel
                                      ? InstallCompatibility
                                      : C extends typeof desktopShellContract.installCreateMultiTargetPlan.channel
                                        ? InstallPlan[]
                                        : C extends typeof desktopShellContract.installApplyPlan.channel
                                          ? InstallResult
                                          : C extends typeof desktopShellContract.installApplyMultiTargetPlan.channel
                                            ? MultiTargetInstallResult
                                            : C extends typeof desktopShellContract.installListTargets.channel
                                              ? InstallTarget[]
                                              : C extends typeof desktopShellContract.installUninstall.channel
                                                ? InstallUninstallResult
                                                : C extends typeof desktopShellContract.installReinstall.channel
                                                  ? InstallLifecycleResult
                                                  : C extends typeof desktopShellContract.installRelink.channel
                                                    ? InstallLifecycleResult
                                                    : C extends typeof desktopShellContract.installSetReadOnlyLock.channel
                                                      ? InstallLockResult
                                            : C extends typeof desktopShellContract.versionList.channel
                                              ? SkillVersionSummary[]
                                              : C extends typeof desktopShellContract.versionDiff.channel
                                                ? FileDiff[]
                                                : C extends typeof desktopShellContract.versionCreateDraft.channel
                                                  ? SkillVersionSummary
                                                  : C extends typeof desktopShellContract.versionPromote.channel
                                                    ? SkillVersionSummary
                                                    : C extends typeof desktopShellContract.versionCompare.channel
                                                      ? VersionComparisonReport
                                                      : C extends typeof desktopShellContract.versionRollback.channel
                                                        ? VersionRollbackResult
                                                  : C extends typeof desktopShellContract.securityScan.channel
                                                    ? SecurityScanResult
                                                    : C extends typeof desktopShellContract.securityRescan.channel
                                                      ? SecurityScanResult[]
                                                      : C extends typeof desktopShellContract.securityFindingDetail.channel
                                                        ? SecurityFindingDetail
                                                        : C extends typeof desktopShellContract.securityCreateExemption.channel
                                                          ? SecurityExemption
                                                          : C extends typeof desktopShellContract.securityRevokeExemption.channel
                                                            ? SecurityRevokeExemptionResult
                                                            : C extends typeof desktopShellContract.syncStartupPlan.channel
                                                              ? SyncStartupPlan
                                                              : C extends typeof desktopShellContract.syncCreateProfile.channel
                                                                ? SyncProfile
                                                                : C extends typeof desktopShellContract.syncInspectCredential.channel
                                                                  ? { authRef: string; label: string; masked: string } | null
                                                                  : C extends typeof desktopShellContract.syncDeleteCredential.channel
                                                                    ? StatusOnlyResult
                                                                    : C extends typeof desktopShellContract.syncEnqueueLocalChange.channel
                                                                      ? SyncOutboxRecord
                                                                      : C extends typeof desktopShellContract.syncPush.channel
                                                                        ? StatusOnlyResult
                                                                        : C extends typeof desktopShellContract.syncPull.channel
                                                                          ? SyncInboxRecord[]
                                                                          : C extends typeof desktopShellContract.syncListConflicts.channel
                                                                            ? SyncConflictRecord[]
                                                                            : C extends typeof desktopShellContract.syncResolveConflict.channel
                                                                              ? SyncConflictRecord
                                                                              : C extends typeof desktopShellContract.syncApplyConflict.channel
                                                                                ? SyncConflictRecord & { draftVersionIds?: string[] }
                                                                                : C extends typeof desktopShellContract.pluginsCenterState.channel
                                                                  ? PluginsState
                                                                  : C extends typeof desktopShellContract.pluginsInstall.channel
                                                                    ? PluginInstallResult
                                                                    : C extends typeof desktopShellContract.pluginsAuthorizePermission.channel
                                                                      ? StatusOnlyResult
                                                                      : C extends typeof desktopShellContract.pluginsEnable.channel
                                                                        ? PluginRegistry
                                                                        : C extends typeof desktopShellContract.pluginsDisable.channel
                                                                          ? StatusOnlyResult
                                                                          : C extends typeof desktopShellContract.pluginsRegistry.channel
                                                                            ? PluginRegistry
                                                                            : C extends typeof desktopShellContract.pluginsInvokeProvider.channel
                                                                              ? unknown
                                                                              : C extends typeof desktopShellContract.policyCreate.channel
                                                                                ? PolicyPack
                                                                                : C extends typeof desktopShellContract.policyList.channel
                                                                                  ? PolicyPack[]
                                                                                  : C extends typeof desktopShellContract.policySetActive.channel
                                                                                    ? StatusOnlyResult
                                                                                    : C extends typeof desktopShellContract.policyEvaluate.channel
                                                                                      ? PolicyEvaluation
                                                                                      : C extends typeof desktopShellContract.baselineExport.channel
                                                                                        ? BaselineExportResult
                                                                                        : C extends typeof desktopShellContract.baselinePreview.channel
                                                                                          ? BaselinePreview
                                                                                          : C extends typeof desktopShellContract.baselineApply.channel
                                                                                            ? BaselinePreview
                                                                                            : C extends typeof desktopShellContract.discoverAddSource.channel
                                                                                              ? DiscoverSource
                                                                                              : C extends typeof desktopShellContract.discoverPreviewSource.channel
                                                                                                ? DiscoverPreviewResult
                                                                                                : C extends typeof desktopShellContract.discoverMigrationPreview.channel
                                                                                                  ? MigrationPreviewResult
                                                                                                  : never;

interface RuntimeMemory {
  importItems: Array<{ label: string; status: string }>;
  installPlan: DesktopWorkspaceState['managementFlow']['installPlan'];
  installResult: DesktopWorkspaceState['managementFlow']['installResult'];
}

interface MigrationImportItem {
  path: string;
  selected?: boolean;
  importLabel?: string;
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
  const exporter = createExportService({ database, contentStore });
  const collections = createCollectionService({ database, contentStore });
  const installer = createInstallService({ database, contentStore });
  const versions = createVersionService({ database, contentStore });
  const security = createSecurityService({ database, contentStore });
  const policies = createPolicyService({ database });
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

      if (channel === desktopShellContract.onboardingState.channel) {
        const result = await onboardingState({ database, adapters });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.onboardingComplete.channel) {
        setAppSetting(database, 'onboarding.completed', (request as { completed: boolean }).completed);
        const result = await onboardingState({ database, adapters });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.onboardingImportMigration.channel) {
        const importRequest = request as {
          adapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
          sourcePath: string;
          paths?: string[];
          items?: MigrationImportItem[];
        };
        const preview = await discover.previewMigration({
          adapter: importRequest.adapter,
          sourcePath: importRequest.sourcePath
        });
        const selectedItems = resolveMigrationImportItems(preview, importRequest);
        persistMigrationWizardState(database, {
          ...preview,
          skills: preview.skills.map((skill) => {
            const item = selectedItems.allByPath.get(skill.path);
            return {
              ...skill,
              selected: item?.selected ?? false,
              importLabel: item?.importLabel ?? skill.importLabel
            };
          })
        });
        const results: ImportedSkillResult[] = [];
        for (const skill of preview.skills) {
          const item = selectedItems.selectedByPath.get(skill.path);
          if (!item) {
            continue;
          }

          const imported = await importer.importLocalFolder({ folderPath: skill.path });
          const result = toImportedSkillResult(imported);
          results.push(result);
          memory.importItems = [
            { label: item.importLabel ?? result.skill.name, status: 'migration imported' },
            ...memory.importItems
          ].slice(0, 5);
        }
        return parseIpcResponse(channel, results) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.agentRootsAddProject.channel) {
        const result = await addProjectRoot(database, request as { agentCode: string; rootPath: string });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.agentRootsList.channel) {
        const result = await listInstallTargets(database, adapters, plugins.getRegistry());
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
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

      if (channel === desktopShellContract.importGit.channel) {
        await mkdir(input.dataDirectory, { recursive: true });
        const imported = await importer.importGit(request as { gitUrl: string });
        const result = toImportedSkillResult(imported);
        memory.importItems = [{ label: result.skill.name, status: 'git imported' }, ...memory.importItems].slice(0, 5);
        createUsageRepository(database).recordEvent({
          eventType: 'skill.import',
          skillId: result.skill.id,
          skillName: result.skill.name,
          subject: `Imported ${result.skill.name} from Git`,
          metadata: {
            fileCount: result.files.length,
            stagedFrom: result.stagedFrom
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.importZip.channel) {
        await mkdir(input.dataDirectory, { recursive: true });
        const imported = await importer.importZip(request as { zipPath: string });
        const result = toImportedSkillResult(imported);
        memory.importItems = [{ label: result.skill.name, status: 'zip imported' }, ...memory.importItems].slice(0, 5);
        createUsageRepository(database).recordEvent({
          eventType: 'skill.import',
          skillId: result.skill.id,
          skillName: result.skill.name,
          subject: `Imported ${result.skill.name} from ZIP`,
          metadata: {
            fileCount: result.files.length,
            stagedFrom: result.stagedFrom
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.importTar.channel) {
        await mkdir(input.dataDirectory, { recursive: true });
        const imported = await importer.importTar(request as { tarPath: string });
        const result = toImportedSkillResult(imported);
        memory.importItems = [{ label: result.skill.name, status: 'tar imported' }, ...memory.importItems].slice(0, 5);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.importGitSparse.channel) {
        await mkdir(input.dataDirectory, { recursive: true });
        const imported = await importer.importGitSparse(request as { gitUrl: string; subpath: string });
        const result = toImportedSkillResult(imported);
        memory.importItems = [{ label: result.skill.name, status: 'sparse imported' }, ...memory.importItems].slice(0, 5);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.importMirror.channel) {
        await mkdir(input.dataDirectory, { recursive: true });
        const imported = await importer.importMirror(request as { mirrorDirectory: string });
        const result = toImportedSkillResult(imported);
        memory.importItems = [{ label: result.skill.name, status: 'mirror imported' }, ...memory.importItems].slice(0, 5);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.exportSkill.channel) {
        const result = await exporter.exportSkill(request as { skillId: string; outputDirectory: string });
        const skill = createSkillRepository(database).getSkill((request as { skillId: string }).skillId);
        createUsageRepository(database).recordEvent({
          eventType: 'export.package',
          ...(skill ? { skillId: skill.id, skillName: skill.name } : {}),
          subject: `Exported ${skill?.name ?? 'skill package'}`,
          metadata: {
            outputDirectory: result.outputDirectory
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.exportSignedSkill.channel) {
        const result = await exporter.exportSignedSkill(
          request as { skillId: string; outputDirectory: string; signer: string }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.collectionCreate.channel) {
        const result = collections.createCollection(
          request as { name: string; description: string; skillIds: string[] }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.collectionExport.channel) {
        const result = await collections.exportCollection(
          request as { collectionId: string; outputDirectory: string }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.collectionImport.channel) {
        const result = await collections.importCollection(request as { packageDirectory: string });
        return parseIpcResponse(
          channel,
          {
            collection: result.collection,
            skills: result.skills.map(toSkillSummary)
          }
        ) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.librarySearch.channel) {
        const searchRequest = request as {
          query: string;
          favoritesOnly?: boolean;
          mode?: 'fts' | 'semantic' | 'hybrid';
          filters?: LibrarySearchFilters;
        };
        const result = createSkillRepository(database)
          .searchSkills(searchRequest.query, {
            ...(searchRequest.favoritesOnly === undefined ? {} : { favoritesOnly: searchRequest.favoritesOnly }),
            ...(searchRequest.mode ? { mode: searchRequest.mode } : {}),
            ...(searchRequest.filters ? { filters: searchRequest.filters } : {})
          })
          .map(toSkillSummary);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.libraryFacets.channel) {
        const result = createSkillRepository(database).getFacets(
          (request as { filters?: LibrarySearchFilters }).filters
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.librarySetFavorite.channel) {
        const favoriteRequest = request as { skillId: string; favorite: boolean };
        const repository = createSkillRepository(database);
        repository.setFavorite(favoriteRequest.skillId, favoriteRequest.favorite);
        const result = repository.getSkill(favoriteRequest.skillId);
        if (!result) {
          throw new Error(`Skill not found: ${favoriteRequest.skillId}`);
        }
        return parseIpcResponse(channel, toSkillSummary(result)) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.libraryDetail.channel) {
        const result = await skillDetail(database, contentStore, (request as { skillId: string }).skillId);
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
            rootKind?: 'user' | 'project';
            projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
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

      if (channel === desktopShellContract.installCheckCompatibility.channel) {
        const result = await installer.checkCompatibility(
          request as {
            skillId: string;
            targetRoot: string;
            agentCode: string;
            agentDisplayName: string;
            adapterVersion: string;
            scope: string;
            rootKind?: 'user' | 'project';
            projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
            versionId?: string;
          }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installCreateMultiTargetPlan.channel) {
        const multiTargetRequest = request as {
          skillId: string;
          projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
          targets: Array<{
            targetRoot?: string;
            rootPath?: string;
            agentCode: string;
            agentDisplayName: string;
            adapterVersion: string;
            scope: string;
            rootKind?: 'user' | 'project';
          }>;
        };
        const plans = await installer.createMultiTargetInstallPlan(
          {
            skillId: multiTargetRequest.skillId,
            ...(multiTargetRequest.projectionMode ? { projectionMode: multiTargetRequest.projectionMode } : {}),
            targets: multiTargetRequest.targets.map((target) => ({
              targetRoot: target.targetRoot ?? target.rootPath ?? '',
              agentCode: target.agentCode,
              agentDisplayName: target.agentDisplayName,
              adapterVersion: target.adapterVersion,
              scope: target.scope,
              ...(target.rootKind ? { rootKind: target.rootKind } : {})
            }))
          }
        );
        return parseIpcResponse(channel, plans.map(toInstallPlan)) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installApplyPlan.channel) {
        const { plan } = request as { plan: InstallPlan };
        assertActivePolicyAllowsInstall(database, policies, plan);
        const result = toInstallResult(await installer.applyInstallPlan(plan as CoreInstallPlan));
        memory.installResult = {
          status: result.status,
          message: `${result.status === 'exported' ? 'Exported' : 'Installed'} ${plan.writes.length} files by ${plan.projectionMode} projection.`
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

      if (channel === desktopShellContract.installApplyMultiTargetPlan.channel) {
        const { plans } = request as { plans: InstallPlan[] };
        for (const plan of plans) {
          assertActivePolicyAllowsInstall(database, policies, plan);
        }
        const result = await installer.applyMultiTargetInstallPlan({ plans: plans as CoreInstallPlan[] });
        return parseIpcResponse(
          channel,
          {
            installed: result.installed.map(toInstallResult),
            blocked: result.blocked
          }
        ) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installListTargets.channel) {
        const roots = await listInstallTargets(database, adapters, plugins.getRegistry());
        return parseIpcResponse(channel, roots) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installUninstall.channel) {
        const { installationId } = request as { installationId: string };
        await installer.uninstall({ installationId });
        const result = { status: 'uninstalled' as const, installationId };
        memory.installResult = {
          status: result.status,
          message: `Uninstalled app-owned files for ${installationId}.`
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.uninstall',
          subject: `Uninstalled ${installationId}`,
          metadata: { installationId }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installReinstall.channel) {
        const { installationId } = request as { installationId: string };
        const result = await installer.reinstall({ installationId });
        memory.installResult = {
          status: result.status,
          message: `Reinstalled app-owned files for ${installationId}.`
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.reinstall',
          subject: `Reinstalled ${installationId}`,
          metadata: { installationId, projectionMode: result.projectionMode }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installRelink.channel) {
        const result = await installer.relink(
          request as {
            installationId: string;
            targetRoot: string;
            agentCode: string;
            agentDisplayName: string;
            adapterVersion: string;
            scope: string;
            rootKind?: 'user' | 'project';
            projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
          }
        );
        memory.installResult = {
          status: result.status,
          message: `Relinked ${result.installationId} to ${result.targetRoot}.`
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.relink',
          subject: `Relinked ${result.installationId}`,
          metadata: {
            installationId: result.installationId,
            targetRoot: result.targetRoot,
            projectionMode: result.projectionMode
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.installSetReadOnlyLock.channel) {
        const result = await installer.setReadOnlyLock(request as { installationId: string; locked: boolean });
        memory.installResult = {
          status: result.status,
          message: `${result.status === 'locked' ? 'Locked' : 'Unlocked'} ${result.installationId}.`
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.lock',
          subject: `${result.status === 'locked' ? 'Locked' : 'Unlocked'} ${result.installationId}`,
          metadata: {
            installationId: result.installationId,
            readOnlyLocked: result.readOnlyLocked
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.versionList.channel) {
        const result = versions.listVersions(request as { skillId: string });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.versionDiff.channel) {
        const result = versions.diffVersions(
          request as { fromVersionId: string; toVersionId: string }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.versionCreateDraft.channel) {
        const draftRequest = request as {
          skillId: string;
          changeSummary: string;
          files: Array<{ relativePath: string; content: string }>;
        };
        const result = await versions.createVersion({
          ...draftRequest,
          lifecycle: 'draft',
          releaseChannel: 'local'
        });
        createUsageRepository(database).recordEvent({
          eventType: 'version.createDraft',
          skillId: result.skillId,
          subject: `Created draft v${result.versionNo}`,
          metadata: { versionId: result.versionId }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.versionPromote.channel) {
        const result = versions.promoteVersion(request as { versionId: string; releaseChannel: 'beta' | 'stable' });
        createUsageRepository(database).recordEvent({
          eventType: 'version.promote',
          skillId: result.skillId,
          subject: `Promoted v${result.versionNo} to ${result.releaseChannel}`,
          metadata: { versionId: result.versionId, releaseChannel: result.releaseChannel }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.versionCompare.channel) {
        const result = versions.compareVersions(request as { fromVersionId: string; toVersionId: string });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.versionRollback.channel) {
        const { installationId, targetVersionId } = request as {
          installationId: string;
          targetVersionId: string;
        };
        await versions.rollbackInstallation({ installationId, targetVersionId });
        const result = {
          status: 'rolled_back' as const,
          installationId,
          versionId: targetVersionId
        };
        createUsageRepository(database).recordEvent({
          eventType: 'install.rollback',
          subject: `Rolled back ${installationId}`,
          metadata: {
            installationId,
            targetVersionId
          }
        });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.securityScan.channel) {
        const result = await scanSkillWithPluginRules({
          database,
          plugins,
          scan: toSecurityScanResult(await security.scanSkill(request as { skillId: string }))
        });
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

      if (channel === desktopShellContract.securityRescan.channel) {
        const skillIds =
          (request as { skillIds?: string[] }).skillIds ??
          createSkillRepository(database).listSkills().map((skill) => skill.id);
        const results = [];
        for (const result of (await security.batchRescan({ skillIds })).map(toSecurityScanResult)) {
          results.push(await scanSkillWithPluginRules({ database, plugins, scan: result }));
        }
        for (const result of results) {
          recordReviewForSecurityScan(database, result, createSkillRepository(database).getSkill(result.skillId));
        }
        return parseIpcResponse(channel, results) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.securityFindingDetail.channel) {
        const result = securityFindingDetail(
          database,
          request as { scanId?: string; skillId?: string; ruleId?: string }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.securityCreateExemption.channel) {
        const result = toSecurityExemption(
          security.createExemption(request as { skillId: string; scope: string; reason: string })
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.securityRevokeExemption.channel) {
        const { exemptionId } = request as { exemptionId: string };
        security.revokeExemption({ exemptionId });
        return parseIpcResponse(
          channel,
          { status: 'revoked', exemptionId }
        ) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncStartupPlan.channel) {
        return parseIpcResponse(channel, sync.getStartupPlan()) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncCreateProfile.channel) {
        const result = toSyncProfile(
          sync.createProfile(
            request as {
              mode: SyncMode;
              remoteUrl: string;
              enabled: boolean;
              authRef?: string | null;
              auth?: { label: string; token: string };
            }
          )
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncInspectCredential.channel) {
        const result = sync.inspectCredential(request as { authRef: string });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncDeleteCredential.channel) {
        sync.deleteCredential(request as { authRef: string });
        return parseIpcResponse(channel, { status: 'deleted' }) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncEnqueueLocalChange.channel) {
        const result = toSyncOutboxRecord(
          sync.recordLocalChange(
            request as {
              profileId: string;
              entityType: string;
              entityId: string;
              payload: unknown;
            }
          )
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncPush.channel) {
        await sync.pushOutbox(request as { profileId: string });
        return parseIpcResponse(channel, { status: 'pushed' }) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncPull.channel) {
        const result = (await sync.pullInbox(request as { profileId: string })).map(toSyncInboxRecord);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncListConflicts.channel) {
        const result = listSyncConflicts(database, request as { profileId?: string });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncResolveConflict.channel) {
        const result = toSyncConflictRecord(
          sync.resolveConflict(request as { conflictId: string; resolution: string })
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.syncApplyConflict.channel) {
        const result = await sync.applyConflictResolution(
          request as {
            conflictId: string;
            confirm: boolean;
            resolution: Parameters<typeof sync.applyConflictResolution>[0]['resolution'];
          }
        );
        return parseIpcResponse(
          channel,
          {
            ...toSyncConflictRecord(result),
            ...(result.draftVersionIds ? { draftVersionIds: result.draftVersionIds } : {})
          }
        ) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsCenterState.channel) {
        return parseIpcResponse(channel, plugins.getPluginCenterState()) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsInstall.channel) {
        const installed = await plugins.installPlugin(request as { rootPath: string });
        const result = {
          id: installed.id,
          name: installed.name,
          version: installed.version,
          status: installed.status,
          rootPath: installed.rootPath
        };
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsAuthorizePermission.channel) {
        plugins.authorizePermission(
          request as { pluginId: string; permission: PluginPermission; reason: string }
        );
        return parseIpcResponse(channel, { status: 'authorized' }) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsEnable.channel) {
        const result = plugins.getRegistry();
        const enabled = await plugins.enablePlugin(request as { pluginId: string });
        return parseIpcResponse(channel, enabled ?? result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsDisable.channel) {
        plugins.disablePlugin(request as { pluginId: string });
        return parseIpcResponse(channel, { status: 'disabled' }) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsRegistry.channel) {
        return parseIpcResponse(channel, plugins.getRegistry()) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.pluginsInvokeProvider.channel) {
        const result = await plugins.invokeProvider(
          request as {
            pluginId: string;
            capabilityType: PluginCapabilityType;
            capabilityId: string;
            input: unknown;
          }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.policyCreate.channel) {
        const result = policies.createPolicyPack(
          request as {
            name: string;
            allowedSources: string[];
            blockedRules: string[];
            requiredScanLevel: 'safe' | 'warning' | 'critical';
            approvedPlugins: string[];
          }
        );
        return parseIpcResponse(channel, toPolicyPack(result)) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.policyList.channel) {
        return parseIpcResponse(channel, listPolicyPacks(database)) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.policySetActive.channel) {
        setAppSetting(database, 'policy.activePolicyPackId', (request as { policyPackId: string }).policyPackId);
        return parseIpcResponse(channel, { status: 'active' }) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.policyEvaluate.channel) {
        const result = policies.evaluateInstall(
          request as {
            policyPackId: string;
            sourceType: string;
            findingRuleIds: string[];
            scanLevel: 'safe' | 'warning' | 'critical';
            pluginIds: string[];
          }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.baselineExport.channel) {
        const result = await policies.exportTeamBaseline(
          request as {
            outputDirectory: string;
            name: string;
            collectionIds: string[];
            policyPackId: string;
            rootTemplates: Array<{ agentCode: string; scope: string; rootPathTemplate: string }>;
          }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.baselinePreview.channel) {
        const result = await policies.previewTeamBaseline(request as { packageDirectory: string });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.baselineApply.channel) {
        const result = await policies.applyTeamBaseline(request as { packageDirectory: string; confirm: boolean });
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.discoverAddSource.channel) {
        const result = discover.addSource(
          request as {
            name: string;
            sourceType: 'local' | 'git';
            url: string;
            trustLevel: string;
          }
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.discoverPreviewSource.channel) {
        const result = toDiscoverPreviewResult(
          await discover.previewSource(request as { sourceId: string })
        );
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      if (channel === desktopShellContract.discoverMigrationPreview.channel) {
        const result = await discover.previewMigration(
          request as {
            adapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
            sourcePath: string;
          }
        );
        persistMigrationWizardState(database, result);
        return parseIpcResponse(channel, result) as RuntimeDispatchResult<C>;
      }

      throw new Error(`Unhandled IPC channel: ${channel}`);
    }
  };
}

async function onboardingState(input: {
  database: SqliteDatabase;
  adapters: AgentAdapter[];
}): Promise<OnboardingState> {
  return {
    completed: getBooleanAppSetting(input.database, 'onboarding.completed'),
    detectedRoots: await listInstallTargets(input.database, input.adapters),
    migrationPreviews: getJsonAppSetting<MigrationPreviewResult[]>(input.database, 'migration.wizard.previews') ?? []
  };
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

function getBooleanAppSetting(database: SqliteDatabase, key: string): boolean {
  const row = database.prepare('select value_json as valueJson from app_settings where key = ?').get(key) as
    | { valueJson: string }
    | undefined;
  return row ? Boolean(JSON.parse(row.valueJson)) : false;
}

function getStringAppSetting(database: SqliteDatabase, key: string): string | null {
  const row = database.prepare('select value_json as valueJson from app_settings where key = ?').get(key) as
    | { valueJson: string }
    | undefined;
  const value = row ? JSON.parse(row.valueJson) : null;
  return typeof value === 'string' ? value : null;
}

function getJsonAppSetting<T>(database: SqliteDatabase, key: string): T | null {
  const row = database.prepare('select value_json as valueJson from app_settings where key = ?').get(key) as
    | { valueJson: string }
    | undefined;
  return row ? (JSON.parse(row.valueJson) as T) : null;
}

function persistMigrationWizardState(database: SqliteDatabase, preview: MigrationPreviewResult): void {
  setAppSetting(database, 'migration.wizard.previews', [preview]);
}

function resolveMigrationImportItems(
  preview: MigrationPreviewResult,
  request: { paths?: string[]; items?: MigrationImportItem[] }
): {
  allByPath: Map<string, Required<MigrationImportItem>>;
  selectedByPath: Map<string, Required<MigrationImportItem>>;
} {
  const previewPaths = new Set(preview.skills.map((skill) => skill.path));
  const allItems = request.items
    ? request.items.map((item) => ({
        path: item.path,
        selected: item.selected ?? true,
        importLabel: item.importLabel ?? importLabelForPreview(preview, item.path)
      }))
    : preview.skills.map((skill) => ({
        path: skill.path,
        selected: Boolean(request.paths?.includes(skill.path)),
        importLabel: skill.importLabel ?? skill.name
      }));

  const allByPath = new Map<string, Required<MigrationImportItem>>();
  const selectedByPath = new Map<string, Required<MigrationImportItem>>();
  for (const item of allItems) {
    if (!previewPaths.has(item.path)) {
      throw new Error(`Migration path is not in preview: ${item.path}`);
    }
    assertValidMigrationImportLabel(item.importLabel);
    allByPath.set(item.path, item);
    if (item.selected) {
      selectedByPath.set(item.path, item);
    }
  }

  return { allByPath, selectedByPath };
}

function importLabelForPreview(preview: MigrationPreviewResult, skillPath: string): string {
  const skill = preview.skills.find((candidate) => candidate.path === skillPath);
  return skill?.importLabel ?? skill?.name ?? 'skill';
}

function assertValidMigrationImportLabel(importLabel: string): void {
  if (
    importLabel.includes('/') ||
    importLabel.includes('\\') ||
    importLabel.includes('..') ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(importLabel)
  ) {
    throw new Error(`Invalid migration import label: ${importLabel}`);
  }
}

function listPolicyPacks(database: SqliteDatabase): PolicyPack[] {
  return database
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
        order by created_at desc, name asc
      `
    )
    .all()
    .map((row) => policyPackRow(row));
}

function policyPackRow(row: unknown): PolicyPack {
  const policy = row as {
    id: string;
    name: string;
    allowedSourcesJson: string;
    blockedRulesJson: string;
    requiredScanLevel: 'safe' | 'warning' | 'critical';
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

function toPolicyPack(policy: CorePolicyPack): PolicyPack {
  return {
    id: policy.id,
    name: policy.name,
    allowedSources: policy.allowedSources,
    blockedRules: policy.blockedRules,
    requiredScanLevel: policy.requiredScanLevel,
    approvedPlugins: policy.approvedPlugins
  };
}

function assertActivePolicyAllowsInstall(
  database: SqliteDatabase,
  policies: PolicyService,
  plan: InstallPlan
): void {
  const activePolicyId = getStringAppSetting(database, 'policy.activePolicyPackId');
  if (!activePolicyId) {
    return;
  }

  const evaluation = policies.evaluateInstall({
    policyPackId: activePolicyId,
    sourceType: sourceTypeForSkill(database, plan.skillId),
    findingRuleIds: latestFindingRuleIds(database, plan.skillId),
    scanLevel: latestScanLevel(database, plan.skillId),
    pluginIds: []
  });

  if (!evaluation.allowed) {
    throw new Error(`Policy blocked install: ${evaluation.reasons.join(', ')}`);
  }
}

function sourceTypeForSkill(database: SqliteDatabase, skillId: string): string {
  const row = database
    .prepare(
      `
        select coalesce(src.source_type, 'local') as sourceType
        from skills s
        left join sources src on src.id = s.canonical_source_id
        where s.id = ?
      `
    )
    .get(skillId) as { sourceType: string } | undefined;
  return row?.sourceType ?? 'local';
}

function latestFindingRuleIds(database: SqliteDatabase, skillId: string): string[] {
  return database
    .prepare(
      `
        select sf.rule_id as ruleId
        from security_findings sf
        join security_scans ss on ss.id = sf.scan_id
        join skill_versions sv on sv.id = ss.skill_version_id
        where sv.skill_id = ?
        order by ss.scanned_at desc, sf.severity desc
      `
    )
    .all(skillId)
    .map((row) => (row as { ruleId: string }).ruleId);
}

function latestScanLevel(database: SqliteDatabase, skillId: string): 'safe' | 'warning' | 'critical' {
  const row = database
    .prepare(
      `
        select ss.level
        from security_scans ss
        join skill_versions sv on sv.id = ss.skill_version_id
        where sv.skill_id = ?
        order by ss.scanned_at desc
        limit 1
      `
    )
    .get(skillId) as { level: string } | undefined;
  const level = row?.level ?? 'safe';
  if (level === 'critical' || level === 'high') {
    return 'critical';
  }
  if (level === 'medium' || level === 'low' || level === 'warning') {
    return 'warning';
  }
  return 'safe';
}

async function addProjectRoot(
  database: SqliteDatabase,
  input: { agentCode: string; rootPath: string }
): Promise<InstallTarget> {
  const metadata = agentMetadata(input.agentCode);
  await mkdir(input.rootPath, { recursive: true });
  const agentId = stableId('agent', metadata.agentCode);
  const rootId = stableId('agent-root', `${metadata.agentCode}:${input.rootPath}:project`);
  database
    .prepare(
      `
        insert into agents
          (id, code, display_name, adapter_version, detected, os_scope, updated_at)
        values
          (@id, @code, @displayName, @adapterVersion, 1, 'project', current_timestamp)
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
      code: metadata.agentCode,
      displayName: metadata.agentDisplayName,
      adapterVersion: metadata.adapterVersion
    });
  database
    .prepare(
      `
        insert into agent_roots
          (id, agent_id, root_path, scope, writable, is_default, root_kind)
        values
          (@id, @agentId, @rootPath, 'project', 1, 0, 'project')
        on conflict(agent_id, root_path, scope) do update set
          writable = 1,
          is_default = 0,
          root_kind = 'project'
      `
    )
    .run({ id: rootId, agentId, rootPath: input.rootPath });

  return {
    ...metadata,
    rootPath: input.rootPath,
    scope: 'project',
    rootKind: 'project',
    writable: true,
    isDefault: false
  };
}

async function listInstallTargets(
  database: SqliteDatabase,
  adapters: AgentAdapter[],
  pluginRegistry?: PluginRegistry
): Promise<InstallTarget[]> {
  const detected = (
    await Promise.all(adapters.map((adapter) => adapter.detectRoots()))
  )
    .flat()
    .map((root) => ({
      agentCode: root.agentCode,
      agentDisplayName: root.agentDisplayName,
      adapterVersion: root.adapterVersion,
      rootPath: root.rootPath,
      scope: root.scope,
      rootKind: root.scope === 'project' ? ('project' as const) : ('user' as const),
      writable: root.writable,
      isDefault: root.isDefault
    }));
  const persistedProjectRoots = database
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
        where ar.root_kind = 'project'
        order by a.code, ar.root_path collate nocase
      `
    )
    .all()
    .map(installTargetRow);
  const pluginTargets =
    pluginRegistry?.agentAdapters.map((adapter) => ({
      agentCode: adapter.code,
      agentDisplayName: adapter.displayName,
      adapterVersion: `plugin:${adapter.pluginId}`,
      rootPath: `plugin://${adapter.pluginId}/${adapter.code}`,
      scope: 'plugin',
      writable: false,
      isDefault: false
    })) ?? [];
  const byKey = new Map<string, InstallTarget>();
  for (const target of [...detected, ...persistedProjectRoots, ...pluginTargets]) {
    byKey.set(`${target.agentCode}:${target.rootPath}:${target.scope}`, target);
  }
  return [...byKey.values()].sort((left, right) =>
    `${left.agentCode}:${left.rootPath}`.localeCompare(`${right.agentCode}:${right.rootPath}`)
  );
}

function installTargetRow(row: unknown): InstallTarget {
  const typed = row as Omit<InstallTarget, 'writable' | 'isDefault'> & {
    writable: number;
    isDefault: number;
  };
  return {
    ...typed,
    rootKind: typed.rootKind ?? (typed.scope === 'project' ? 'project' : 'user'),
    writable: typed.writable === 1,
    isDefault: typed.isDefault === 1
  };
}

function agentMetadata(agentCode: string): Pick<
  InstallTarget,
  'agentCode' | 'agentDisplayName' | 'adapterVersion'
> {
  const displayNames: Record<string, string> = {
    codex: 'Codex',
    claude: 'Claude',
    gemini: 'Gemini',
    opencode: 'OpenCode'
  };
  const agentDisplayName = displayNames[agentCode];
  if (!agentDisplayName) {
    throw new Error(`Unsupported agent code: ${agentCode}`);
  }

  return { agentCode, agentDisplayName, adapterVersion: 'builtin' };
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
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

async function skillDetail(
  database: SqliteDatabase,
  contentStore: ContentStore,
  skillId: string
): Promise<SkillDetail> {
  const row = database
    .prepare(
      `
        select
          s.id,
          s.slug,
          s.name,
          s.description,
          s.tags_json as tagsJson,
          sv.id as versionId,
          sv.version_no as versionNo,
          coalesce(src.source_type, 'unknown') as sourceType,
          src.url as sourceUrl,
          coalesce(src.trust_level, 'unknown') as trustLevel,
          case when sfav.skill_id is null then 0 else 1 end as favorite
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        left join sources src on src.id = s.canonical_source_id
        left join skill_favorites sfav on sfav.skill_id = s.id
        where s.id = @skillId
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = @skillId
          )
      `
    )
    .get({ skillId }) as
    | {
        id: string;
        slug: string;
        name: string;
        description: string;
        tagsJson: string;
        versionId: string;
        versionNo: number;
        sourceType: string;
        sourceUrl: string | null;
        trustLevel: string;
        favorite: number;
      }
    | undefined;

  if (!row) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const files = latestSkillFiles(database, skillId);
  const manifest = files.find((file) => file.relativePath === 'SKILL.md');
  const skillMarkdown = manifest ? (await contentStore.readBlob(manifest.hash)).toString('utf8') : '';
  const latestScan = latestSecurityScan(database, skillId);

  return {
    skill: {
      id: row.id,
      versionId: row.versionId,
      slug: row.slug,
      name: row.name,
      description: row.description,
      tags: JSON.parse(row.tagsJson) as string[],
      versionNo: row.versionNo,
      favorite: row.favorite === 1
    },
    source: {
      type: row.sourceType,
      url: row.sourceUrl,
      trustLevel: row.trustLevel
    },
    versions: versionSummaries(database, skillId),
    files,
    skillMarkdown,
    latestScan,
    installations: installationSummaries(database, skillId),
    riskStatus: latestScan ? (latestScan.blocked ? 'blocked' : latestScan.level) : 'unscanned'
  };
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
        where sv.skill_id = @skillId
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
    .all({ skillId }) as SkillDetail['files'];
}

function versionSummaries(database: SqliteDatabase, skillId: string): SkillVersionSummary[] {
  return database
    .prepare(
      `
        select
          id as versionId,
          skill_id as skillId,
          version_no as versionNo,
          coalesce(change_summary, '') as changeSummary,
          created_at as createdAt,
          lifecycle,
          release_channel as releaseChannel
        from skill_versions
        where skill_id = ?
        order by version_no desc
      `
    )
    .all(skillId) as SkillVersionSummary[];
}

function latestSecurityScan(
  database: SqliteDatabase,
  skillId: string
): SkillDetail['latestScan'] {
  const row = database
    .prepare(
      `
        select
          ss.id as scanId,
          ss.score,
          ss.level,
          ss.blocked,
          ss.scanned_at as scannedAt
        from security_scans ss
        join skill_versions sv on sv.id = ss.skill_version_id
        where sv.skill_id = ?
        order by ss.scanned_at desc
        limit 1
      `
    )
    .get(skillId) as
    | {
        scanId: string;
        score: number;
        level: string;
        blocked: number;
        scannedAt: string;
      }
    | undefined;

  return row
    ? {
        scanId: row.scanId,
        score: row.score,
        level: row.level,
        blocked: row.blocked === 1,
        scannedAt: row.scannedAt
      }
    : null;
}

function installationSummaries(
  database: SqliteDatabase,
  skillId: string
): SkillDetail['installations'] {
  return database
    .prepare(
      `
        select
          i.id as installationId,
          a.display_name as agent,
          ar.root_path as rootPath,
          ar.scope,
          i.install_path as installPath,
          i.status,
          i.projection_mode as projectionMode,
          i.read_only_locked as readOnlyLocked,
          sv.version_no as versionNo
        from installations i
        join agent_roots ar on ar.id = i.agent_root_id
        join agents a on a.id = ar.agent_id
        join skill_versions sv on sv.id = i.installed_version_id
        where i.skill_id = ?
        order by i.installed_at desc
      `
    )
    .all(skillId)
    .map((row) => {
      const installation = row as Omit<SkillDetail['installations'][number], 'readOnlyLocked'> & {
        readOnlyLocked: number;
      };
      return {
        ...installation,
        readOnlyLocked: installation.readOnlyLocked === 1
      };
    });
}

function securityFindingDetail(
  database: SqliteDatabase,
  input: { scanId?: string; skillId?: string; ruleId?: string }
): SecurityFindingDetail {
  const rows = database
    .prepare(
      `
        select
          s.name as skillName,
          ss.id as scanId,
          sf.rule_id as ruleId,
          sf.severity,
          sf.category,
          sf.relative_path as relativePath,
          sf.line_no as lineNo,
          sf.excerpt
        from security_findings sf
        join security_scans ss on ss.id = sf.scan_id
        join skill_versions sv on sv.id = ss.skill_version_id
        join skills s on s.id = sv.skill_id
        where (@scanId is null or ss.id = @scanId)
          and (@skillId is null or s.id = @skillId)
          and (@ruleId is null or sf.rule_id = @ruleId)
        order by
          case sf.severity
            when 'critical' then 0
            when 'high' then 1
            when 'medium' then 2
            else 3
          end,
          sf.relative_path collate nocase
        limit 1
      `
    )
    .all({
      scanId: input.scanId ?? null,
      skillId: input.skillId ?? null,
      ruleId: input.ruleId ?? null
    }) as Array<{
    skillName: string;
    scanId: string;
    ruleId: string;
    severity: string;
    category: string;
    relativePath: string;
    lineNo: number | null;
    excerpt: string;
  }>;
  const row = rows[0];
  if (!row) {
    throw new Error('Security finding not found');
  }

  return {
    ...row,
    ruleName: titleizeRuleId(row.ruleId)
  };
}

function toSecurityExemption(exemption: CoreSecurityExemption): SecurityExemption {
  return {
    id: exemption.id,
    skillId: exemption.skillId,
    scope: exemption.scope,
    reason: exemption.reason,
    createdAt: exemption.createdAt,
    revokedAt: exemption.revokedAt
  };
}

function toSyncProfile(profile: CoreSyncProfile): SyncProfile {
  return { ...profile };
}

function toSyncOutboxRecord(record: CoreSyncOutboxRecord): SyncOutboxRecord {
  return { ...record };
}

function toSyncInboxRecord(record: CoreSyncInboxRecord): SyncInboxRecord {
  return { ...record };
}

function toSyncConflictRecord(record: CoreSyncConflictRecord): SyncConflictRecord {
  return { ...record };
}

function listSyncConflicts(
  database: SqliteDatabase,
  input: { profileId?: string }
): SyncConflictRecord[] {
  const query = `
    select
      id,
      profile_id as profileId,
      entity_type as entityType,
      entity_id as entityId,
      base_json as baseJson,
      local_json as localJson,
      remote_json as remoteJson,
      status,
      resolution_json as resolutionJson
    from sync_conflicts
    where (@profileId is null or profile_id = @profileId)
    order by created_at desc
  `;
  return database
    .prepare(query)
    .all({ profileId: input.profileId ?? null })
    .map(syncConflictRow);
}

function syncConflictRow(row: unknown): SyncConflictRecord {
  const conflict = row as {
    id: string;
    profileId: string;
    entityType: string;
    entityId: string;
    baseJson: string;
    localJson: string;
    remoteJson: string;
    status: 'open' | 'resolved';
    resolutionJson: string | null;
  };

  return {
    id: conflict.id,
    profileId: conflict.profileId,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    base: JSON.parse(conflict.baseJson),
    local: JSON.parse(conflict.localJson),
    remote: JSON.parse(conflict.remoteJson),
    status: conflict.status,
    resolution: conflict.resolutionJson
      ? (JSON.parse(conflict.resolutionJson) as { resolution: string }).resolution
      : null
  };
}

function toDiscoverPreviewResult(input: CoreDiscoverPreviewResult): DiscoverPreviewResult {
  return {
    source: input.source,
    skills: input.skills,
    writesPlanned: input.writesPlanned
  };
}

function toImportedSkillResult(input: {
  skill: SkillRecord;
  files: ImportedSkillResult['files'];
  stagedFrom: string;
  signatureStatus?: ImportedSkillResult['signatureStatus'];
}): ImportedSkillResult {
  return {
    skill: toSkillSummary(input.skill),
    files: input.files,
    stagedFrom: input.stagedFrom,
    ...(input.signatureStatus ? { signatureStatus: input.signatureStatus } : {})
  };
}

function toSkillSummary(skill: SkillRecord): DesktopWorkspaceState['skills'][number] {
  return {
    id: skill.id,
    versionId: skill.versionId,
    name: skill.name,
    description: skill.description,
    versionNo: skill.versionNo,
    favorite: skill.favorite
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
    rootKind: plan.rootKind,
    projectionMode: plan.projectionMode,
    conflictState: plan.conflictState,
    writes: plan.writes
  };
}

function toInstallResult(result: CoreInstallResult): InstallResult {
  return {
    status: result.status,
    installationId: result.installationId,
    ...(result.targetRoot ? { targetRoot: result.targetRoot } : {}),
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

async function scanSkillWithPluginRules(input: {
  database: SqliteDatabase;
  plugins: PluginService;
  scan: SecurityScanResult;
}): Promise<SecurityScanResult> {
  const registry = input.plugins.getRegistry();
  if (registry.securityRules.length === 0) {
    return input.scan;
  }

  const pluginFindings: SecurityScanResult['findings'] = [];
  for (const rule of registry.securityRules) {
    const result = await input.plugins.invokeProvider({
      pluginId: rule.pluginId,
      capabilityType: 'security-rule',
      capabilityId: rule.id,
      input: {
        skillId: input.scan.skillId,
        versionId: input.scan.versionId,
        scanId: input.scan.id
      }
    });
    pluginFindings.push(...normalizePluginSecurityFindings(result, rule.name));
  }

  if (pluginFindings.length === 0) {
    return input.scan;
  }

  const findings = [...input.scan.findings, ...pluginFindings];
  const score = scoreSecurityFindings(findings);
  const level = levelForSecurityScore(score);
  const blocked = level === 'high' || level === 'critical';

  input.database
    .transaction(() => {
      input.database
        .prepare(
          `
            update security_scans
            set score = @score,
                level = @level,
                blocked = @blocked,
                scanned_at = current_timestamp
            where id = @scanId
          `
        )
        .run({ scanId: input.scan.id, score, level, blocked: blocked ? 1 : 0 });

      const insertFinding = input.database.prepare(
        `
          insert into security_findings
            (id, scan_id, rule_id, severity, category, relative_path, line_no, excerpt)
          values
            (@id, @scanId, @ruleId, @severity, @category, @relativePath, @lineNo, @excerpt)
        `
      );

      for (const finding of pluginFindings) {
        insertFinding.run({
          id: randomUUID(),
          scanId: input.scan.id,
          ruleId: finding.ruleId,
          severity: finding.severity,
          category: finding.category,
          relativePath: finding.relativePath,
          lineNo: finding.lineNo,
          excerpt: finding.excerpt
        });
      }
    })();

  return {
    ...input.scan,
    score,
    level,
    blocked,
    findings
  };
}

function normalizePluginSecurityFindings(
  output: unknown,
  fallbackRuleName: string
): SecurityScanResult['findings'] {
  const rawFindings = Array.isArray(output) ? output : output === undefined || output === null ? [] : [output];
  return rawFindings.map((raw) => {
    const finding = raw as Partial<SecurityScanResult['findings'][number]> | null;
    if (!finding || typeof finding !== 'object') {
      throw new Error('Plugin security rule returned an invalid finding');
    }

    const severity = normalizeSecuritySeverity(finding.severity);
    if (
      typeof finding.ruleId !== 'string' ||
      finding.ruleId.trim() === '' ||
      typeof finding.category !== 'string' ||
      finding.category.trim() === '' ||
      typeof finding.relativePath !== 'string' ||
      finding.relativePath.trim() === '' ||
      typeof finding.excerpt !== 'string'
    ) {
      throw new Error('Plugin security rule returned an invalid finding');
    }

    return {
      ruleId: finding.ruleId,
      ruleName:
        typeof finding.ruleName === 'string' && finding.ruleName.trim() !== ''
          ? finding.ruleName
          : fallbackRuleName,
      severity,
      category: finding.category,
      relativePath: finding.relativePath,
      lineNo: typeof finding.lineNo === 'number' && Number.isInteger(finding.lineNo) ? finding.lineNo : null,
      excerpt: finding.excerpt
    };
  });
}

function normalizeSecuritySeverity(input: unknown): 'low' | 'medium' | 'high' | 'critical' | 'warning' {
  if (input === 'low' || input === 'medium' || input === 'high' || input === 'critical' || input === 'warning') {
    return input;
  }

  throw new Error(`Plugin security rule returned an invalid severity: ${String(input)}`);
}

function scoreSecurityFindings(findings: SecurityScanResult['findings']): number {
  return Math.min(
    100,
    findings.reduce((score, finding) => score + securityScoreForSeverity(finding.severity), 0)
  );
}

function securityScoreForSeverity(severity: string): number {
  if (severity === 'critical') {
    return 95;
  }

  if (severity === 'high') {
    return 75;
  }

  if (severity === 'medium') {
    return 45;
  }

  return 15;
}

function levelForSecurityScore(score: number): string {
  if (score >= 90) {
    return 'critical';
  }

  if (score >= 70) {
    return 'high';
  }

  if (score >= 40) {
    return 'medium';
  }

  if (score > 0) {
    return 'low';
  }

  return 'safe';
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
