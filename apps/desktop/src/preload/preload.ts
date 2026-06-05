import { contextBridge, ipcRenderer } from 'electron';

import { desktopShellContract, parseIpcResponse } from '@theopenhub/shared';
import type {
  AppInfo,
  AppSettings,
  CollectionExportResult,
  CollectionImportResult,
  CollectionRecord,
  DesktopWorkspaceState,
  DiscoverPreviewResult,
  DiscoverSource,
  ExportSkillResult,
  FileDiff,
  ImportedSkillResult,
  InstallCompatibility,
  InstallLifecycleResult,
  InstallLockResult,
  InstallPlan,
  InstallResult,
  InstallTarget,
  InstallUninstallResult,
  LibraryFacets,
  LibraryScanResult,
  LibrarySearchFilters,
  LibrarySkillSummary,
  MigrationPreviewResult,
  MultiTargetInstallResult,
  OnboardingState,
  BaselineExportResult,
  BaselinePreview,
  PolicyEvaluation,
  PolicyPack,
  PluginDirectoryRecord,
  PluginDirectoryScanResult,
  PluginInstallResult,
  PluginRegistry,
  PluginsState,
  SecurityExemption,
  SecurityFindingDetail,
  SecurityRevokeExemptionResult,
  SecurityScanResult,
  SkillDetail,
  SkillSummary,
  SkillVersionSummary,
  StatusOnlyResult,
  SyncConflictRecord,
  SyncInboxRecord,
  SyncOutboxRecord,
  SyncProfile,
  SyncStartupPlan,
  AuthorPackageResult,
  AuthorPreflightResult,
  VersionComparisonReport
} from '@theopenhub/shared';

