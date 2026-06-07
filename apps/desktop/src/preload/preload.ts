import { contextBridge, ipcRenderer } from 'electron';

import { desktopShellContract, parseIpcResponse } from '@theopenhub/shared';
import type {
  AgentRootTarget,
  AppInfo,
  AppSettings,
  CollectionRecord,
  DesktopWorkspaceState,
  DiscoverPreviewResult,
  DiscoverSource,
  FileDiff,
  ImportedSkillResult,
  InstallPlan,
  InstallResult,
  LibraryFacets,
  LibraryScanResult,
  LibrarySearchFilters,
  LibrarySkillSummary,
  OnboardingState,
  PluginDirectoryRecord,
  PluginDirectoryScanResult,
  PluginInstallResult,
  PluginRegistry,
  PluginsState,
  SkillDetail,
  SkillSummary,
  SkillVersionSummary,
  StatusOnlyResult,
  SyncConflictRecord,
  SyncInboxRecord,
  SyncOutboxRecord,
  SyncProfile,
  SyncStartupPlan,
  VersionComparisonReport
} from '@theopenhub/shared';

async function invoke<C extends keyof typeof desktopShellContract>(
  key: C,
  payload: unknown
): Promise<unknown> {
  const contract = desktopShellContract[key];
  return parseIpcResponse(contract.channel, await ipcRenderer.invoke(contract.channel, payload));
}

