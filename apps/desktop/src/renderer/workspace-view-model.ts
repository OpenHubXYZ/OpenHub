import { appInfo } from '@theopenhub/shared';
import type { DesktopWorkspaceState, LibraryScanResult, LibrarySkillSummary } from '@theopenhub/shared';

export const pageOrder = [
  'dashboard',
  'library',
  'discover',
  'installs',
  'usage',
  'reviews',
  'security',
  'settings'
] as const;

export type PageKey = (typeof pageOrder)[number];

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

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
}

export interface TableCell {
  label: string;
  detail?: string;
  tone?: Tone;
  avatar?: string;
  avatarTone?: Tone;
}

export interface TableRow {
  id: string;
  selected?: boolean;
  cells: TableCell[];
}

export interface PanelModel {
  title: string;
  tag?: string | undefined;
  rows?: KeyValueRow[] | undefined;
  text?: string | undefined;
}

export type Tone = 'default' | 'low' | 'medium' | 'high' | 'neutral' | 'blue' | 'dark' | 'green' | 'red';

export interface AgentRootView {
  agent: string;
  path: string;
  status: string;
  tone: Tone;
}

export interface SourceCard {
  name: string;
  sourcePath: string;
  description: string;
  risk: 'Low' | 'Medium';
  tags: string[];
  selected?: boolean;
}

export interface WorkspaceViewModel {
  appInfo: DesktopWorkspaceState['appInfo'];
  librarySkills: LibrarySkillSummary[];
  navItems: NavItem[];
  databasePath: string;
  lastScanLabel: string;
  dashboard: {
    metrics: MetricCard[];
    activity: KeyValueRow[];
    readinessRows: TableRow[];
    agentRoots: AgentRootView[];
    agentCoverageBars: number[];
  };
  discover: {
    sources: SourceCard[];
    sourceUpdates: TableRow[];
  };
  installs: {
    plans: TableRow[];
    resultStream: KeyValueRow[];
    exportPackages: KeyValueRow[];
  };
  usage: {
    metrics: MetricCard[];
    dailyBars: number[];
    topSkills: KeyValueRow[];
    agentSplit: KeyValueRow[];
    recentUsage: KeyValueRow[];
  };
  reviews: {
    queue: TableRow[];
    notes: KeyValueRow[];
    communitySignal: KeyValueRow[];
  };
  security: {
    metrics: MetricCard[];
    queue: TableRow[];
    ruleDetails: KeyValueRow[];
    exemptions: KeyValueRow[];
  };
  settings: {
    agentRoots: AgentRootView[];
    syncRows: KeyValueRow[];
    pluginRows: KeyValueRow[];
    databaseRows: TableRow[];
    defaults: KeyValueRow[];
    syncPreview: KeyValueRow[];
  };
}

