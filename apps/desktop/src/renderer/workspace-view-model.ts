import { appInfo } from '@theopenhub/shared';
import type {
  DesktopWorkspaceState,
  DiscoverSkillPreview,
  InstallPlan,
  InstallTarget,
  LibraryScanResult,
  LibrarySkillSummary,
  SkillDetail
} from '@theopenhub/shared';

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

export interface ProvenanceChip {
  label: string;
  tone: Tone;
}

export interface ActionStep {
  label: string;
  description: string;
  status: 'current' | 'done' | 'pending' | 'blocked';
  provenance: string;
  targetPage: PageKey;
}

export interface EmptyStateModel {
  title: string;
  text: string;
  actionLabel: string;
  provenance: string;
}

export interface TrustImpactModel {
  title: string;
  subtitle: string;
  provenanceChips: ProvenanceChip[];
  rows: KeyValueRow[];
  nextAction: string;
}

export interface CompatibilityRow {
  agent: string;
  root: string;
  scope: string;
  status: 'visible' | 'compatible' | 'incompatible' | 'manual' | 'not checked';
  detail: string;
  tone: Tone;
}

export interface DiagnosticItem {
  title: string;
  detail: string;
  action: string;
  tone: Tone;
}

export interface WorkspaceUxModel {
  actionSteps: ActionStep[];
  compatibilityRows: CompatibilityRow[];
  diagnostics: DiagnosticItem[];
  emptyStates: Record<PageKey, EmptyStateModel>;
  provenanceChips: ProvenanceChip[];
  trustImpact: TrustImpactModel;
}

