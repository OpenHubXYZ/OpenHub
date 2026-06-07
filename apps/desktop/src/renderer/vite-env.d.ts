/// <reference types="vite/client" />

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

declare global {
  interface Window {
    theOpenHub?: {
      getAppInfo(): Promise<AppInfo>;
      getOnboardingState(): Promise<OnboardingState>;
      completeOnboarding(completed?: boolean): Promise<OnboardingState>;
      addProjectRoot(input: {
        agentCode: 'codex' | 'claude' | 'gemini' | 'opencode' | 'agents';
        rootPath: string;
      }): Promise<AgentRootTarget>;
      listAgentRoots(): Promise<AgentRootTarget[]>;
      listLibrarySkills(): Promise<LibrarySkillSummary[]>;
      scanAgentRoots(): Promise<LibraryScanResult>;
      getWorkspaceState(): Promise<DesktopWorkspaceState>;
      importLocalFolder(folderPath: string): Promise<ImportedSkillResult>;
      importGit(gitUrl: string): Promise<ImportedSkillResult>;
      importZip(zipPath: string): Promise<ImportedSkillResult>;
      importTar(tarPath: string): Promise<ImportedSkillResult>;
      importGitSparse(input: { gitUrl: string; subpath: string }): Promise<ImportedSkillResult>;
      importMirror(mirrorDirectory: string): Promise<ImportedSkillResult>;
      createCollection(input: { name: string; description: string; skillIds: string[] }): Promise<CollectionRecord>;
      searchLibrary(
        query: string,
        options?: { favoritesOnly?: boolean; mode?: 'fts' | 'semantic' | 'hybrid'; filters?: LibrarySearchFilters }
      ): Promise<SkillSummary[]>;
      getLibraryFacets(filters?: LibrarySearchFilters): Promise<LibraryFacets>;
      setFavorite(skillId: string, favorite: boolean): Promise<SkillSummary>;
      getSkillDetail(skillId: string): Promise<SkillDetail>;
      createInstallPlan(input: {
        skillId: string;
        targetRoot: string;
        agentCode: string;
        agentDisplayName: string;
        adapterVersion: string;
        scope: string;
        rootKind?: 'user' | 'project';
        projectionMode: 'copy' | 'symlink';
      }): Promise<InstallPlan>;
      applyInstallPlan(plan: InstallPlan, confirmOverwrite: boolean): Promise<InstallResult>;
      uninstallSkill(installationId: string): Promise<{ status: 'uninstalled'; installationId: string }>;
      listVersions(skillId: string): Promise<SkillVersionSummary[]>;
      diffVersions(fromVersionId: string, toVersionId: string): Promise<FileDiff[]>;
      compareVersions(fromVersionId: string, toVersionId: string): Promise<VersionComparisonReport>;
      getSyncStartupPlan(): Promise<SyncStartupPlan>;
      createSyncProfile(input: {
        mode: 'shared-folder' | 'git' | 'rest';
        remoteUrl: string;
        enabled: boolean;
        authRef?: string | null;
        auth?: { label: string; token: string };
      }): Promise<SyncProfile>;
      inspectSyncCredential(authRef: string): Promise<{ authRef: string; label: string; masked: string } | null>;
      deleteSyncCredential(authRef: string): Promise<StatusOnlyResult>;
      enqueueSyncLocalChange(input: {
        profileId: string;
        entityType: string;
        entityId: string;
        payload: unknown;
      }): Promise<SyncOutboxRecord>;
      pushSync(profileId: string): Promise<StatusOnlyResult>;
      pullSync(profileId: string): Promise<SyncInboxRecord[]>;
      listSyncConflicts(profileId?: string): Promise<SyncConflictRecord[]>;
      resolveSyncConflict(conflictId: string, resolution: string): Promise<SyncConflictRecord>;
      applySyncConflict(input: {
        conflictId: string;
        confirm: boolean;
        resolution: unknown;
      }): Promise<SyncConflictRecord & { draftVersionIds?: string[] }>;
      getPluginCenterState(): Promise<PluginsState>;
      installPlugin(rootPath: string): Promise<PluginInstallResult>;
      addPluginDirectory(rootPath: string): Promise<PluginDirectoryRecord>;
      listPluginDirectories(): Promise<PluginDirectoryRecord[]>;
      scanPluginDirectory(directoryId: string): Promise<PluginDirectoryScanResult>;
      removePluginDirectory(directoryId: string): Promise<StatusOnlyResult>;
      authorizePluginPermission(input: {
        pluginId: string;
        permission: 'agent-root:read' | 'network:fetch' | 'import:local' | 'sync-driver';
        reason: string;
      }): Promise<StatusOnlyResult>;
      enablePlugin(pluginId: string): Promise<PluginRegistry>;
      disablePlugin(pluginId: string): Promise<StatusOnlyResult>;
      getPluginRegistry(): Promise<PluginRegistry>;
      invokePluginProvider(input: {
        pluginId: string;
        capabilityType: 'agent-adapter' | 'importer' | 'sync-driver';
        capabilityId: string;
        input: unknown;
      }): Promise<unknown>;
      getSettings(): Promise<AppSettings>;
      addMirrorSource(input: { name: string; url: string }): Promise<AppSettings['mirrorSources'][number]>;
      removeMirrorSource(mirrorSourceId: string): Promise<StatusOnlyResult>;
      setUpdateChecks(enabled: boolean): Promise<AppSettings>;
      setLogLevel(logLevel: 'debug' | 'info' | 'warn' | 'error'): Promise<AppSettings>;
      addSettingsPluginDirectory(rootPath: string): Promise<PluginDirectoryRecord>;
      listSettingsPluginDirectories(): Promise<PluginDirectoryRecord[]>;
      removeSettingsPluginDirectory(directoryId: string): Promise<StatusOnlyResult>;
      addDiscoverSource(input: {
        name: string;
        sourceType: 'local' | 'git';
        url: string;
      }): Promise<DiscoverSource>;
      listDiscoverSources(): Promise<DiscoverSource[]>;
      previewDiscoverSource(sourceId: string): Promise<DiscoverPreviewResult>;
      removeDiscoverSource(sourceId: string): Promise<StatusOnlyResult>;
    };
  }
}

export {};