export function createEmptyWorkspaceState(): DesktopWorkspaceState {
  return {
    appInfo,
    librarySkills: [],
    skills: [],
    managementFlow: {
      importItems: [],
      installPlan: null,
      installResult: null
    },
    securityCenter: {
      queue: [],
      riskScore: 0,
      level: 'safe',
      findings: [],
      history: [],
      exemptions: []
    },
    usageCenter: {
      totals: {
        launches: 0,
        installs: 0,
        scans: 0,
        exports: 0
      },
      dailyActivity: [],
      topSkills: [],
      agentSplit: [],
      recent: []
    },
    reviewCenter: {
      queue: [],
      notes: []
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
  const installedCount = state.librarySkills.filter((skill) => skill.installStatus.toLowerCase() === 'installed').length;
  const blockedCount = state.securityCenter.queue.filter((item) => item.status.toLowerCase().includes('blocked')).length;
  const openFindings = state.securityCenter.findings.length;
  const runtimeReviewCount = state.reviewCenter.queue.filter((item) => item.status === 'Open').length;
  const reviewCount = openFindings + runtimeReviewCount;
  const agentRoots = createAgentRootViews(state.librarySkills);

  return {
    appInfo: state.appInfo,
    librarySkills: state.librarySkills,
    navItems: pageOrder.map((key) => ({
      key,
      label: pageLabels[key]
    })),
    databasePath: 'App data SQLite',
    lastScanLabel: state.managementFlow.importItems.length > 0 ? 'Last scan: current session' : 'No scan run this session',
    dashboard: {
      metrics: [
        metric('Indexed skills', state.librarySkills.length, `${state.skills.length} local skill records`),
        metric('Installed projections', installedCount, `${agentRoots.length} indexed roots`),
        metric('Needs review', reviewCount, `${openFindings} security findings`),
        metric('Blocked installs', blockedCount, 'policy enforced')
      ],
      activity: state.managementFlow.importItems.map((item) => ({ label: item.label, value: item.status })).slice(0, 5),
      readinessRows: createReadinessRows(state),
      agentRoots,
      agentCoverageBars: normalizeBars(agentRoots.map((root) => Number.parseInt(root.status, 10)).filter((count) => count > 0))
    },
    discover: {
      sources: [],
      sourceUpdates: []
    },
    installs: {
      plans: createInstallPlanRows(state),
      resultStream: state.managementFlow.installResult
        ? [{ label: state.managementFlow.installResult.message, value: state.managementFlow.installResult.status }]
        : [],
      exportPackages: []
    },
    usage: {
      metrics: [
        metric('Skill launches', state.usageCenter.totals.launches, 'local events only'),
        metric('Install actions', state.usageCenter.totals.installs, `${state.managementFlow.installPlan ? 1 : 0} active plan`),
        metric('Security scans', state.usageCenter.totals.scans, '100% stored locally'),
        metric('Exports', state.usageCenter.totals.exports, 'hash verified')
      ],
      dailyBars:
        state.usageCenter.dailyActivity.length > 0
          ? normalizeBars(state.usageCenter.dailyActivity.map((item) => item.count))
          : [],
      topSkills:
        state.usageCenter.topSkills.length > 0
          ? state.usageCenter.topSkills.map((item) => ({ label: item.skillName, value: String(item.count) }))
          : [],
      agentSplit:
        state.usageCenter.agentSplit.length > 0
          ? state.usageCenter.agentSplit.map((item) => ({ label: item.agent, value: `${item.count} events` }))
          : [],
      recentUsage:
        state.usageCenter.recent.length > 0
          ? state.usageCenter.recent.map((item) => ({ label: item.label, value: item.value }))
          : []
    },
    reviews: {
      queue: createReviewRows(state),
      notes: cloneKeyValueRows(state.reviewCenter.notes),
      communitySignal: []
    },
    security: {
      metrics: [
        metric('Risk score', state.securityCenter.riskScore, `${state.securityCenter.level} posture`),
        metric('Open findings', openFindings, `${countHighFindings(state)} high`),
        metric('Active exemptions', state.securityCenter.exemptions.length, 'scoped only'),
        metric('Blocked installs', blockedCount, 'default policy')
      ],
      queue: createSecurityRows(state),
      ruleDetails: state.securityCenter.findings
        .map((finding) => ({
          label: finding.ruleName,
          value: titleCase(finding.severity)
        }))
        .slice(0, 5),
      exemptions: state.securityCenter.exemptions.map((item) => ({ label: item.reason, value: item.scope }))
    },
    settings: {
      agentRoots,
      syncRows: createSyncRows(state),
      pluginRows: createPluginRows(state),
      databaseRows: [
        {
          id: 'sqlite-database',
          selected: true,
          cells: [
            { label: 'SQLite database' },
            { label: 'App data SQLite' },
            { label: 'Ready', tone: 'low' }
          ]
        },
        {
          id: 'skill-content-upload',
          cells: [{ label: 'Skill content upload' }, { label: 'Never by default' }, { label: 'Protected', tone: 'low' }]
        },
        {
          id: 'secrets-storage',
          cells: [{ label: 'Secrets storage' }, { label: 'OS keychain only' }, { label: 'Required', tone: 'low' }]
        }
      ],
      defaults: [
        { label: 'Node integration', value: 'Off' },
        { label: 'Context isolation', value: 'On' },
        { label: 'Sync profile', value: 'None' },
        { label: 'Telemetry', value: 'None' },
        { label: 'Plugin grants', value: 'Manual' }
      ],
      syncPreview: [
        { label: 'Outbox', value: `${state.syncCenter.outbox.length} queued` },
        { label: 'Inbox', value: `${state.syncCenter.inbox.length} pending` },
        { label: 'Conflicts', value: `${state.syncCenter.conflicts.length} open` },
        { label: 'Drivers', value: state.syncCenter.profiles.length > 0 ? `${state.syncCenter.profiles.length} configured` : 'None configured' }
      ]
    }
  };
}

export function mergeScanIntoWorkspaceState(
  state: DesktopWorkspaceState,
  scan: LibraryScanResult
): DesktopWorkspaceState {
  const scannedSkills: LibrarySkillSummary[] = scan.indexedSkills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    sourceAgent: titleCase(skill.agentCode),
    path: skill.path,
    installStatus: 'installed'
  }));
  const existingById = new Map(state.librarySkills.map((skill) => [skill.id, skill]));
  for (const skill of scannedSkills) {
    existingById.set(skill.id, skill);
  }

  return {
    ...state,
    librarySkills: Array.from(existingById.values()),
    managementFlow: {
      ...state.managementFlow,
      importItems: [
        ...scan.indexedSkills.map((skill) => ({ label: skill.name, status: 'indexed' })),
        ...scan.errors.map((error) => ({ label: error.skillPath, status: error.code })),
        ...state.managementFlow.importItems
      ].slice(0, 8)
    }
  };
}

