export type AgentCode = 'codex' | 'claude' | 'gemini' | 'opencode' | 'agents';
export type AgentRootScope = 'user' | 'project';

export interface AgentRoot {
  agentCode: AgentCode;
  agentDisplayName: string;
  adapterVersion: string;
  rootPath: string;
  scope: AgentRootScope;
  writable: boolean;
  isDefault: boolean;
}

export interface IndexedSkillLocation {
  agentCode: AgentCode;
  rootPath: string;
  skillPath: string;
  manifestPath: string;
}

export interface AgentAdapter {
  id: AgentCode;
  displayName: string;
  adapterVersion: string;
  detectRoots(): Promise<AgentRoot[]>;
  listIndexedSkills(root: AgentRoot): Promise<IndexedSkillLocation[]>;
}
