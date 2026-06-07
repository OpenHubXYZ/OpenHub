import { appInfo } from '@theopenhub/shared';
import type {
  AgentRootTarget,
  DesktopWorkspaceState,
  DiscoverSkillPreview,
  LibraryScanResult,
  LibrarySkillSummary,
  SkillDetail
} from '@theopenhub/shared';

export const pageOrder = ['home', 'inventory', 'sources', 'settings'] as const;
export type PageKey = (typeof pageOrder)[number];
export type Tone = 'default' | 'low' | 'medium' | 'high' | 'neutral' | 'blue' | 'dark' | 'green' | 'red';

export interface NavItem {
  key: PageKey;
  label: string;
}

export interface MetricCard {
  label: string;
  value: string;
  detail: string;
}

export interface KeyValueRow {
  label: string;
  value: string;
}

export interface TableCell {
  label: string;
  detail?: string;
  tone?: Tone;
}

export interface TableRow {
  id: string;
  selected?: boolean;
  cells: TableCell[];
}

export interface AgentRootView {
  agent: string;
  path: string;
  status: string;
  tone: Tone;
}

export interface WorkspaceViewModel {
  appInfo: DesktopWorkspaceState['appInfo'];
  librarySkills: LibrarySkillSummary[];
  navItems: NavItem[];
  dashboard: {
    metrics: MetricCard[];
    activity: KeyValueRow[];
    agentRoots: AgentRootView[];
  };
  inventory: {
    rows: TableRow[];
  };
  sources: {
    previews: TableRow[];
  };
  settings: {
    syncRows: KeyValueRow[];
    pluginRows: KeyValueRow[];
  };
}

export interface ActionStep {
  label: string;
  description: string;
  status: 'current' | 'done' | 'pending';
  provenance: string;
  targetPage: PageKey;
}

export interface EmptyStateModel {
  title: string;
  text: string;
  actionLabel: string;
  provenance: string;
}

export interface SelectionSummaryModel {
  title: string;
  subtitle: string;
  rows: KeyValueRow[];
}

export interface CompatibilityRow {
  agent: string;
  root: string;
  scope: string;
  status: 'visible' | 'not checked';
  detail: string;
  tone: Tone;
}

export interface DiagnosticItem {
  title: string;
  detail: string;
  action: string;
  tone: Tone;
}

export interface ProvenanceChip {
  label: string;
  tone: Tone;
}

export interface WorkspaceUxModel {
  actionSteps: ActionStep[];
  compatibilityRows: CompatibilityRow[];
  diagnostics: DiagnosticItem[];
  emptyStates: Record<PageKey, EmptyStateModel>;
  primaryCommands: Record<PageKey, Array<{ id: string; label: string }>>;
  provenanceChips: ProvenanceChip[];
  sectionEmptyStates: Record<PageKey, EmptyStateModel>;
  selectionSummary: SelectionSummaryModel;
  workflowOwners: Record<'roots' | 'sourcePreview' | 'settings', PageKey>;
}

export interface WorkspaceUxModelInput {
  activePage: PageKey;
  discoverPreviewSkills: DiscoverSkillPreview[];
  agentRootTargets: AgentRootTarget[];
  selectedSkillDetail: SkillDetail | null;
  state: DesktopWorkspaceState;
}

export function createEmptyWorkspaceState(): DesktopWorkspaceState {
  return {
    appInfo,
    librarySkills: [],
    skills: [],
    managementFlow: {
      importItems: []
    },
    governance: {
      history: [],
      diff: [],
      collections: []
    },
    syncCenter: {
      profiles: [],
      outbox: [],
      inbox: [],
      conflicts: []
    },
    plugins: {
      directories: [],
      catalog: [],
      plugins: []
    }
  };
}

export function createWorkspaceViewModel(state: DesktopWorkspaceState): WorkspaceViewModel {
  return {
    appInfo: state.appInfo,
    librarySkills: state.librarySkills,
    navItems: [
      { key: 'home', label: 'Home' },
      { key: 'inventory', label: 'Inventory' },
      { key: 'sources', label: 'Sources' },
      { key: 'settings', label: 'Settings' }
    ],
    dashboard: {
      metrics: [
        {
          label: 'Indexed skills',
          value: String(state.librarySkills.length),
          detail: `${state.skills.length} imported`
        },
        {
          label: 'Sources',
          value: String(state.managementFlow.importItems.length),
          detail: 'Recent imports'
        },
        {
          label: 'Sync profiles',
          value: String(state.syncCenter.profiles.length),
          detail: 'Local first'
        }
      ],
      activity: state.managementFlow.importItems.map((item) => ({ label: item.label, value: item.status })),
      agentRoots: state.librarySkills.map((skill) => ({
        agent: skill.sourceAgent,
        path: skill.path,
        status: skill.visibilityStatus,
        tone: 'green'
      }))
    },
    inventory: {
      rows: state.librarySkills.map((skill) => ({
        id: skill.id,
        cells: [
          { label: skill.name, detail: skill.path },
          { label: skill.sourceAgent },
          { label: skill.visibilityStatus, tone: 'green' }
        ]
      }))
    },
    sources: {
      previews: []
    },
    settings: {
      syncRows: state.syncCenter.profiles.map((profile) => ({ label: profile.mode, value: profile.status })),
      pluginRows: state.plugins.plugins.map((plugin) => ({ label: plugin.name, value: plugin.status }))
    }
  };
}