function metric(label: string, value: number | string, detail: string): MetricCard {
  return {
    label,
    value: typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : value,
    detail
  };
}

function createReadinessRows(state: DesktopWorkspaceState): TableRow[] {
  const runtimeRows: TableRow[] = [];
  if (state.securityCenter.queue.length > 0) {
    runtimeRows.push({
      id: 'security-scan-queue',
      selected: true,
      cells: [
        { label: 'Security scan queue', detail: `${state.securityCenter.queue.length} items`, avatar: 'S' },
        { label: 'Security' },
        { label: `${state.securityCenter.findings.length} findings` },
        { label: 'Local SQLite' },
        { label: state.securityCenter.level, tone: severityTone(state.securityCenter.level) }
      ]
    });
  }

  if (state.securityCenter.exemptions.length > 0) {
    runtimeRows.push({
      id: 'security-exemptions',
      selected: runtimeRows.length === 0,
      cells: [
        { label: 'Security exemptions', detail: `${state.securityCenter.exemptions.length} active`, avatar: 'S' },
        { label: 'Security' },
        { label: 'Policy drift' },
        { label: 'Local SQLite' },
        { label: 'Review', tone: 'medium' }
      ]
    });
  }

  if (state.syncCenter.conflicts.length > 0) {
    runtimeRows.push({
      id: 'sync-conflicts',
      selected: runtimeRows.length === 0,
      cells: [
        { label: 'Sync conflicts', detail: `${state.syncCenter.conflicts.length} open`, avatar: 'C' },
        { label: 'Sync' },
        { label: 'Conflict' },
        { label: 'Local SQLite' },
        { label: 'Review', tone: 'medium' }
      ]
    });
  }

  return runtimeRows.slice(0, 4);
}

function createInstallPlanRows(state: DesktopWorkspaceState): TableRow[] {
  const plan = state.managementFlow.installPlan;
  const runtimeRows: TableRow[] = plan
    ? [
        {
          id: `runtime-plan-${plan.skillName}`,
          selected: true,
          cells: [
            { label: plan.skillName, detail: `${plan.writeCount} writes`, avatar: plan.skillName.slice(0, 1).toUpperCase() },
            { label: 'Codex' },
            { label: plan.targetRoot },
            { label: String(plan.writeCount) },
            { label: titleCase(plan.conflictState), tone: plan.conflictState === 'clean' ? 'low' : 'high' },
            { label: plan.conflictState === 'clean' ? 'Ready' : 'Blocked' }
          ]
        }
      ]
    : [];

  return runtimeRows.slice(0, 4);
}

function createReviewRows(state: DesktopWorkspaceState): TableRow[] {
  return state.reviewCenter.queue.map((item, index) => ({
    id: item.id,
    selected: index === 0,
    cells: [
      {
        label: item.title,
        detail: item.detail,
        avatar: (item.skillName ?? item.title).slice(0, 1).toUpperCase(),
        avatarTone: index === 0 ? 'dark' : 'default'
      },
      { label: item.reason },
      { label: item.source },
      { label: item.reviewer },
      { label: item.risk, tone: severityTone(item.risk) },
      { label: item.status }
    ]
  }));
}

