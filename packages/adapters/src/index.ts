export const adaptersPackage = {
  name: '@theopenhub/adapters',
  phase: 'Phase 3 agent detection baseline'
} as const;

export { createBuiltInAgentAdapters } from './built-in-adapters';

export type { AgentAdapter, AgentCode, AgentRoot, AgentRootScope, IndexedSkillLocation } from './agent-adapter';
