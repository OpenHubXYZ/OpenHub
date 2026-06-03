export const corePackage = {
  name: '@theopenhub/core',
  phase: 'Phase 3 library indexing baseline'
} as const;

export { scanAgentLibraries } from './library-scanner';
export { SkillParseError, parseSkillManifest } from './skill-parser';

export type {
  IndexedSkillResult,
  ScanAgentLibrariesInput,
  ScanAgentLibrariesResult,
  ScanErrorResult
} from './library-scanner';

export type { ParsedSkillManifest, SkillParseErrorCode } from './skill-parser';
