export const dbPackage = {
  name: '@theopenhub/db',
  phase: 'Phase 2 SQLite domain foundation'
} as const;

export { resolveAppDataDirectory } from './app-data';
export { createLibraryRepository } from './library-repository';
export { createFileDatabase, createMemoryDatabase, getCurrentSchemaVersion, runMigrations } from './migrations';
export { createSkillRepository, refreshSkillSearchIndexes } from './skill-repository';

export type { AppDataDirectoryInput } from './app-data';
export type {
  LibraryRepository,
  LibrarySkillSummary,
  RecordIndexedSkillLocationInput
} from './library-repository';
export type { MigrationResult, SqliteDatabase } from './migrations';
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
