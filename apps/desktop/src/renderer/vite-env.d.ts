/// <reference types="vite/client" />

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

declare global {
  interface Window {
    theOpenHub?: {
      getAppInfo(): Promise<AppInfo>;
      getOnboardingState(): Promise<OnboardingState>;
      completeOnboarding(completed?: boolean): Promise<OnboardingState>;
      importMigration(input: {
        adapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
        sourcePath: string;
        paths?: string[];
        items?: Array<{ path: string; selected?: boolean; importLabel?: string }>;
      }): Promise<ImportedSkillResult[]>;
      addProjectRoot(input: {
        agentCode: 'codex' | 'claude' | 'gemini' | 'opencode';
        rootPath: string;
      }): Promise<InstallTarget>;
      listAgentRoots(): Promise<InstallTarget[]>;
      listLibrarySkills(): Promise<LibrarySkillSummary[]>;
      scanAgentRoots(): Promise<LibraryScanResult>;
      getWorkspaceState(): Promise<DesktopWorkspaceState>;
      importLocalFolder(folderPath: string): Promise<ImportedSkillResult>;
      importGit(gitUrl: string): Promise<ImportedSkillResult>;
      importZip(zipPath: string): Promise<ImportedSkillResult>;
      importTar(tarPath: string): Promise<ImportedSkillResult>;
      importGitSparse(input: { gitUrl: string; subpath: string }): Promise<ImportedSkillResult>;
      importMirror(mirrorDirectory: string): Promise<ImportedSkillResult>;
      exportSkill(skillId: string, outputDirectory: string): Promise<ExportSkillResult>;
      exportSignedSkill(input: {
        skillId: string;
        outputDirectory: string;
        signer: string;
      }): Promise<ExportSkillResult>;
      createCollection(input: {
        name: string;
        description: string;
        skillIds: string[];
      }): Promise<CollectionRecord>;
      exportCollection(collectionId: string, outputDirectory: string): Promise<CollectionExportResult>;
      importCollection(packageDirectory: string): Promise<CollectionImportResult>;
      searchLibrary(
        query: string,
        options?: { favoritesOnly?: boolean; mode?: 'fts' | 'semantic' | 'hybrid'; filters?: LibrarySearchFilters }
      ): Promise<SkillSummary[]>;
      getLibraryFacets(filters?: LibrarySearchFilters): Promise<LibraryFacets>;
      setFavorite(skillId: string, favorite: boolean): Promise<SkillSummary>;
      getSkillDetail(skillId: string): Promise<SkillDetail>;
      listInstallTargets(): Promise<InstallTarget[]>;
      createInstallPlan(input: {
        skillId: string;
        targetRoot: string;
        agentCode: string;
        agentDisplayName: string;
        adapterVersion: string;
        scope: string;
        rootKind?: 'user' | 'project';
        projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
      }): Promise<InstallPlan>;
      checkInstallCompatibility(input: {
        skillId: string;
        targetRoot: string;
        agentCode: string;
        agentDisplayName: string;
        adapterVersion: string;
        scope: string;
        rootKind?: 'user' | 'project';
        projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
        versionId?: string;
      }): Promise<InstallCompatibility>;
      createMultiTargetInstallPlan(input: {
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
      }): Promise<InstallPlan[]>;
      applyInstallPlan(plan: InstallPlan): Promise<InstallResult>;
      applyMultiTargetInstallPlan(plans: InstallPlan[]): Promise<MultiTargetInstallResult>;
      uninstall(installationId: string): Promise<InstallUninstallResult>;
      reinstall(installationId: string): Promise<InstallLifecycleResult>;
      relink(input: {
        installationId: string;
        targetRoot: string;
        agentCode: string;
        agentDisplayName: string;
        adapterVersion: string;
        scope: string;
        rootKind?: 'user' | 'project';
        projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
      }): Promise<InstallLifecycleResult>;
      setReadOnlyLock(installationId: string, locked: boolean): Promise<InstallLockResult>;
      listVersions(skillId: string): Promise<SkillVersionSummary[]>;
      diffVersions(fromVersionId: string, toVersionId: string): Promise<FileDiff[]>;
      createDraftVersion(input: {
        skillId: string;
        changeSummary: string;
        files: Array<{ relativePath: string; content: string }>;
      }): Promise<SkillVersionSummary>;
      promoteVersion(versionId: string, releaseChannel: 'beta' | 'stable'): Promise<SkillVersionSummary>;
      compareVersions(fromVersionId: string, toVersionId: string): Promise<VersionComparisonReport>;
      rollbackVersion(installationId: string, targetVersionId: string): Promise<{
        status: 'rolled_back';
        installationId: string;
        versionId: string;
      }>;
      openAuthorSourceFolder(sourcePath: string): Promise<{ status: 'opened'; sourcePath: string }>;
      preflightAuthorSource(sourcePath: string, signer?: string): Promise<AuthorPreflightResult>;
      createAuthorDraftPackage(input: {
        skillId: string;
        sourcePath: string;
        outputDirectory: string;
        changeSummary: string;
      }): Promise<AuthorPackageResult>;
      prepareAuthorPublishPackage(input: {
        skillId: string;
        sourcePath: string;
        outputDirectory: string;
        signer: string;
      }): Promise<AuthorPackageResult>;
      scanSkill(skillId: string): Promise<SecurityScanResult>;
      rescanSecurity(skillIds?: string[]): Promise<SecurityScanResult[]>;
      getSecurityFindingDetail(input: {
        scanId?: string;
        skillId?: string;
        ruleId?: string;
      }): Promise<SecurityFindingDetail>;
      createSecurityExemption(input: {
        skillId: string;
        scope: string;
        reason: string;
      }): Promise<SecurityExemption>;
      revokeSecurityExemption(exemptionId: string): Promise<SecurityRevokeExemptionResult>;
      getSyncStartupPlan(): Promise<SyncStartupPlan>;
      createSyncProfile(input: {
        mode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
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
        permission: 'agent-root:read' | 'agent-root:write' | 'network:fetch' | 'import:local' | 'sync-driver' | 'export:local';
        reason: string;
      }): Promise<StatusOnlyResult>;
      enablePlugin(pluginId: string): Promise<PluginRegistry>;
      disablePlugin(pluginId: string): Promise<StatusOnlyResult>;
      getPluginRegistry(): Promise<PluginRegistry>;
      invokePluginProvider(input: {
        pluginId: string;
        capabilityType: 'agent-adapter' | 'importer' | 'security-rule' | 'sync-driver' | 'exporter';
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
      createPolicyPack(input: {
        name: string;
        allowedSources: string[];
        blockedRules: string[];
        requiredScanLevel: 'safe' | 'warning' | 'critical';
        approvedPlugins: string[];
      }): Promise<PolicyPack>;
      listPolicyPacks(): Promise<PolicyPack[]>;
      setActivePolicyPack(policyPackId: string): Promise<StatusOnlyResult>;
      evaluatePolicy(input: {
        policyPackId: string;
        sourceType: string;
        findingRuleIds: string[];
        scanLevel: 'safe' | 'warning' | 'critical';
        pluginIds: string[];
      }): Promise<PolicyEvaluation>;
      exportBaseline(input: {
        outputDirectory: string;
        name: string;
        collectionIds: string[];
        policyPackId: string;
        rootTemplates: Array<{ agentCode: string; scope: string; rootPathTemplate: string }>;
      }): Promise<BaselineExportResult>;
      previewBaseline(packageDirectory: string): Promise<BaselinePreview>;
      applyBaseline(packageDirectory: string, confirm: boolean): Promise<BaselinePreview>;
      addDiscoverSource(input: {
        name: string;
        sourceType: 'local' | 'git';
        url: string;
        trustLevel: string;
      }): Promise<DiscoverSource>;
      previewDiscoverSource(sourceId: string): Promise<DiscoverPreviewResult>;
      previewMigration(input: {
        adapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
        sourcePath: string;
      }): Promise<MigrationPreviewResult>;
    };
  }
}

export {};
