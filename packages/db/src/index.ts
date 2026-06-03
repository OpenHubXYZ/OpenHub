export const dbPackage = {
  name: '@theopenhub/db',
  phase: 'Phase 2 SQLite domain foundation'
} as const;

export { resolveAppDataDirectory } from './app-data';
export { createLibraryRepository } from './library-repository';
export { createFileDatabase, createMemoryDatabase, getCurrentSchemaVersion, runMigrations } from './migrations';
export { createSkillRepository } from './skill-repository';

export type { AppDataDirectoryInput } from './app-data';
export type {
  LibraryRepository,
  LibrarySkillSummary,
  RecordScannedInstallationInput
} from './library-repository';
export type { MigrationResult, SqliteDatabase } from './migrations';
export type {
  CreateSkillInput,
  SkillRecord,
  SkillRepository,
  UpdateSkillMetadataInput
} from './skill-repository';