const api = {
  async getAppInfo(): Promise<AppInfo> {
    const payload = await ipcRenderer.invoke(desktopShellContract.appInfo.channel, {});
    return parseIpcResponse(desktopShellContract.appInfo.channel, payload);
  },

  async getOnboardingState(): Promise<OnboardingState> {
    const payload = await ipcRenderer.invoke(desktopShellContract.onboardingState.channel, {});
    return parseIpcResponse(desktopShellContract.onboardingState.channel, payload);
  },

  async completeOnboarding(completed = true): Promise<OnboardingState> {
    const payload = await ipcRenderer.invoke(desktopShellContract.onboardingComplete.channel, { completed });
    return parseIpcResponse(desktopShellContract.onboardingComplete.channel, payload);
  },

  async importMigration(input: {
    adapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
    sourcePath: string;
    paths?: string[];
    items?: Array<{ path: string; selected?: boolean; importLabel?: string }>;
  }): Promise<ImportedSkillResult[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.onboardingImportMigration.channel, input);
    return parseIpcResponse(desktopShellContract.onboardingImportMigration.channel, payload);
  },

  async addProjectRoot(input: {
    agentCode: 'codex' | 'claude' | 'gemini' | 'opencode';
    rootPath: string;
  }): Promise<InstallTarget> {
    const payload = await ipcRenderer.invoke(desktopShellContract.agentRootsAddProject.channel, input);
    return parseIpcResponse(desktopShellContract.agentRootsAddProject.channel, payload);
  },

  async listAgentRoots(): Promise<InstallTarget[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.agentRootsList.channel, {});
    return parseIpcResponse(desktopShellContract.agentRootsList.channel, payload);
  },

  async listLibrarySkills(): Promise<LibrarySkillSummary[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryList.channel, {});
    return parseIpcResponse(desktopShellContract.libraryList.channel, payload);
  },

  async scanAgentRoots(): Promise<LibraryScanResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryScan.channel, {});
    return parseIpcResponse(desktopShellContract.libraryScan.channel, payload);
  },

  async getWorkspaceState(): Promise<DesktopWorkspaceState> {
    const payload = await ipcRenderer.invoke(desktopShellContract.workspaceState.channel, {});
    return parseIpcResponse(desktopShellContract.workspaceState.channel, payload);
  },

  async importLocalFolder(folderPath: string): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importLocalFolder.channel, { folderPath });
    return parseIpcResponse(desktopShellContract.importLocalFolder.channel, payload);
  },

  async importGit(gitUrl: string): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importGit.channel, { gitUrl });
    return parseIpcResponse(desktopShellContract.importGit.channel, payload);
  },

  async importZip(zipPath: string): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importZip.channel, { zipPath });
    return parseIpcResponse(desktopShellContract.importZip.channel, payload);
  },

  async importTar(tarPath: string): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importTar.channel, { tarPath });
    return parseIpcResponse(desktopShellContract.importTar.channel, payload);
  },

  async importGitSparse(input: { gitUrl: string; subpath: string }): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importGitSparse.channel, input);
    return parseIpcResponse(desktopShellContract.importGitSparse.channel, payload);
  },

  async importMirror(mirrorDirectory: string): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importMirror.channel, { mirrorDirectory });
    return parseIpcResponse(desktopShellContract.importMirror.channel, payload);
  },

  async exportSkill(skillId: string, outputDirectory: string): Promise<ExportSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.exportSkill.channel, { skillId, outputDirectory });
    return parseIpcResponse(desktopShellContract.exportSkill.channel, payload);
  },

  async exportSignedSkill(input: {
    skillId: string;
    outputDirectory: string;
    signer: string;
  }): Promise<ExportSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.exportSignedSkill.channel, input);
    return parseIpcResponse(desktopShellContract.exportSignedSkill.channel, payload);
  },
  async createCollection(input: {
    name: string;
    description: string;
    skillIds: string[];
  }): Promise<CollectionRecord> {
    const payload = await ipcRenderer.invoke(desktopShellContract.collectionCreate.channel, input);
    return parseIpcResponse(desktopShellContract.collectionCreate.channel, payload);
  },

  async exportCollection(collectionId: string, outputDirectory: string): Promise<CollectionExportResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.collectionExport.channel, {
      collectionId,
      outputDirectory
    });
    return parseIpcResponse(desktopShellContract.collectionExport.channel, payload);
  },

  async importCollection(packageDirectory: string): Promise<CollectionImportResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.collectionImport.channel, { packageDirectory });
    return parseIpcResponse(desktopShellContract.collectionImport.channel, payload);
  },

  async searchLibrary(query: string, options?: {
    favoritesOnly?: boolean;
    mode?: 'fts' | 'semantic' | 'hybrid';
    filters?: LibrarySearchFilters;
  }): Promise<SkillSummary[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.librarySearch.channel, {
      query,
      favoritesOnly: options?.favoritesOnly,
      mode: options?.mode,
      filters: options?.filters
    });
    return parseIpcResponse(desktopShellContract.librarySearch.channel, payload);
  },

  async getLibraryFacets(filters?: LibrarySearchFilters): Promise<LibraryFacets> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryFacets.channel, { filters });
    return parseIpcResponse(desktopShellContract.libraryFacets.channel, payload);
  },

  async setFavorite(skillId: string, favorite: boolean): Promise<SkillSummary> {
    const payload = await ipcRenderer.invoke(desktopShellContract.librarySetFavorite.channel, {
      skillId,
      favorite
    });
    return parseIpcResponse(desktopShellContract.librarySetFavorite.channel, payload);
  },

  async getSkillDetail(skillId: string): Promise<SkillDetail> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryDetail.channel, { skillId });
    return parseIpcResponse(desktopShellContract.libraryDetail.channel, payload);
  },

  async createInstallPlan(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: 'user' | 'project';
    projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
  }): Promise<InstallPlan> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installCreatePlan.channel, input);
    return parseIpcResponse(desktopShellContract.installCreatePlan.channel, payload);
  },

  async checkInstallCompatibility(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: 'user' | 'project';
    projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
    versionId?: string;
  }): Promise<InstallCompatibility> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installCheckCompatibility.channel, input);
    return parseIpcResponse(desktopShellContract.installCheckCompatibility.channel, payload);
  },

  async createMultiTargetInstallPlan(input: {
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
  }): Promise<InstallPlan[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installCreateMultiTargetPlan.channel, input);
    return parseIpcResponse(desktopShellContract.installCreateMultiTargetPlan.channel, payload);
  },

  async listInstallTargets(): Promise<InstallTarget[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installListTargets.channel, {});
    return parseIpcResponse(desktopShellContract.installListTargets.channel, payload);
  },

  async applyInstallPlan(plan: InstallPlan): Promise<InstallResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installApplyPlan.channel, { plan });
    return parseIpcResponse(desktopShellContract.installApplyPlan.channel, payload);
  },

  async applyMultiTargetInstallPlan(plans: InstallPlan[]): Promise<MultiTargetInstallResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installApplyMultiTargetPlan.channel, { plans });
    return parseIpcResponse(desktopShellContract.installApplyMultiTargetPlan.channel, payload);
  },

  async uninstall(installationId: string): Promise<InstallUninstallResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installUninstall.channel, { installationId });
    return parseIpcResponse(desktopShellContract.installUninstall.channel, payload);
  },

  async reinstall(installationId: string): Promise<InstallLifecycleResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installReinstall.channel, { installationId });
    return parseIpcResponse(desktopShellContract.installReinstall.channel, payload);
  },

  async relink(input: {
    installationId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: 'user' | 'project';
    projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
  }): Promise<InstallLifecycleResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installRelink.channel, input);
    return parseIpcResponse(desktopShellContract.installRelink.channel, payload);
  },

  async setReadOnlyLock(installationId: string, locked: boolean): Promise<InstallLockResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installSetReadOnlyLock.channel, {
      installationId,
      locked
    });
    return parseIpcResponse(desktopShellContract.installSetReadOnlyLock.channel, payload);
  },

  async listVersions(skillId: string): Promise<SkillVersionSummary[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.versionList.channel, { skillId });
    return parseIpcResponse(desktopShellContract.versionList.channel, payload);
  },

  async diffVersions(fromVersionId: string, toVersionId: string): Promise<FileDiff[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.versionDiff.channel, {
      fromVersionId,
      toVersionId
    });
    return parseIpcResponse(desktopShellContract.versionDiff.channel, payload);
  },

  async createDraftVersion(input: {
    skillId: string;
    changeSummary: string;
    files: Array<{ relativePath: string; content: string }>;
  }): Promise<SkillVersionSummary> {
    const payload = await ipcRenderer.invoke(desktopShellContract.versionCreateDraft.channel, input);
    return parseIpcResponse(desktopShellContract.versionCreateDraft.channel, payload);
  },

  async promoteVersion(versionId: string, releaseChannel: 'beta' | 'stable'): Promise<SkillVersionSummary> {
    const payload = await ipcRenderer.invoke(desktopShellContract.versionPromote.channel, {
      versionId,
      releaseChannel
    });
    return parseIpcResponse(desktopShellContract.versionPromote.channel, payload);
  },

  async compareVersions(fromVersionId: string, toVersionId: string): Promise<VersionComparisonReport> {
    const payload = await ipcRenderer.invoke(desktopShellContract.versionCompare.channel, {
      fromVersionId,
      toVersionId
    });
    return parseIpcResponse(desktopShellContract.versionCompare.channel, payload);
  },

  async rollbackVersion(installationId: string, targetVersionId: string): Promise<{
    status: 'rolled_back';
    installationId: string;
    versionId: string;
  }> {
    const payload = await ipcRenderer.invoke(desktopShellContract.versionRollback.channel, {
      installationId,
      targetVersionId
    });
    return parseIpcResponse(desktopShellContract.versionRollback.channel, payload);
  },

  async openAuthorSourceFolder(sourcePath: string): Promise<{ status: 'opened'; sourcePath: string }> {
    const payload = await ipcRenderer.invoke(desktopShellContract.authorOpenSourceFolder.channel, { sourcePath });
    return parseIpcResponse(desktopShellContract.authorOpenSourceFolder.channel, payload);
  },

  async preflightAuthorSource(sourcePath: string, signer?: string): Promise<AuthorPreflightResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.authorPreflight.channel, { sourcePath, signer });
    return parseIpcResponse(desktopShellContract.authorPreflight.channel, payload);
  },

  async createAuthorDraftPackage(input: {
    skillId: string;
    sourcePath: string;
    outputDirectory: string;
    changeSummary: string;
  }): Promise<AuthorPackageResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.authorCreateDraftPackage.channel, input);
    return parseIpcResponse(desktopShellContract.authorCreateDraftPackage.channel, payload);
  },

  async prepareAuthorPublishPackage(input: {
    skillId: string;
    sourcePath: string;
    outputDirectory: string;
    signer: string;
  }): Promise<AuthorPackageResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.authorPreparePublishPackage.channel, input);
    return parseIpcResponse(desktopShellContract.authorPreparePublishPackage.channel, payload);
  },

  async scanSkill(skillId: string): Promise<SecurityScanResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.securityScan.channel, { skillId });
    return parseIpcResponse(desktopShellContract.securityScan.channel, payload);
  },

  async rescanSecurity(skillIds?: string[]): Promise<SecurityScanResult[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.securityRescan.channel, { skillIds });
    return parseIpcResponse(desktopShellContract.securityRescan.channel, payload);
  },

  async getSecurityFindingDetail(input: {
    scanId?: string;
    skillId?: string;
    ruleId?: string;
  }): Promise<SecurityFindingDetail> {
    const payload = await ipcRenderer.invoke(desktopShellContract.securityFindingDetail.channel, input);
    return parseIpcResponse(desktopShellContract.securityFindingDetail.channel, payload);
  },

  async createSecurityExemption(input: {
    skillId: string;
    scope: string;
    reason: string;
  }): Promise<SecurityExemption> {
    const payload = await ipcRenderer.invoke(desktopShellContract.securityCreateExemption.channel, input);
    return parseIpcResponse(desktopShellContract.securityCreateExemption.channel, payload);
  },

  async revokeSecurityExemption(exemptionId: string): Promise<SecurityRevokeExemptionResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.securityRevokeExemption.channel, { exemptionId });
    return parseIpcResponse(desktopShellContract.securityRevokeExemption.channel, payload);
  },

  async getSyncStartupPlan(): Promise<SyncStartupPlan> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncStartupPlan.channel, {});
    return parseIpcResponse(desktopShellContract.syncStartupPlan.channel, payload);
  },

  async createSyncProfile(input: {
    mode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
    remoteUrl: string;
    enabled: boolean;
    authRef?: string | null;
    auth?: { label: string; token: string };
  }): Promise<SyncProfile> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncCreateProfile.channel, input);
    return parseIpcResponse(desktopShellContract.syncCreateProfile.channel, payload);
  },

  async inspectSyncCredential(authRef: string): Promise<{ authRef: string; label: string; masked: string } | null> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncInspectCredential.channel, { authRef });
    return parseIpcResponse(desktopShellContract.syncInspectCredential.channel, payload);
  },

  async deleteSyncCredential(authRef: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncDeleteCredential.channel, { authRef });
    return parseIpcResponse(desktopShellContract.syncDeleteCredential.channel, payload);
  },

  async enqueueSyncLocalChange(input: {
    profileId: string;
    entityType: string;
    entityId: string;
    payload: unknown;
  }): Promise<SyncOutboxRecord> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncEnqueueLocalChange.channel, input);
    return parseIpcResponse(desktopShellContract.syncEnqueueLocalChange.channel, payload);
  },

  async pushSync(profileId: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncPush.channel, { profileId });
    return parseIpcResponse(desktopShellContract.syncPush.channel, payload);
  },

  async pullSync(profileId: string): Promise<SyncInboxRecord[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncPull.channel, { profileId });
    return parseIpcResponse(desktopShellContract.syncPull.channel, payload);
  },

  async listSyncConflicts(profileId?: string): Promise<SyncConflictRecord[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncListConflicts.channel, { profileId });
    return parseIpcResponse(desktopShellContract.syncListConflicts.channel, payload);
  },

  async resolveSyncConflict(conflictId: string, resolution: string): Promise<SyncConflictRecord> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncResolveConflict.channel, {
      conflictId,
      resolution
    });
    return parseIpcResponse(desktopShellContract.syncResolveConflict.channel, payload);
  },

  async applySyncConflict(input: {
    conflictId: string;
    confirm: boolean;
    resolution: unknown;
  }): Promise<SyncConflictRecord & { draftVersionIds?: string[] }> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncApplyConflict.channel, input);
    return parseIpcResponse(desktopShellContract.syncApplyConflict.channel, payload);
  },

  async getPluginCenterState(): Promise<PluginsState> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsCenterState.channel, {});
    return parseIpcResponse(desktopShellContract.pluginsCenterState.channel, payload);
  },

  async installPlugin(rootPath: string): Promise<PluginInstallResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsInstall.channel, { rootPath });
    return parseIpcResponse(desktopShellContract.pluginsInstall.channel, payload);
  },

  async addPluginDirectory(rootPath: string): Promise<PluginDirectoryRecord> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsAddDirectory.channel, { rootPath });
    return parseIpcResponse(desktopShellContract.pluginsAddDirectory.channel, payload);
  },

  async listPluginDirectories(): Promise<PluginDirectoryRecord[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsListDirectories.channel, {});
    return parseIpcResponse(desktopShellContract.pluginsListDirectories.channel, payload);
  },

  async scanPluginDirectory(directoryId: string): Promise<PluginDirectoryScanResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsScanDirectory.channel, { directoryId });
    return parseIpcResponse(desktopShellContract.pluginsScanDirectory.channel, payload);
  },

  async removePluginDirectory(directoryId: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsRemoveDirectory.channel, { directoryId });
    return parseIpcResponse(desktopShellContract.pluginsRemoveDirectory.channel, payload);
  },

  async authorizePluginPermission(input: {
    pluginId: string;
    permission: 'agent-root:read' | 'agent-root:write' | 'network:fetch' | 'import:local' | 'sync-driver' | 'export:local';
    reason: string;
  }): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsAuthorizePermission.channel, input);
    return parseIpcResponse(desktopShellContract.pluginsAuthorizePermission.channel, payload);
  },

  async enablePlugin(pluginId: string): Promise<PluginRegistry> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsEnable.channel, { pluginId });
    return parseIpcResponse(desktopShellContract.pluginsEnable.channel, payload);
  },

  async disablePlugin(pluginId: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsDisable.channel, { pluginId });
    return parseIpcResponse(desktopShellContract.pluginsDisable.channel, payload);
  },

  async getPluginRegistry(): Promise<PluginRegistry> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsRegistry.channel, {});
    return parseIpcResponse(desktopShellContract.pluginsRegistry.channel, payload);
  },

  async invokePluginProvider(input: {
    pluginId: string;
    capabilityType: 'agent-adapter' | 'importer' | 'security-rule' | 'sync-driver' | 'exporter';
    capabilityId: string;
    input: unknown;
  }): Promise<unknown> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsInvokeProvider.channel, input);
    return parseIpcResponse(desktopShellContract.pluginsInvokeProvider.channel, payload);
  },

  async getSettings(): Promise<AppSettings> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsGet.channel, {});
    return parseIpcResponse(desktopShellContract.settingsGet.channel, payload);
  },

  async addMirrorSource(input: { name: string; url: string }): Promise<AppSettings['mirrorSources'][number]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsAddMirrorSource.channel, input);
    return parseIpcResponse(desktopShellContract.settingsAddMirrorSource.channel, payload);
  },

  async removeMirrorSource(mirrorSourceId: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsRemoveMirrorSource.channel, { mirrorSourceId });
    return parseIpcResponse(desktopShellContract.settingsRemoveMirrorSource.channel, payload);
  },

  async setUpdateChecks(enabled: boolean): Promise<AppSettings> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsSetUpdateChecks.channel, { enabled });
    return parseIpcResponse(desktopShellContract.settingsSetUpdateChecks.channel, payload);
  },

  async setLogLevel(logLevel: 'debug' | 'info' | 'warn' | 'error'): Promise<AppSettings> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsSetLogLevel.channel, { logLevel });
    return parseIpcResponse(desktopShellContract.settingsSetLogLevel.channel, payload);
  },

  async addSettingsPluginDirectory(rootPath: string): Promise<PluginDirectoryRecord> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsAddPluginDirectory.channel, { rootPath });
    return parseIpcResponse(desktopShellContract.settingsAddPluginDirectory.channel, payload);
  },

  async listSettingsPluginDirectories(): Promise<PluginDirectoryRecord[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsListPluginDirectories.channel, {});
    return parseIpcResponse(desktopShellContract.settingsListPluginDirectories.channel, payload);
  },

  async removeSettingsPluginDirectory(directoryId: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.settingsRemovePluginDirectory.channel, { directoryId });
    return parseIpcResponse(desktopShellContract.settingsRemovePluginDirectory.channel, payload);
  },

  async createPolicyPack(input: {
    name: string;
    allowedSources: string[];
    blockedRules: string[];
    requiredScanLevel: 'safe' | 'warning' | 'critical';
    approvedPlugins: string[];
  }): Promise<PolicyPack> {
    const payload = await ipcRenderer.invoke(desktopShellContract.policyCreate.channel, input);
    return parseIpcResponse(desktopShellContract.policyCreate.channel, payload);
  },

  async listPolicyPacks(): Promise<PolicyPack[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.policyList.channel, {});
    return parseIpcResponse(desktopShellContract.policyList.channel, payload);
  },

  async setActivePolicyPack(policyPackId: string): Promise<StatusOnlyResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.policySetActive.channel, { policyPackId });
    return parseIpcResponse(desktopShellContract.policySetActive.channel, payload);
  },

  async evaluatePolicy(input: {
    policyPackId: string;
    sourceType: string;
    findingRuleIds: string[];
    scanLevel: 'safe' | 'warning' | 'critical';
    pluginIds: string[];
  }): Promise<PolicyEvaluation> {
    const payload = await ipcRenderer.invoke(desktopShellContract.policyEvaluate.channel, input);
    return parseIpcResponse(desktopShellContract.policyEvaluate.channel, payload);
  },

  async exportBaseline(input: {
    outputDirectory: string;
    name: string;
    collectionIds: string[];
    policyPackId: string;
    rootTemplates: Array<{ agentCode: string; scope: string; rootPathTemplate: string }>;
  }): Promise<BaselineExportResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.baselineExport.channel, input);
    return parseIpcResponse(desktopShellContract.baselineExport.channel, payload);
  },

  async previewBaseline(packageDirectory: string): Promise<BaselinePreview> {
    const payload = await ipcRenderer.invoke(desktopShellContract.baselinePreview.channel, { packageDirectory });
    return parseIpcResponse(desktopShellContract.baselinePreview.channel, payload);
  },

  async applyBaseline(packageDirectory: string, confirm: boolean): Promise<BaselinePreview> {
    const payload = await ipcRenderer.invoke(desktopShellContract.baselineApply.channel, { packageDirectory, confirm });
    return parseIpcResponse(desktopShellContract.baselineApply.channel, payload);
  },

  async addDiscoverSource(input: {
    name: string;
    sourceType: 'local' | 'git';
    url: string;
    trustLevel: string;
  }): Promise<DiscoverSource> {
    const payload = await ipcRenderer.invoke(desktopShellContract.discoverAddSource.channel, input);
    return parseIpcResponse(desktopShellContract.discoverAddSource.channel, payload);
  },

  async previewDiscoverSource(sourceId: string): Promise<DiscoverPreviewResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.discoverPreviewSource.channel, { sourceId });
    return parseIpcResponse(desktopShellContract.discoverPreviewSource.channel, payload);
  },

  async previewMigration(input: {
    adapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
    sourcePath: string;
  }): Promise<MigrationPreviewResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.discoverMigrationPreview.channel, input);
    return parseIpcResponse(desktopShellContract.discoverMigrationPreview.channel, payload);
  }
};

contextBridge.exposeInMainWorld('theOpenHub', api);