export function createWorkspaceUxModel(input: WorkspaceUxModelInput): WorkspaceUxModel {
  const hasIndexedSkills = input.state.librarySkills.length > 0;
  const hasPreview = input.discoverPreviewSkills.length > 0;
  const selectionSummary = buildSelectionSummary(input.selectedSkillDetail, input.discoverPreviewSkills[0]);

  return {
    actionSteps: [
      {
        label: 'Set local roots',
        description: 'Choose local agent folders',
        status: input.agentRootTargets.length > 0 ? 'done' : 'current',
        provenance: input.agentRootTargets.length > 0 ? 'roots detected' : 'not scanned',
        targetPage: 'settings'
      },
      {
        label: 'Build inventory',
        description: 'Index local skills',
        status: hasIndexedSkills ? 'done' : input.agentRootTargets.length > 0 ? 'current' : 'pending',
        provenance: hasIndexedSkills ? 'indexed' : 'not scanned',
        targetPage: 'inventory'
      },
      {
        label: 'Preview source',
        description: 'Inspect local or Git candidates',
        status: hasPreview ? 'done' : hasIndexedSkills ? 'current' : 'pending',
        provenance: hasPreview ? 'source preview' : 'not previewed',
        targetPage: 'sources'
      }
    ],
    compatibilityRows: input.agentRootTargets.map((root) => ({
      agent: root.agentDisplayName,
      root: root.rootPath,
      scope: root.scope,
      status: 'not checked',
      detail: root.writable ? 'Writable local root' : 'Read only local root',
      tone: root.writable ? 'green' : 'medium'
    })),
    diagnostics: buildDiagnostics(input),
    emptyStates: emptyStates(),
    primaryCommands: {
      home: [{ id: 'scan-roots', label: 'Scan roots' }],
      inventory: [{ id: 'scan-roots', label: 'Scan roots' }],
      sources: [{ id: 'preview-source', label: 'Preview source' }],
      settings: [{ id: 'open-settings', label: 'Open settings' }]
    },
    provenanceChips: [
      { label: hasIndexedSkills ? 'indexed' : 'not scanned', tone: hasIndexedSkills ? 'green' : 'medium' },
      { label: hasPreview ? 'source preview' : 'not previewed', tone: hasPreview ? 'green' : 'low' }
    ],
    sectionEmptyStates: emptyStates(),
    selectionSummary,
    workflowOwners: {
      roots: 'settings',
      sourcePreview: 'sources',
      settings: 'settings'
    }
  };
}

export function mergeScanIntoWorkspaceState(
  state: DesktopWorkspaceState,
  scan: LibraryScanResult
): DesktopWorkspaceState {
  return {
    ...state,
    librarySkills: scan.indexedSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      sourceAgent: displayNameForAgent(skill.agentCode),
      path: skill.path,
      visibilityStatus: 'indexed',
      favorite: false
    }))
  };
}

function buildSelectionSummary(
  detail: SkillDetail | null,
  preview: DiscoverSkillPreview | undefined
): SelectionSummaryModel {
  if (detail) {
    return {
      title: detail.skill.name,
      subtitle: detail.source.type,
      rows: [
        { label: 'Files', value: String(detail.files.length) },
        { label: 'Version', value: String(detail.skill.versionNo) },
        { label: 'Source', value: detail.source.url ?? detail.source.type }
      ]
    };
  }

  if (preview) {
    return {
      title: preview.name,
      subtitle: preview.description,
      rows: [
        { label: 'Path', value: preview.path },
        { label: 'Tags', value: preview.tags.join(', ') || 'none' }
      ]
    };
  }

  return {
    title: 'Nothing selected',
    subtitle: 'Select an inventory item or source candidate',
    rows: []
  };
}

function buildDiagnostics(input: WorkspaceUxModelInput): DiagnosticItem[] {
  if (input.discoverPreviewSkills.length > 0) {
    return [
      {
        title: 'Source preview ready',
        detail: `${input.discoverPreviewSkills.length} candidates`,
        action: 'Review candidates before import',
        tone: 'green'
      }
    ];
  }

  if (input.state.librarySkills.length > 0) {
    return [
      {
        title: 'Inventory ready',
        detail: `${input.state.librarySkills.length} indexed skills`,
        action: 'Open an item to inspect files',
        tone: 'green'
      }
    ];
  }

  return [
    {
      title: 'Local roots not scanned',
      detail: 'No indexed skills yet',
      action: 'Scan roots',
      tone: 'medium'
    }
  ];
}

function emptyStates(): Record<PageKey, EmptyStateModel> {
  return {
    home: {
      title: 'No inventory yet',
      text: 'Scan local roots or import a source.',
      actionLabel: 'Scan local roots',
      provenance: 'not scanned'
    },
    inventory: {
      title: 'No indexed skills',
      text: 'Build the local inventory from agent roots.',
      actionLabel: 'Scan roots',
      provenance: 'inventory'
    },
    sources: {
      title: 'No sources previewed',
      text: 'Add a local folder or Git source.',
      actionLabel: 'Add local or Git source',
      provenance: 'source preview'
    },
    settings: {
      title: 'No local roots',
      text: 'Add or detect agent roots.',
      actionLabel: 'Add root',
      provenance: 'settings'
    }
  };
}

function displayNameForAgent(agentCode: string): string {
  const names: Record<string, string> = {
    codex: 'Codex',
    claude: 'Claude',
    gemini: 'Gemini',
    opencode: 'OpenCode',
    agents: 'Agents'
  };
  return names[agentCode] ?? agentCode;
}