function createSecurityRows(state: DesktopWorkspaceState): TableRow[] {
  const runtimeRows = state.securityCenter.queue.map<TableRow>((item, index) => ({
    id: `security-${item.skillName}-${item.status}`,
    selected: index === 0,
    cells: [
      { label: item.skillName, detail: state.securityCenter.level, avatar: item.skillName.slice(0, 1).toUpperCase(), avatarTone: 'dark' },
      { label: state.securityCenter.findings[index]?.ruleName ?? 'Stored scan result' },
      { label: 'runtime' },
      { label: titleCase(state.securityCenter.findings[index]?.severity ?? state.securityCenter.level), tone: severityTone(state.securityCenter.findings[index]?.severity ?? state.securityCenter.level) },
      { label: item.status.toLowerCase().includes('blocked') ? 'Blocked' : 'Allowed' }
    ]
  }));

  return runtimeRows.slice(0, 5);
}

function createSyncRows(state: DesktopWorkspaceState): KeyValueRow[] {
  if (state.syncCenter.profiles.length === 0) {
    return [{ label: 'Sync profiles', value: 'None enabled' }];
  }

  return state.syncCenter.profiles.map((profile) => ({
    label: displaySyncMode(profile.mode),
    value: profile.status
  }));
}

function createPluginRows(state: DesktopWorkspaceState): KeyValueRow[] {
  const directories = state.plugins.directories ?? [];
  const catalog = state.plugins.catalog ?? [];
  const rows: KeyValueRow[] = [
    { label: 'Plugin directories', value: String(directories.length) },
    { label: 'Catalog entries', value: String(catalog.length) }
  ];

  for (const directory of directories) {
    rows.push({ label: directory.rootPath, value: directory.status });
  }

  for (const entry of catalog) {
    rows.push({ label: entry.name, value: entry.signatureStatus });
  }

  if (state.plugins.plugins.length === 0) {
    return [...rows, { label: 'Installed plugins', value: '0' }];
  }

  return [
    ...rows,
    ...state.plugins.plugins.flatMap((plugin) => [
      { label: plugin.name, value: plugin.status },
      ...(plugin.signatureStatus ? [{ label: 'Signature', value: plugin.signatureStatus }] : []),
      ...plugin.capabilities.map((capability) => ({ label: capability, value: 'declared' })),
      ...plugin.permissions.map((permission) => ({ label: permission.name, value: permission.status })),
      ...plugin.errors.map((error) => ({ label: error.message, value: 'logged' }))
    ])
  ];
}

function createAgentRootViews(librarySkills: LibrarySkillSummary[]): AgentRootView[] {
  const rootsByAgentAndPath = new Map<string, { agent: string; path: string; count: number }>();

  for (const skill of librarySkills) {
    const rootPath = parentPath(skill.path);
    const key = `${skill.sourceAgent}:${rootPath}`;
    const current = rootsByAgentAndPath.get(key);
    rootsByAgentAndPath.set(key, {
      agent: skill.sourceAgent,
      path: rootPath,
      count: (current?.count ?? 0) + 1
    });
  }

  return Array.from(rootsByAgentAndPath.values()).map((root) => ({
    agent: root.agent,
    path: root.path,
    status: `${root.count} indexed`,
    tone: 'low'
  }));
}

function parentPath(filePath: string): string {
  const normalized = filePath.replace(/[/\\]+$/, '');
  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return separatorIndex > 0 ? normalized.slice(0, separatorIndex) : normalized;
}

function displaySyncMode(mode: string): string {
  if (mode === 'rest') {
    return 'REST';
  }

  return mode === 'mock-rest' ? 'REST contract' : mode;
}

function cloneKeyValueRows(rows: ReadonlyArray<KeyValueRow>): KeyValueRow[] {
  return rows.map((row) => ({ ...row }));
}

function countHighFindings(state: DesktopWorkspaceState): number {
  return state.securityCenter.findings.filter((finding) => ['high', 'critical'].includes(finding.severity.toLowerCase())).length;
}

function severityTone(severity: string): Tone {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'blocked') {
    return 'high';
  }
  if (normalized === 'medium' || normalized === 'warning' || normalized === 'warn') {
    return 'medium';
  }
  if (normalized === 'low' || normalized === 'safe') {
    return 'low';
  }
  return 'neutral';
}

function normalizeBars(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const max = Math.max(...values, 1);
  return values.map((value) => Math.max(36, Math.round((value / max) * 120)));
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

const pageLabels: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  library: 'Library',
  discover: 'Discover',
  installs: 'Installs',
  usage: 'Usage',
  reviews: 'Reviews',
  security: 'Security',
  settings: 'Settings'
};
