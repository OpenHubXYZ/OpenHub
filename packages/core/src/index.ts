export const corePackage = {
  name: '@theopenhub/core',
  phase: 'Phase 10 maintainer operations'
} as const;

export { createCollectionService } from './collection-service';
export { createContentStore } from './content-store';
export { createDiscoverService } from './discover-service';
export { createExportService } from './export-service';
export { createImportService } from './import-service';
export { InstallBlockedError, createInstallService } from './install-service';
export { scanAgentLibraries } from './library-scanner';
export { PathSafetyError, assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';
export { createPolicyService } from './policy-service';
export { PluginHostError, PluginManifestError, createPluginService } from './plugin-service';
export { createSecurityService, defaultSecurityRules } from './security-service';
export {
  createGitSyncDriver,
  createInMemorySecretStore,
  createMockRestSyncDriver,
  createOsKeychainSecretStore,
  createRestSyncDriver,
  createSharedFolderSyncDriver,
  createSyncService
} from './sync-service';
export { createVersionService } from './version-service';
export { SkillParseError, parseSkillManifest } from './skill-parser';

export type {
  CollectionExportResult,
  CollectionImportResult,
  CollectionRecord,
  CollectionService,
  CreateCollectionInput,
  CreateCollectionServiceInput
} from './collection-service';
export type { ContentStore, StoredBlob } from './content-store';
export type {
  CreateDiscoverServiceInput,
  DiscoverPreviewResult,
  DiscoverService,
  DiscoverSkillPreview,
  DiscoverSource,
  DiscoverSourceType,
  MigrationAdapter,
  MigrationPreviewResult
} from './discover-service';
export type {
  CreateExportServiceInput,
  ExportSignedSkillInput,
  ExportService,
  ExportSkillInput,
  ExportSkillResult
} from './export-service';
export type {
  CreateImportServiceInput,
  ImportedSkillFile,
  ImportedSkillResult,
  ImportService,
  ImportSignatureStatus,
  ImportSourceType
} from './import-service';
export type {
  CreateInstallServiceInput,
  InstallConflictState,
  InstallProjectionMode,
  InstallPlan,
  InstallPlanWrite,
  InstallResult,
  InstallRootKind,
  InstallService,
  MultiTargetInstallResult,
  InstallWriteConflict
} from './install-service';
export type {
  IndexedSkillResult,
  ScanAgentLibrariesInput,
  ScanAgentLibrariesResult,
  ScanErrorResult
} from './library-scanner';
export type { PathSafetyErrorCode } from './path-safety';
export type {
  CreatePolicyServiceInput,
  PolicyEvaluation,
  PolicyPack,
  PolicyScanLevel,
  PolicyService,
  TeamBaselinePackage,
  TeamBaselinePreview
} from './policy-service';
export type {
  CreatePluginServiceInput,
  InstalledPlugin,
  PluginAgentAdapterRegistration,
  PluginCapability,
  PluginCapabilityType,
  PluginCenterState,
  PluginHostErrorCode,
  PluginIntegrity,
  PluginManifest,
  PluginManifestErrorCode,
  PluginPermission,
  PluginRegistry,
  PluginService,
  PluginStatus
} from './plugin-service';
export type {
  CreateSecurityServiceInput,
  InstallPolicyResult,
  SecurityExemption,
  SecurityFinding,
  SecurityFindingDraft,
  SecurityLevel,
  SecurityRule,
  SecurityRuleScanInput,
  SecurityScanResult,
  SecurityService,
  SecuritySeverity
} from './security-service';
export type {
  CreateSyncServiceInput,
  ConflictResolution,
  SecretStore,
  SyncConflictRecord,
  SyncDriver,
  SyncInboxRecord,
  SyncMode,
  SyncOutboxRecord,
  SyncPackage,
  SyncProfile,
  SyncService
} from './sync-service';
export type {
  CreateVersionServiceInput,
  FileChangeType,
  FileDiff,
  ReleaseChannel,
  SkillVersionSummary,
  VersionLifecycle,
  VersionFileInput,
  VersionService
} from './version-service';

export type { ParsedSkillManifest, SkillParseErrorCode } from './skill-parser';
