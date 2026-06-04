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
      plugins: []
    }
  };
}

export function createWorkspaceViewModel(state: DesktopWorkspaceState): WorkspaceViewModel {
  const installedCount = state.librarySkills.filter((skill) => skill.installStatus.toLowerCase() === 'installed').length;
  const blockedCount = state.securityCenter.queue.filter((item) => item.status.toLowerCase().includes('blocked')).length;
  const openFindings = state.securityCenter.findings.length;
  const runtimeReviewCount = state.reviewCenter.queue.filter((item) => item.status === 'Open').length;
  const reviewCount =
    openFindings + (state.reviewCenter.queue.length > 0 ? runtimeReviewCount : fixtureBacked.reviewQueue.filter((item) => item.status === 'Open').length);
  const agentRoots = cloneAgentRoots(fixtureBacked.agentRoots);
  const hasUsageState =
    state.usageCenter.dailyActivity.length > 0 ||
    state.usageCenter.topSkills.length > 0 ||
    state.usageCenter.agentSplit.length > 0 ||
    state.usageCenter.recent.length > 0 ||
    Object.values(state.usageCenter.totals).some((value) => value > 0);

  return {
    appInfo: state.appInfo,
    librarySkills: state.librarySkills,
    navItems: pageOrder.map((key) => ({
      key,
      label: pageLabels[key]
    })),
    databasePath: fixtureBacked.databasePath,
    lastScanLabel: fixtureBacked.lastScanLabel,
    dashboard: {
      metrics: [
        metric('Indexed skills', state.librarySkills.length, `${state.skills.length} imported skills`),
        metric('Installed projections', installedCount, `${agentRoots.length} agents detected`),
        metric('Needs review', reviewCount, `${openFindings} security findings`),
        metric('Blocked installs', blockedCount, 'policy enforced')
      ],
      activity: [
        ...state.managementFlow.importItems.map((item) => ({ label: item.label, value: item.status })),
        ...fixtureBacked.activity
      ].slice(0, 5),
      readinessRows: createReadinessRows(state),
      agentRoots,
      agentCoverageBars: [...fixtureBacked.agentCoverageBars]
    },
    discover: {
      sources: cloneSources(fixtureBacked.sources),
      sourceUpdates: cloneTableRows(fixtureBacked.sourceUpdates)
    },
    installs: {
      plans: createInstallPlanRows(state),
      resultStream: [
        ...(state.managementFlow.installResult
          ? [{ label: state.managementFlow.installResult.message, value: state.managementFlow.installResult.status }]
          : []),
        ...fixtureBacked.installResults
      ].slice(0, 4),
      exportPackages: cloneKeyValueRows(fixtureBacked.exportPackages)
    },
    usage: {
      metrics: hasUsageState
        ? [
            metric('Skill launches', state.usageCenter.totals.launches, 'local events only'),
            metric('Install actions', state.usageCenter.totals.installs, `${state.managementFlow.installPlan ? 1 : 0} active plan`),
            metric('Security scans', state.usageCenter.totals.scans, '100% stored locally'),
            metric('Exports', state.usageCenter.totals.exports, 'hash verified')
          ]
        : [
            metric('Skill launches', fixtureBacked.usageTotals.launches, 'local events only'),
            metric('Install actions', fixtureBacked.usageTotals.installs, `${state.managementFlow.installPlan ? 1 : 0} active plan`),
            metric('Security scans', Math.max(fixtureBacked.usageTotals.scans, state.securityCenter.history.length), '100% stored locally'),
            metric('Exports', fixtureBacked.usageTotals.exports, 'hash verified')
          ],
      dailyBars:
        state.usageCenter.dailyActivity.length > 0
          ? normalizeBars(state.usageCenter.dailyActivity.map((item) => item.count))
          : [...fixtureBacked.dailyBars],
      topSkills:
        state.usageCenter.topSkills.length > 0
          ? state.usageCenter.topSkills.map((item) => ({ label: item.skillName, value: String(item.count) }))
          : cloneKeyValueRows(fixtureBacked.topSkills),
      agentSplit:
        state.usageCenter.agentSplit.length > 0
          ? state.usageCenter.agentSplit.map((item) => ({ label: item.agent, value: `${item.count} events` }))
          : cloneKeyValueRows(fixtureBacked.agentSplit),
      recentUsage:
        state.usageCenter.recent.length > 0
          ? state.usageCenter.recent.map((item) => ({ label: item.label, value: item.value }))
          : cloneKeyValueRows(fixtureBacked.recentUsage)
    },
    reviews: {
      queue: createReviewRows(state),
      notes: state.reviewCenter.notes.length > 0 ? cloneKeyValueRows(state.reviewCenter.notes) : cloneKeyValueRows(fixtureBacked.reviewNotes),
      communitySignal: cloneKeyValueRows(fixtureBacked.communitySignal)
    },
    security: {
      metrics: [
        metric('Risk score', state.securityCenter.riskScore, `${state.securityCenter.level} posture`),
        metric('Open findings', openFindings, `${countHighFindings(state)} high`),
        metric('Active exemptions', state.securityCenter.exemptions.length, 'scoped only'),
        metric('Blocked installs', blockedCount, 'default policy')
      ],
      queue: createSecurityRows(state),
      ruleDetails: [
        ...state.securityCenter.findings.map((finding) => ({
          label: finding.ruleName,
          value: titleCase(finding.severity)
        })),
        ...fixtureBacked.ruleDetails
      ].slice(0, 5),
      exemptions:
        state.securityCenter.exemptions.length > 0
          ? state.securityCenter.exemptions.map((item) => ({ label: item.reason, value: item.scope }))
          : cloneKeyValueRows(fixtureBacked.exemptions)
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
            { label: fixtureBacked.databasePath },
            { label: 'Healthy', tone: 'low' }
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
      defaults: cloneKeyValueRows(fixtureBacked.defaults),
      syncPreview: [
        { label: 'Outbox', value: `${state.syncCenter.outbox.length} queued` },
        { label: 'Inbox', value: `${state.syncCenter.inbox.length} pending` },
        { label: 'Conflicts', value: `${state.syncCenter.conflicts.length} open` },
        { label: 'Drivers', value: '3 available' }
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
    installStatus: 'indexed'
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
  if (state.securityCenter.exemptions.length > 0) {
    runtimeRows.push({
      id: 'security-exemptions',
      selected: true,
      cells: [
        { label: 'Security exemptions', detail: `${state.securityCenter.exemptions.length} active`, avatar: 'S' },
        { label: 'Security' },
        { label: 'Policy drift' },
        { label: 'Local SQLite' },
        { label: 'Review', tone: 'medium' }
      ]
    });
  }

  return [...runtimeRows, ...cloneTableRows(fixtureBacked.readinessRows)].slice(0, 4);
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

  return [...runtimeRows, ...cloneTableRows(fixtureBacked.installPlans)].slice(0, 4);
}

function createReviewRows(state: DesktopWorkspaceState): TableRow[] {
  if (state.reviewCenter.queue.length > 0) {
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

  return fixtureBacked.reviewQueue.map((item, index) => ({
    id: item.name,
    selected: index === 0,
    cells: [
      { label: item.name, detail: item.detail, avatar: item.name.slice(0, 1).toUpperCase(), avatarTone: index === 0 ? 'dark' : 'default' },
      { label: item.reason },
      { label: item.source },
      { label: item.reviewer },
      { label: item.risk, tone: item.risk === 'High' ? 'high' : item.risk === 'Medium' ? 'medium' : 'low' },
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

  return [...runtimeRows, ...cloneTableRows(fixtureBacked.securityRows)].slice(0, 5);
}

function createSyncRows(state: DesktopWorkspaceState): KeyValueRow[] {
  if (state.syncCenter.profiles.length === 0) {
    return cloneKeyValueRows(fixtureBacked.syncRows);
  }

  return state.syncCenter.profiles.map((profile) => ({
    label: profile.mode,
    value: profile.status
  }));
}

function createPluginRows(state: DesktopWorkspaceState): KeyValueRow[] {
  if (state.plugins.plugins.length === 0) {
    return cloneKeyValueRows(fixtureBacked.pluginRows);
  }

  return state.plugins.plugins.flatMap((plugin) => [
    { label: plugin.name, value: plugin.status },
    ...plugin.capabilities.map((capability) => ({ label: capability, value: 'declared' })),
    ...plugin.permissions.map((permission) => ({ label: permission.name, value: permission.status })),
    ...plugin.errors.map((error) => ({ label: error.message, value: 'logged' }))
  ]);
}

function cloneAgentRoots(rows: ReadonlyArray<AgentRootView>): AgentRootView[] {
  return rows.map((row) => ({ ...row }));
}

function cloneKeyValueRows(rows: ReadonlyArray<KeyValueRow>): KeyValueRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneTableRows(
  rows: ReadonlyArray<{
    id: string;
    selected?: boolean;
    cells: ReadonlyArray<TableCell>;
  }>
): TableRow[] {
  return rows.map((row) => {
    const cloned: TableRow = {
      id: row.id,
      cells: row.cells.map((cell) => ({ ...cell }))
    };
    if (row.selected !== undefined) {
      cloned.selected = row.selected;
    }
    return cloned;
  });
}

function cloneSources(
  sources: ReadonlyArray<{
    name: string;
    sourcePath: string;
    description: string;
    risk: 'Low' | 'Medium';
    tags: readonly string[];
    selected?: boolean;
  }>
): SourceCard[] {
  return sources.map((source) => ({
    ...source,
    tags: [...source.tags]
  }));
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

// Fixture-backed values mirror docs/design/mockups and are isolated here so Goal 6/7 can replace them with SQLite state.
const fixtureBacked = {
  databasePath: 'local SQLite library.db',
  lastScanLabel: 'Last scan: local runtime',
  agentRoots: [
    { agent: 'Codex', path: '~/.codex/skills', status: 'OK', tone: 'low' },
    { agent: 'Claude', path: '~/.claude/skills', status: 'OK', tone: 'low' },
    { agent: 'Gemini', path: '~/.gemini/skills', status: 'OK', tone: 'low' },
    { agent: 'OpenCode', path: '~/.opencode/skills', status: 'Manual', tone: 'neutral' }
  ],
  activity: [
    { label: 'openai-docs installed to Codex and Claude', value: 'fixture' },
    { label: 'browser-control scan completed with warning', value: 'fixture' },
    { label: 'markdown-pro package exported for review', value: 'fixture' }
  ],
  agentCoverageBars: [74, 98, 51, 64, 112, 43, 84, 132, 70, 55, 92, 124, 48, 80, 102, 67, 118, 45],
  readinessRows: [
    {
      id: 'agent-root-scan',
      selected: true,
      cells: [
        { label: 'Agent root scan', detail: 'OpenCode root manual', avatar: 'A', avatarTone: 'blue' },
        { label: 'Adapters' },
        { label: 'Missing root' },
        { label: 'Local check' },
        { label: 'Low', tone: 'low' }
      ]
    },
    {
      id: 'plugin-permissions',
      cells: [
        { label: 'Plugin permissions', detail: 'manual grants', avatar: 'P', avatarTone: 'green' },
        { label: 'Plugins' },
        { label: 'Disabled by default' },
        { label: 'Local check' },
        { label: 'Queued', tone: 'neutral' }
      ]
    },
    {
      id: 'release-smoke',
      cells: [
        { label: 'Release smoke', detail: 'Latest package verified', avatar: 'R' },
        { label: 'Release' },
        { label: 'Healthy' },
        { label: 'Local check' },
        { label: 'Ready', tone: 'low' }
      ]
    }
  ] satisfies TableRow[],
  sources: [
    {
      name: 'openai-docs',
      sourcePath: 'skills.sh/openai-docs',
      description: 'Search and summarize OpenAI API references.',
      risk: 'Low',
      tags: ['verified', 'docs'],
      selected: true
    },
    {
      name: 'gh-fix-ci',
      sourcePath: 'skills.sh/gh-fix-ci',
      description: 'Diagnose and explain failing GitHub Actions checks.',
      risk: 'Low',
      tags: ['verified', 'github']
    },
    {
      name: 'spreadsheet-auditor',
      sourcePath: 'skills.sh/spreadsheet-auditor',
      description: 'Audit spreadsheet formulas and data consistency.',
      risk: 'Medium',
      tags: ['verified', 'excel']
    },
    {
      name: 'browser-control',
      sourcePath: 'skills.sh/browser-control',
      description: 'Control browsers and extract UI evidence safely.',
      risk: 'Low',
      tags: ['verified', 'browser']
    },
    {
      name: 'skill-creator',
      sourcePath: 'skills.sh/skill-creator',
      description: 'Create durable Codex skills with valid structure.',
      risk: 'Low',
      tags: ['verified', 'codex']
    },
    {
      name: 'release-packager',
      sourcePath: 'skills.sh/release-packager',
      description: 'Package desktop releases with checksums.',
      risk: 'Low',
      tags: ['verified', 'release']
    }
  ],
  sourceUpdates: [
    {
      id: 'skills-sh',
      selected: true,
      cells: [
        { label: 'skills.sh official' },
        { label: 'Verified signature' },
        { label: '12' },
        { label: 'Offline cache' },
        { label: 'Ready', tone: 'low' }
      ]
    },
    {
      id: 'github-curated',
      cells: [
        { label: 'GitHub curated' },
        { label: 'Maintainer allowlist' },
        { label: '8' },
        { label: 'Offline cache' },
        { label: 'Review', tone: 'medium' }
      ]
    },
    {
      id: 'local-packages',
      cells: [
        { label: 'Local packages' },
        { label: 'User supplied' },
        { label: '5' },
        { label: 'Local only' },
        { label: 'Cached', tone: 'neutral' }
      ]
    }
  ] satisfies TableRow[],
  installPlans: [
    {
      id: 'sui-move-contract',
      selected: true,
      cells: [
        { label: 'sui-move-contract', detail: 'v1.4.2', avatar: 'S' },
        { label: 'Codex' },
        { label: '~/.codex/skills' },
        { label: '24' },
        { label: 'Clean', tone: 'low' },
        { label: 'Ready' }
      ]
    },
    {
      id: 'gh-fix-ci',
      cells: [
        { label: 'gh-fix-ci', detail: 'v1.2.1', avatar: 'G', avatarTone: 'dark' },
        { label: 'Claude' },
        { label: '~/.claude/skills' },
        { label: '18' },
        { label: 'Exists', tone: 'high' },
        { label: 'Blocked' }
      ]
    },
    {
      id: 'browser-control',
      cells: [
        { label: 'browser-control', detail: 'v0.9.3', avatar: 'B', avatarTone: 'blue' },
        { label: 'OpenCode' },
        { label: '~/.opencode/skills' },
        { label: '31' },
        { label: 'Warn', tone: 'medium' },
        { label: 'Review' }
      ]
    }
  ] satisfies TableRow[],
  installResults: [
    { label: 'openai-docs copied to Codex', value: 'installed' },
    { label: 'terraform-helper rollback applied', value: 'verified' },
    { label: 'markdown-pro uninstall skipped unknown file', value: 'safe' },
    { label: 'browser-control plan blocked on warning', value: 'review' }
  ],
  exportPackages: [
    { label: 'security-baseline.zip', value: '42 files' },
    { label: 'docs-tools.zip', value: '19 files' },
    { label: 'devops-pack.zip', value: '57 files' },
    { label: 'browser-safe-pack.zip', value: '23 files' }
  ],
  usageTotals: {
    launches: 1482,
    installs: 86,
    scans: 214,
    exports: 31
  },
  dailyBars: [76, 60, 92, 48, 82, 115, 66, 101, 54, 132, 80, 72, 118, 40, 86, 124, 55, 90, 111, 68, 134, 58, 76, 96, 43, 84, 127, 62, 108, 142],
  topSkills: [
    { label: 'sui-move-contract', value: '312' },
    { label: 'openai-docs', value: '241' },
    { label: 'browser-control', value: '188' },
    { label: 'gh-fix-ci', value: '173' }
  ],
  agentSplit: [
    { label: 'Codex', value: '44%' },
    { label: 'Claude', value: '29%' },
    { label: 'Gemini', value: '17%' },
    { label: 'OpenCode', value: '10%' }
  ],
  recentUsage: [
    { label: 'Codex ran openai-docs', value: '9:41 AM' },
    { label: 'Claude used gh-fix-ci', value: '8:12 AM' },
    { label: 'Export package created', value: 'Yesterday' },
    { label: 'Security rescan completed', value: 'Yesterday' }
  ],
  reviewQueue: [
    {
      name: 'gh-fix-ci update',
      detail: 'v1.2.0 -> v1.2.1',
      reason: 'Executable script added',
      source: 'GitHub',
      reviewer: 'alice.dev',
      risk: 'High',
      status: 'Open'
    },
    {
      name: 'browser-control import',
      detail: 'New local package',
      reason: 'Network capability',
      source: 'Local ZIP',
      reviewer: 'web3-builder',
      risk: 'Medium',
      status: 'Open'
    },
    {
      name: 'spreadsheet-auditor',
      detail: 'Rule warning',
      reason: 'Large fixture file',
      source: 'skills.sh',
      reviewer: 'move-enthusiast',
      risk: 'Medium',
      status: 'Open'
    },
    {
      name: 'openai-docs',
      detail: 'Source refresh',
      reason: 'Docs changed',
      source: 'skills.sh',
      reviewer: 'alice.dev',
      risk: 'Low',
      status: 'Approved'
    }
  ],
  reviewNotes: [
    { label: 'Explain why shell script is required.', value: 'open' },
    { label: 'Confirm no token content is exported.', value: 'open' },
    { label: 'Attach hash diff for changed files.', value: 'done' }
  ],
  communitySignal: [
    { label: 'Average rating', value: '4.6 / 5' },
    { label: 'Recent reviews', value: '48' },
    { label: 'Maintainer response', value: '1 day' }
  ],
  securityRows: [
    {
      id: 'gh-fix-ci-security',
      selected: true,
      cells: [
        { label: 'gh-fix-ci', detail: 'v1.2.1', avatar: 'G', avatarTone: 'dark' },
        { label: 'Executable script' },
        { label: 'runtime' },
        { label: 'High', tone: 'high' },
        { label: 'Blocked' }
      ]
    },
    {
      id: 'browser-control-security',
      cells: [
        { label: 'browser-control', detail: 'v0.9.3', avatar: 'B' },
        { label: 'External transfer' },
        { label: 'network' },
        { label: 'Medium', tone: 'medium' },
        { label: 'Warn' }
      ]
    },
    {
      id: 'linux-hardening-security',
      cells: [
        { label: 'linux-hardening', detail: 'v1.1.0', avatar: 'L', avatarTone: 'green' },
        { label: 'Sensitive path' },
        { label: 'filesystem' },
        { label: 'High', tone: 'high' },
        { label: 'Blocked' }
      ]
    }
  ] satisfies TableRow[],
  ruleDetails: [
    { label: 'Dangerous shell command', value: 'High' },
    { label: 'External data transfer', value: 'Medium' },
    { label: 'Path traversal reference', value: 'High' }
  ],
  exemptions: [
    { label: 'browser-control network check', value: 'project' },
    { label: 'terraform-helper script fixture', value: 'user' },
    { label: 'expired exemptions', value: '0' }
  ],
  syncRows: [
    { label: 'No enabled sync profile', value: 'default' },
    { label: 'Shared-folder driver', value: 'available' },
    { label: 'Git package driver', value: 'available' },
    { label: 'Conflict center', value: 'ready' }
  ],
  pluginRows: [
    { label: 'Manifest validation', value: 'required' },
    { label: 'Permissions', value: 'manual grant' },
    { label: 'Network access', value: 'denied' },
    { label: 'Host API escape scan', value: 'enabled' }
  ],
  defaults: [
    { label: 'Node integration', value: 'Off' },
    { label: 'Context isolation', value: 'On' },
    { label: 'Sync profile', value: 'None' },
    { label: 'Telemetry', value: 'None' },
    { label: 'Plugin grants', value: 'Manual' }
  ]
} as const;
