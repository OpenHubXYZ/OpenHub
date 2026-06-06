export const dbPackage = {
  name: '@theopenhub/db',
  phase: 'Phase 2 SQLite domain foundation'
} as const;

export { resolveAppDataDirectory } from './app-data';
export { createLibraryRepository } from './library-repository';
export { createFileDatabase, createMemoryDatabase, getCurrentSchemaVersion, runMigrations } from './migrations';
export { createReviewRepository } from './review-repository';
export { createSkillRepository, refreshSkillSearchIndexes } from './skill-repository';
export { createUsageRepository } from './usage-repository';

export type { AppDataDirectoryInput } from './app-data';
export type {
  LibraryRepository,
  LibrarySkillSummary,
  RecordScannedInstallationInput
} from './library-repository';
export type { MigrationResult, SqliteDatabase } from './migrations';
export type {
  ReviewCenterState,
  ReviewItemSummary,
  ReviewRepository,
  UpsertReviewItemInput
} from './review-repository';
export type {
  CreateSkillInput,
  LibraryFacets,
  LibraryFacetValue,
  SkillSearchFilters,
  SkillSearchMode,
  SkillSearchOptions,
  SkillFileInput,
  SkillRecord,
  SkillRepository,
  UpdateSkillMetadataInput
} from './skill-repository';
export type { RecordUsageEventInput, UsageCenterState, UsageRepository } from './usage-repository';