export interface WorkspaceUxModelInput {
  activeInstallPlan: InstallPlan | null;
  activePage: PageKey;
  discoverPreviewSkills: DiscoverSkillPreview[];
  installTargets: InstallTarget[];
  selectedSkillDetail: SkillDetail | null;
  state: DesktopWorkspaceState;
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

export function createWorkspaceUxModel(input: WorkspaceUxModelInput): WorkspaceUxModel {
  const provenanceChips = createProvenanceChips(input.state);
  const compatibilityRows = createCompatibilityRows(input.selectedSkillDetail, input.installTargets);

  return {
    actionSteps: createActionSteps(input),
    compatibilityRows,
    diagnostics: createDiagnostics(input, compatibilityRows),
    emptyStates: createEmptyStates(),
    provenanceChips,
    trustImpact: createTrustImpact(input, provenanceChips)
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

function createActionSteps(input: WorkspaceUxModelInput): ActionStep[] {
  const hasRoots = input.installTargets.length > 0 || input.state.librarySkills.length > 0;
  const hasScan = input.state.librarySkills.length > 0 || input.state.managementFlow.importItems.length > 0;
  const hasPreview = input.discoverPreviewSkills.length > 0;
  const hasTrustReview =
    input.state.securityCenter.findings.length > 0 ||
    input.state.securityCenter.queue.length > 0 ||
    Boolean(input.selectedSkillDetail?.latestScan);
  const hasInstallPlan = Boolean(input.activeInstallPlan || input.state.managementFlow.installPlan);

  const rawSteps: Array<Omit<ActionStep, 'status'>> = [
    {
      label: 'Detect agent roots',
      description: 'Find Codex, Claude, Gemini, OpenCode, and Agents skill roots on this machine.',
      provenance: hasRoots ? 'runtime' : 'not scanned',
      targetPage: 'settings'
    },
    {
      label: 'Run local scan',
      description: 'Index installed projections into local SQLite before planning changes.',
      provenance: hasScan ? 'SQLite' : 'not scanned',
      targetPage: 'dashboard'
    },
    {
      label: 'Preview a source',
      description: 'Add a local folder or Git URL and inspect candidates before import.',
      provenance: hasPreview ? 'source preview' : 'network off',
      targetPage: 'discover'
    },
    {
      label: 'Review trust',
      description: 'Read scan findings, source provenance, and review queue state.',
      provenance: hasTrustReview ? 'SQLite' : 'not scanned',
      targetPage: 'security'
    },
    {
      label: 'Create install plan',
      description: 'Review exact writes and conflicts before any agent-root change.',
      provenance: hasInstallPlan ? 'runtime' : 'not planned',
      targetPage: 'installs'
    }
  ];
  const done = [hasRoots, hasScan, hasPreview, hasTrustReview, hasInstallPlan];
  const currentIndex = Math.max(0, done.findIndex((value) => !value));

  return rawSteps.map((step, index) => ({
    ...step,
    status: done[index] ? 'done' : index === currentIndex ? 'current' : 'pending'
  }));
}

function createEmptyStates(): Record<PageKey, EmptyStateModel> {
  return {
    dashboard: {
      title: 'No local scan yet',
      text: 'Run a local scan to populate health, agent coverage, and readiness evidence.',
      actionLabel: 'Run local scan',
      provenance: 'not scanned'
    },
    library: {
      title: 'No skills indexed',
      text: 'Scan agent roots or import a local skill before creating install plans.',
      actionLabel: 'Scan or import',
      provenance: 'SQLite'
    },
    discover: {
      title: 'No sources previewed',
      text: 'Add a local folder or Git URL to preview candidates. No files are written during preview.',
      actionLabel: 'Add local or Git source',
      provenance: 'source preview'
    },
    installs: {
      title: 'No install plan visible',
      text: 'Select a skill and create a plan before applying changes to any agent root.',
      actionLabel: 'Create install plan',
      provenance: 'not planned'
    },
    usage: {
      title: 'No local usage events',
      text: 'Usage appears only after local scans, imports, installs, exports, or security actions.',
      actionLabel: 'Run a local action',
      provenance: 'SQLite'
    },
    reviews: {
      title: 'No review items',
      text: 'Security findings, install conflicts, and changed versions create review items when they exist.',
      actionLabel: 'Review security',
      provenance: 'SQLite'
    },
    security: {
      title: 'No security scan yet',
      text: 'Import or select a skill, then run a local scan to create policy evidence.',
      actionLabel: 'Run security scan',
      provenance: 'not scanned'
    },
    settings: {
      title: 'No manual setting selected',
      text: 'Local-first defaults are active until you opt into sync, plugins, or project roots.',
      actionLabel: 'Review defaults',
      provenance: 'runtime'
    }
  };
}

function createProvenanceChips(state: DesktopWorkspaceState): ProvenanceChip[] {
  const chips: ProvenanceChip[] = [
    { label: 'SQLite', tone: 'blue' },
    { label: 'network off', tone: 'neutral' },
    { label: state.syncCenter.profiles.length > 0 ? 'sync configured' : 'sync disabled', tone: 'neutral' }
  ];

  if (state.librarySkills.length === 0 && state.managementFlow.importItems.length === 0) {
    chips.push({ label: 'not scanned', tone: 'medium' });
  } else {
    chips.push({ label: 'runtime', tone: 'green' });
  }

  return chips;
}

function createTrustImpact(input: WorkspaceUxModelInput, provenanceChips: ProvenanceChip[]): TrustImpactModel {
  const selectedSkill = input.selectedSkillDetail;
  const firstPreview = input.discoverPreviewSkills[0];
  const activePlan = input.activeInstallPlan;

  if (activePlan) {
    return {
      title: activePlan.skillName,
      subtitle: 'Install transaction',
      provenanceChips: [{ label: 'runtime', tone: 'green' }, { label: activePlan.conflictState, tone: activePlan.conflictState === 'clean' ? 'green' : 'red' }],
      rows: [
        { label: 'Target agent', value: activePlan.agentDisplayName },
        { label: 'Target root', value: activePlan.targetRoot },
        { label: 'Writes planned', value: String(activePlan.writes.length) },
        { label: 'Conflict', value: titleCase(activePlan.conflictState) },
        { label: 'Projection', value: activePlan.projectionMode }
      ],
      nextAction: activePlan.conflictState === 'clean' ? 'Apply only after reviewing writes' : 'Resolve conflicts before applying'
    };
  }

  if (selectedSkill) {
    const securityValue = selectedSkill.latestScan?.blocked
      ? 'blocked'
      : selectedSkill.latestScan?.level ?? selectedSkill.riskStatus;
    return {
      title: selectedSkill.skill.name,
      subtitle: 'Skill trust and impact',
      provenanceChips: [
        { label: selectedSkill.source.type, tone: 'blue' },
        { label: selectedSkill.source.trustLevel, tone: selectedSkill.source.trustLevel === 'verified' ? 'green' : 'medium' },
        { label: selectedSkill.latestScan ? 'scanned' : 'not scanned', tone: selectedSkill.latestScan ? 'green' : 'medium' }
      ],
      rows: [
        { label: 'Source', value: selectedSkill.source.url ?? selectedSkill.source.type },
        { label: 'Security', value: securityValue },
        { label: 'Files', value: String(selectedSkill.files.length) },
        { label: 'Versions', value: String(selectedSkill.versions.length) },
        { label: 'Installed', value: selectedSkill.installations.length > 0 ? `${selectedSkill.installations.length} roots` : 'not installed' }
      ],
      nextAction: selectedSkill.latestScan?.blocked ? 'Open Security or Reviews before applying' : 'Create an install plan before writing files'
    };
  }

  if (firstPreview) {
    return {
      title: firstPreview.name,
      subtitle: 'Source preview candidate',
      provenanceChips: [{ label: 'source preview', tone: 'blue' }, { label: 'writes false', tone: 'green' }],
      rows: [
        { label: 'Risk', value: firstPreview.riskStatus },
        { label: 'Path', value: firstPreview.path },
        { label: 'Warnings', value: String(firstPreview.warnings?.length ?? 0) },
        { label: 'Writes planned', value: 'false' }
      ],
      nextAction: 'Review candidates before import'
    };
  }

  return {
    title: 'Workspace evidence',
    subtitle: 'No object selected',
    provenanceChips,
    rows: [
      { label: 'Indexed skills', value: String(input.state.librarySkills.length) },
      { label: 'Security findings', value: String(input.state.securityCenter.findings.length) },
      { label: 'Open reviews', value: String(input.state.reviewCenter.queue.length) },
      { label: 'Install plan', value: input.state.managementFlow.installPlan ? 'visible' : 'not planned' }
    ],
    nextAction: 'Use Start here to create local evidence'
  };
}

function createCompatibilityRows(detail: SkillDetail | null, installTargets: InstallTarget[]): CompatibilityRow[] {
  const installationByAgent = new Map((detail?.installations ?? []).map((installation) => [installation.agent.toLowerCase(), installation]));
  const targets =
    installTargets.length > 0
      ? installTargets
      : [
          {
            adapterVersion: 'builtin',
            agentCode: 'codex',
            agentDisplayName: 'Codex',
            rootPath: 'not detected',
            scope: 'user',
            writable: false,
            isDefault: false
          },
          {
            adapterVersion: 'builtin',
            agentCode: 'claude',
            agentDisplayName: 'Claude',
            rootPath: 'not detected',
            scope: 'user',
            writable: false,
            isDefault: false
          },
          {
            adapterVersion: 'builtin',
            agentCode: 'gemini',
            agentDisplayName: 'Gemini',
            rootPath: 'not detected',
            scope: 'user',
            writable: false,
            isDefault: false
          },
          {
            adapterVersion: 'builtin',
            agentCode: 'opencode',
            agentDisplayName: 'OpenCode',
            rootPath: 'not detected',
            scope: 'user',
            writable: false,
            isDefault: false
          },
          {
            adapterVersion: 'builtin',
            agentCode: 'agents',
            agentDisplayName: 'Agents',
            rootPath: 'not detected',
            scope: 'user',
            writable: false,
            isDefault: false
          }
        ];

  return targets.map((target) => {
    const installation = installationByAgent.get(target.agentDisplayName.toLowerCase()) ?? installationByAgent.get(target.agentCode.toLowerCase());
    if (installation) {
      return {
        agent: target.agentDisplayName,
        root: target.rootPath,
        scope: target.scope,
        status: 'visible',
        detail: `installed v${installation.versionNo}`,
        tone: 'green'
      };
    }

    return {
      agent: target.agentDisplayName,
      root: target.rootPath,
      scope: target.scope,
      status: target.rootPath === 'not detected' ? 'manual' : 'not checked',
      detail: target.rootPath === 'not detected' ? 'root not detected' : 'run compatibility check before apply',
      tone: target.rootPath === 'not detected' ? 'medium' : 'neutral'
    };
  });
}

function createDiagnostics(input: WorkspaceUxModelInput, compatibilityRows: CompatibilityRow[]): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const blocked = input.state.securityCenter.queue.find((item) => item.status.toLowerCase().includes('blocked'));
  if (blocked || input.selectedSkillDetail?.latestScan?.blocked) {
    diagnostics.push({
      title: 'Blocked install',
      detail: blocked ? `${blocked.skillName} is blocked by policy.` : `${input.selectedSkillDetail?.skill.name ?? 'Selected skill'} is blocked by policy.`,
      action: 'Open Security or Reviews before applying',
      tone: 'red'
    });
  }

  if (input.state.reviewCenter.queue.some((item) => item.status.toLowerCase() === 'open')) {
    diagnostics.push({
      title: 'Governance review open',
      detail: `${input.state.reviewCenter.queue.filter((item) => item.status.toLowerCase() === 'open').length} review item needs an explicit decision.`,
      action: 'Resolve review without applying installs',
      tone: 'medium'
    });
  }

  if (input.discoverPreviewSkills.length > 0) {
    diagnostics.push({
      title: 'Source preview ready',
      detail: `${input.discoverPreviewSkills.length} candidate skill${input.discoverPreviewSkills.length === 1 ? '' : 's'} can be inspected before import.`,
      action: 'Review candidates before import',
      tone: 'blue'
    });
  }

  if (compatibilityRows.some((row) => row.status === 'manual')) {
    diagnostics.push({
      title: 'Manual root required',
      detail: 'One or more agents do not have detected skill roots yet.',
      action: 'Open Settings and add roots manually',
      tone: 'medium'
    });
  }

  if (input.state.syncCenter.conflicts.length > 0) {
    diagnostics.push({
      title: 'Sync conflict',
      detail: `${input.state.syncCenter.conflicts.length} local conflict${input.state.syncCenter.conflicts.length === 1 ? '' : 's'} need resolution.`,
      action: 'Open Settings sync conflict center',
      tone: 'red'
    });
  }

  const disabledPlugin = input.state.plugins.plugins.find((plugin) => plugin.status.toLowerCase().includes('disabled'));
  if (disabledPlugin) {
    diagnostics.push({
      title: 'Plugin disabled',
      detail: `${disabledPlugin.name} is installed but not enabled.`,
      action: 'Authorize permissions before enabling',
      tone: 'medium'
    });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      title: 'Local workflow ready',
      detail: 'No blocked installs, open reviews, or sync conflicts are currently visible.',
      action: 'Use Start here for the next local action',
      tone: 'green'
    });
  }

  return diagnostics;
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
