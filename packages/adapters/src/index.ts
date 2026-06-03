export const adaptersPackage = {
  name: '@theopenhub/adapters',
  phase: 'Phase 3 agent detection baseline'
} as const;

export { createBuiltInAgentAdapters } from './built-in-adapters';

export type {
  AdapterOperationResult,
  AgentAdapter,
  AgentCode,
  AgentRoot,
  AgentRootScope,
  InstalledSkillLocation
} from './agent-adapter';
