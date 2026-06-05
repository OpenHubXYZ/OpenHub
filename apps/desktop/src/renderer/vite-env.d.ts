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
      invokePluginProvider(input: {
        pluginId: string;
        capabilityType: 'agent-adapter' | 'importer' | 'security-rule' | 'sync-driver';
        capabilityId: string;
        input: unknown;
      }): Promise<unknown>;
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
