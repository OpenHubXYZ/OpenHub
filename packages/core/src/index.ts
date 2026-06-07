export const corePackage = {
  name: '@theopenhub/core',
  phase: 'Phase 10 skills workspace operations'
} as const;

export { createCollectionService } from './collection-service';
export { createContentStore } from './content-store';
export { createDiscoverService } from './discover-service';
export { createImportService } from './import-service';
export { InstallServiceError, createInstallService } from './install-service';
export { scanAgentLibraries } from './library-scanner';
export { PathSafetyError, assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';
export { PluginHostError, PluginManifestError, createPluginService } from './plugin-service';
export { createSettingsService } from './settings-service';
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
  DiscoverSourceType
} from './discover-service';
export type {
  CreateImportServiceInput,
  ImportedSkillFile,
  ImportedSkillResult,
  ImportService,
  ImportSourceType
} from './import-service';
export type {
  ApplyInstallPlanInput,
  CreateInstallPlanInput,
  InstallErrorCode,
  InstallPlan,
  InstallPlanStatus,
  InstallPlanWrite,
  InstallResult,
  InstallService,
  InstallWriteStatus,
  ProjectionMode
} from './install-service';
export type {
  IndexedSkillResult,
  ScanAgentLibrariesInput,
  ScanAgentLibrariesResult,
  ScanErrorResult
} from './library-scanner';
export type { PathSafetyErrorCode } from './path-safety';
export type {
  CreatePluginServiceInput,
  InstalledPlugin,
  PluginAgentAdapterRegistration,
  PluginCapability,
  PluginCapabilityType,
  PluginCatalogEntry,
  PluginCatalogStatus,
  PluginCenterState,
  PluginDirectoryRecord,
  PluginDirectoryScanResult,
  PluginDirectoryStatus,
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
  LogLevel,
  MirrorSourceSetting,
  RedactedLogRecord,
  RuntimeSettings,
  SettingsService
} from './settings-service';
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
  SkillVersionSummary,
  VersionFileInput,
  VersionService
} from './version-service';

export type { ParsedSkillManifest, SkillParseErrorCode } from './skill-parser';
