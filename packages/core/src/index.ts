export const corePackage = {
  name: '@theopenhub/core',
  phase: 'Phase 5 security governance'
} as const;

export { createContentStore } from './content-store';
export { createExportService } from './export-service';
export { createImportService } from './import-service';
export { InstallBlockedError, createInstallService } from './install-service';
export { scanAgentLibraries } from './library-scanner';
export { PathSafetyError, assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';
export { createSecurityService, defaultSecurityRules } from './security-service';
export { SkillParseError, parseSkillManifest } from './skill-parser';

export type { ContentStore, StoredBlob } from './content-store';
export type {
  CreateExportServiceInput,
  ExportService,
  ExportSkillInput,
  ExportSkillResult
} from './export-service';
export type {
  CreateImportServiceInput,
  ImportedSkillFile,
  ImportedSkillResult,
  ImportService,
  ImportSourceType
} from './import-service';
export type {
  CreateInstallServiceInput,
  InstallConflictState,
  InstallPlan,
  InstallPlanWrite,
  InstallResult,
  InstallService,
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

export type { ParsedSkillManifest, SkillParseErrorCode } from './skill-parser';
