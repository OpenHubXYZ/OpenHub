/// <reference types="vite/client" />

import type {
  AppInfo,
  CollectionExportResult,
  CollectionImportResult,
  CollectionRecord,
  DesktopWorkspaceState,
  DiscoverPreviewResult,
  DiscoverSource,
  ExportSkillResult,
  FileDiff,
  ImportedSkillResult,
  InstallPlan,
  InstallResult,
  InstallTarget,
  InstallUninstallResult,
  LibraryScanResult,
  LibrarySkillSummary,
  MigrationPreviewResult,
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
  SyncStartupPlan
} from '@theopenhub/shared';

declare global {
  interface Window {
    theOpenHub?: {
      getAppInfo(): Promise<AppInfo>;
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
      searchLibrary(query: string, options?: { favoritesOnly?: boolean }): Promise<SkillSummary[]>;
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
      createMultiTargetInstallPlan(input: {
        skillId: string;
        projectionMode?: 'copy' | 'symlink' | 'hardlink' | 'mirror-export';
        targets: Array<{
          targetRoot: string;
          agentCode: string;
          agentDisplayName: string;
          adapterVersion: string;
          scope: string;
          rootKind?: 'user' | 'project';
        }>;
      }): Promise<InstallPlan[]>;
      applyInstallPlan(plan: InstallPlan): Promise<InstallResult>;
      uninstall(installationId: string): Promise<InstallUninstallResult>;
      listVersions(skillId: string): Promise<SkillVersionSummary[]>;
      diffVersions(fromVersionId: string, toVersionId: string): Promise<FileDiff[]>;
      rollbackVersion(installationId: string, targetVersionId: string): Promise<{
        status: 'rolled_back';
        installationId: string;
        versionId: string;
      }>;
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
      authorizePluginPermission(input: {
        pluginId: string;
        permission: 'agent-root:read' | 'agent-root:write' | 'network:fetch' | 'import:local' | 'sync-driver';
        reason: string;
      }): Promise<StatusOnlyResult>;
      enablePlugin(pluginId: string): Promise<PluginRegistry>;
      disablePlugin(pluginId: string): Promise<StatusOnlyResult>;
      getPluginRegistry(): Promise<PluginRegistry>;
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