const api = {
  getAppInfo(): Promise<AppInfo> {
    return invoke('appInfo', {}) as Promise<AppInfo>;
  },

  getOnboardingState(): Promise<OnboardingState> {
    return invoke('onboardingState', {}) as Promise<OnboardingState>;
  },

  completeOnboarding(completed = true): Promise<OnboardingState> {
    return invoke('onboardingComplete', { completed }) as Promise<OnboardingState>;
  },

  addProjectRoot(input: {
    agentCode: 'codex' | 'claude' | 'gemini' | 'opencode' | 'agents';
    rootPath: string;
  }): Promise<AgentRootTarget> {
    return invoke('agentRootsAddProject', input) as Promise<AgentRootTarget>;
  },

  removeProjectRoot(input: { agentCode: string; rootPath: string }): Promise<StatusOnlyResult> {
    return invoke('agentRootsRemoveProject', input) as Promise<StatusOnlyResult>;
  },

  listAgentRoots(): Promise<AgentRootTarget[]> {
    return invoke('agentRootsList', {}) as Promise<AgentRootTarget[]>;
  },

  listLibrarySkills(): Promise<LibrarySkillSummary[]> {
    return invoke('libraryList', {}) as Promise<LibrarySkillSummary[]>;
  },

  scanAgentRoots(): Promise<LibraryScanResult> {
    return invoke('libraryScan', {}) as Promise<LibraryScanResult>;
  },

  getWorkspaceState(): Promise<DesktopWorkspaceState> {
    return invoke('workspaceState', {}) as Promise<DesktopWorkspaceState>;
  },

  importLocalFolder(folderPath: string): Promise<ImportedSkillResult> {
    return invoke('importLocalFolder', { folderPath }) as Promise<ImportedSkillResult>;
  },

  importGit(gitUrl: string): Promise<ImportedSkillResult> {
    return invoke('importGit', { gitUrl }) as Promise<ImportedSkillResult>;
  },

  importZip(zipPath: string): Promise<ImportedSkillResult> {
    return invoke('importZip', { zipPath }) as Promise<ImportedSkillResult>;
  },

  importTar(tarPath: string): Promise<ImportedSkillResult> {
    return invoke('importTar', { tarPath }) as Promise<ImportedSkillResult>;
  },

  importGitSparse(input: { gitUrl: string; subpath: string }): Promise<ImportedSkillResult> {
    return invoke('importGitSparse', input) as Promise<ImportedSkillResult>;
  },

  importMirror(mirrorDirectory: string): Promise<ImportedSkillResult> {
    return invoke('importMirror', { mirrorDirectory }) as Promise<ImportedSkillResult>;
  },

  createCollection(input: { name: string; description: string; skillIds: string[] }): Promise<CollectionRecord> {
    return invoke('collectionCreate', input) as Promise<CollectionRecord>;
  },

  searchLibrary(
    query: string,
    options?: { favoritesOnly?: boolean; mode?: 'fts' | 'semantic' | 'hybrid'; filters?: LibrarySearchFilters }
  ): Promise<SkillSummary[]> {
    return invoke('librarySearch', {
      query,
      favoritesOnly: options?.favoritesOnly,
      mode: options?.mode,
      filters: options?.filters
    }) as Promise<SkillSummary[]>;
  },

  getLibraryFacets(filters?: LibrarySearchFilters): Promise<LibraryFacets> {
    return invoke('libraryFacets', { filters }) as Promise<LibraryFacets>;
  },

  setFavorite(skillId: string, favorite: boolean): Promise<SkillSummary> {
    return invoke('librarySetFavorite', { skillId, favorite }) as Promise<SkillSummary>;
  },

  getSkillDetail(skillId: string): Promise<SkillDetail> {
    return invoke('libraryDetail', { skillId }) as Promise<SkillDetail>;
  },

  createInstallPlan(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
    rootKind?: 'user' | 'project';
    projectionMode: 'copy' | 'symlink';
  }): Promise<InstallPlan> {
    return invoke('installCreatePlan', input) as Promise<InstallPlan>;
  },

  applyInstallPlan(plan: InstallPlan, confirmOverwrite: boolean): Promise<InstallResult> {
    return invoke('installApplyPlan', { plan, confirmOverwrite }) as Promise<InstallResult>;
  },

  uninstallSkill(installationId: string): Promise<{ status: 'uninstalled'; installationId: string }> {
    return invoke('installUninstall', { installationId }) as Promise<{ status: 'uninstalled'; installationId: string }>;
  },

  listVersions(skillId: string): Promise<SkillVersionSummary[]> {
    return invoke('versionList', { skillId }) as Promise<SkillVersionSummary[]>;
  },

  diffVersions(fromVersionId: string, toVersionId: string): Promise<FileDiff[]> {
    return invoke('versionDiff', { fromVersionId, toVersionId }) as Promise<FileDiff[]>;
  },

  compareVersions(fromVersionId: string, toVersionId: string): Promise<VersionComparisonReport> {
    return invoke('versionCompare', { fromVersionId, toVersionId }) as Promise<VersionComparisonReport>;
  },

  getSyncStartupPlan(): Promise<SyncStartupPlan> {
    return invoke('syncStartupPlan', {}) as Promise<SyncStartupPlan>;
  },

  createSyncProfile(input: {
    mode: 'shared-folder' | 'git' | 'rest';
    remoteUrl: string;
    enabled: boolean;
    authRef?: string | null;
    auth?: { label: string; token: string };
  }): Promise<SyncProfile> {
    return invoke('syncCreateProfile', input) as Promise<SyncProfile>;
  },

  inspectSyncCredential(authRef: string): Promise<{ authRef: string; label: string; masked: string } | null> {
    return invoke('syncInspectCredential', { authRef }) as Promise<{ authRef: string; label: string; masked: string } | null>;
  },

  deleteSyncCredential(authRef: string): Promise<StatusOnlyResult> {
    return invoke('syncDeleteCredential', { authRef }) as Promise<StatusOnlyResult>;
  },

  enqueueSyncLocalChange(input: {
    profileId: string;
    entityType: string;
    entityId: string;
    payload: unknown;
  }): Promise<SyncOutboxRecord> {
    return invoke('syncEnqueueLocalChange', input) as Promise<SyncOutboxRecord>;
  },

  pushSync(profileId: string): Promise<StatusOnlyResult> {
    return invoke('syncPush', { profileId }) as Promise<StatusOnlyResult>;
  },

  pullSync(profileId: string): Promise<SyncInboxRecord[]> {
    return invoke('syncPull', { profileId }) as Promise<SyncInboxRecord[]>;
  },

  listSyncConflicts(profileId?: string): Promise<SyncConflictRecord[]> {
    return invoke('syncListConflicts', { profileId }) as Promise<SyncConflictRecord[]>;
  },

  resolveSyncConflict(conflictId: string, resolution: string): Promise<SyncConflictRecord> {
    return invoke('syncResolveConflict', { conflictId, resolution }) as Promise<SyncConflictRecord>;
  },

  applySyncConflict(input: {
    conflictId: string;
    confirm: boolean;
    resolution: unknown;
  }): Promise<SyncConflictRecord & { draftVersionIds?: string[] }> {
    return invoke('syncApplyConflict', input) as Promise<SyncConflictRecord & { draftVersionIds?: string[] }>;
  },

  getPluginCenterState(): Promise<PluginsState> {
    return invoke('pluginsCenterState', {}) as Promise<PluginsState>;
  },

  installPlugin(rootPath: string): Promise<PluginInstallResult> {
    return invoke('pluginsInstall', { rootPath }) as Promise<PluginInstallResult>;
  },

  addPluginDirectory(rootPath: string): Promise<PluginDirectoryRecord> {
    return invoke('pluginsAddDirectory', { rootPath }) as Promise<PluginDirectoryRecord>;
  },

  listPluginDirectories(): Promise<PluginDirectoryRecord[]> {
    return invoke('pluginsListDirectories', {}) as Promise<PluginDirectoryRecord[]>;
  },

  scanPluginDirectory(directoryId: string): Promise<PluginDirectoryScanResult> {
    return invoke('pluginsScanDirectory', { directoryId }) as Promise<PluginDirectoryScanResult>;
  },

  removePluginDirectory(directoryId: string): Promise<StatusOnlyResult> {
    return invoke('pluginsRemoveDirectory', { directoryId }) as Promise<StatusOnlyResult>;
  },

  authorizePluginPermission(input: {
    pluginId: string;
    permission: 'agent-root:read' | 'network:fetch' | 'import:local' | 'sync-driver';
    reason: string;
  }): Promise<StatusOnlyResult> {
    return invoke('pluginsAuthorizePermission', input) as Promise<StatusOnlyResult>;
  },

  enablePlugin(pluginId: string): Promise<PluginRegistry> {
    return invoke('pluginsEnable', { pluginId }) as Promise<PluginRegistry>;
  },

  disablePlugin(pluginId: string): Promise<StatusOnlyResult> {
    return invoke('pluginsDisable', { pluginId }) as Promise<StatusOnlyResult>;
  },

  getPluginRegistry(): Promise<PluginRegistry> {
    return invoke('pluginsRegistry', {}) as Promise<PluginRegistry>;
  },

  invokePluginProvider(input: {
    pluginId: string;
    capabilityType: 'agent-adapter' | 'importer' | 'sync-driver';
    capabilityId: string;
    input: unknown;
  }): Promise<unknown> {
    return invoke('pluginsInvokeProvider', input);
  },

  getSettings(): Promise<AppSettings> {
    return invoke('settingsGet', {}) as Promise<AppSettings>;
  },

  addMirrorSource(input: { name: string; url: string }): Promise<AppSettings['mirrorSources'][number]> {
    return invoke('settingsAddMirrorSource', input) as Promise<AppSettings['mirrorSources'][number]>;
  },

  removeMirrorSource(mirrorSourceId: string): Promise<StatusOnlyResult> {
    return invoke('settingsRemoveMirrorSource', { mirrorSourceId }) as Promise<StatusOnlyResult>;
  },

  setUpdateChecks(enabled: boolean): Promise<AppSettings> {
    return invoke('settingsSetUpdateChecks', { enabled }) as Promise<AppSettings>;
  },

  setLogLevel(logLevel: 'debug' | 'info' | 'warn' | 'error'): Promise<AppSettings> {
    return invoke('settingsSetLogLevel', { logLevel }) as Promise<AppSettings>;
  },

  addSettingsPluginDirectory(rootPath: string): Promise<PluginDirectoryRecord> {
    return invoke('settingsAddPluginDirectory', { rootPath }) as Promise<PluginDirectoryRecord>;
  },

  listSettingsPluginDirectories(): Promise<PluginDirectoryRecord[]> {
    return invoke('settingsListPluginDirectories', {}) as Promise<PluginDirectoryRecord[]>;
  },

  removeSettingsPluginDirectory(directoryId: string): Promise<StatusOnlyResult> {
    return invoke('settingsRemovePluginDirectory', { directoryId }) as Promise<StatusOnlyResult>;
  },

  addDiscoverSource(input: {
    name: string;
    sourceType: 'local' | 'git';
    url: string;
  }): Promise<DiscoverSource> {
    return invoke('discoverAddSource', input) as Promise<DiscoverSource>;
  },

  listDiscoverSources(): Promise<DiscoverSource[]> {
    return invoke('discoverListSources', {}) as Promise<DiscoverSource[]>;
  },

  previewDiscoverSource(sourceId: string): Promise<DiscoverPreviewResult> {
    return invoke('discoverPreviewSource', { sourceId }) as Promise<DiscoverPreviewResult>;
  },

  removeDiscoverSource(sourceId: string): Promise<StatusOnlyResult> {
    return invoke('discoverRemoveSource', { sourceId }) as Promise<StatusOnlyResult>;
  }
};

contextBridge.exposeInMainWorld('theOpenHub', api);
