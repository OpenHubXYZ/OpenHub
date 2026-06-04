import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  BarChart3,
  BookOpen,
  Box,
  ChevronDown,
  Database,
  Download,
  Ellipsis,
  FilePlus2,
  HelpCircle,
  LayoutDashboard,
  PackagePlus,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Star
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  DesktopWorkspaceState,
  InstallPlan,
  LibrarySkillSummary,
  PluginsState,
  ReviewCenterState,
  SecurityCenterState,
  SkillSummary,
  SyncCenterState,
  UsageCenterState
} from '@theopenhub/shared';

import {
  createEmptyWorkspaceState,
  createWorkspaceViewModel,
  mergeScanIntoWorkspaceState,
  type AgentRootView,
  type KeyValueRow,
  type MetricCard,
  type PageKey,
  type PanelModel,
  type SourceCard,
  type TableCell,
  type TableColumn,
  type TableRow,
  type Tone
} from './workspace-view-model';
import './app.css';

export interface AppProps {
  initialLibrarySkills?: LibrarySkillSummary[];
  initialSkills?: SkillSummary[];
  initialManagementFlow?: ManagementFlowState | null;
  initialSecurityCenter?: SecurityCenterState | null;
  initialUsageCenter?: UsageCenterState | null;
  initialReviewCenter?: ReviewCenterState | null;
  initialGovernance?: GovernanceState | null;
  initialSyncCenter?: SyncCenterState | null;
  initialPlugins?: PluginsState | null;
}

export type ManagementFlowState = DesktopWorkspaceState['managementFlow'];
export type GovernanceState = DesktopWorkspaceState['governance'];

const navIconByPage: Record<PageKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  library: BookOpen,
  discover: Search,
  installs: PackagePlus,
  usage: BarChart3,
  reviews: Star,
  security: ShieldCheck,
  settings: Settings
};

const pageTabs: Record<PageKey, string[]> = {
  dashboard: ['Overview', 'Agent roots', 'Activity', 'Readiness'],
  library: ['Indexed skills', 'Imports', 'Governance', 'Collections'],
  discover: ['Featured', 'Trending', 'Verified sources', 'New', 'Collections'],
  installs: ['Install plans', 'Installed', 'Conflicts', 'Exports', 'Uninstalls'],
  usage: ['30 days', 'Agents', 'Skills', 'Sources', 'Exports'],
  reviews: ['Needs review', 'My queue', 'Approved', 'Rejected', 'Community'],
  security: ['Overview', 'Scan queue', 'Rules', 'Exemptions', 'History'],
  settings: ['Agent roots', 'Database', 'Sync', 'Plugins', 'Privacy']
};

const filterSets: Partial<Record<PageKey, Array<{ label: string; value: string }>>> = {
  discover: [
    { label: 'Source', value: 'All' },
    { label: 'Agent', value: 'All' },
    { label: 'Category', value: 'All' },
    { label: 'Risk', value: 'Low + Medium' }
  ],
  installs: [
    { label: 'Agent', value: 'Codex' },
    { label: 'Scope', value: 'User' },
    { label: 'Conflict', value: 'All' },
    { label: 'Status', value: 'Needs action' }
  ],
  reviews: [
    { label: 'Risk', value: 'All' },
    { label: 'Reviewer', value: 'All' },
    { label: 'Source', value: 'All' },
    { label: 'Age', value: 'Newest' }
  ]
};

export function App({
  initialLibrarySkills = [],
  initialSkills = [],
  initialManagementFlow = null,
  initialSecurityCenter = null,
  initialUsageCenter = null,
  initialReviewCenter = null,
  initialGovernance = null,
  initialSyncCenter = null,
  initialPlugins = null
}: AppProps): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<DesktopWorkspaceState>(() =>
    initialWorkspaceState({
      initialLibrarySkills,
      initialSkills,
      initialManagementFlow,
      initialSecurityCenter,
      initialUsageCenter,
      initialReviewCenter,
      initialGovernance,
      initialSyncCenter,
      initialPlugins
    })
  );
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [importPath, setImportPath] = useState('');
  const [installTargetRoot, setInstallTargetRoot] = useState('');
  const [activeInstallPlan, setActiveInstallPlan] = useState<InstallPlan | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const viewModel = useMemo(() => createWorkspaceViewModel(workspaceState), [workspaceState]);

  const applyWorkspaceState = useCallback((state: DesktopWorkspaceState) => {
    setWorkspaceState(state);
  }, []);

  useEffect(() => {
    if (window.theOpenHub?.getWorkspaceState) {
      void window.theOpenHub.getWorkspaceState().then(applyWorkspaceState);
      return;
    }

    if (initialLibrarySkills.length > 0 || !window.theOpenHub?.listLibrarySkills) {
      return;
    }

    void window.theOpenHub.listLibrarySkills().then((librarySkills) => {
      setWorkspaceState((current) => ({ ...current, librarySkills }));
    });
  }, [applyWorkspaceState, initialLibrarySkills.length]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  async function handleImportLocalFolder(): Promise<void> {
    if (!window.theOpenHub?.importLocalFolder || importPath.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importLocalFolder(importPath.trim());
    setWorkspaceState((current) => ({
      ...current,
      skills: [imported.skill, ...current.skills.filter((skill) => skill.id !== imported.skill.id)],
      managementFlow: {
        ...current.managementFlow,
        importItems: [{ label: imported.skill.name, status: 'imported' }, ...current.managementFlow.importItems].slice(
          0,
          8
        )
      }
    }));
  }

  async function handleScanAgentRoots(): Promise<void> {
    if (!window.theOpenHub?.scanAgentRoots) {
      return;
    }

    const scan = await window.theOpenHub.scanAgentRoots();
    const refreshed = window.theOpenHub.getWorkspaceState ? await window.theOpenHub.getWorkspaceState() : null;
    setWorkspaceState((current) => mergeScanIntoWorkspaceState(refreshed ?? current, scan));
  }

  async function handleCreateInstallPlan(): Promise<void> {
    const skill = workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.createInstallPlan || installTargetRoot.trim().length === 0) {
      return;
    }

    const plan = await window.theOpenHub.createInstallPlan({
      skillId: skill.id,
      targetRoot: installTargetRoot.trim(),
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'user'
    });
    setActiveInstallPlan(plan);
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        installPlan: {
          skillName: plan.skillName,
          targetRoot: plan.targetRoot,
          conflictState: plan.conflictState,
          writeCount: plan.writes.length
        }
      }
    }));
  }

  async function handleApplyInstallPlan(): Promise<void> {
    if (!activeInstallPlan || !window.theOpenHub?.applyInstallPlan) {
      return;
    }

    const result = await window.theOpenHub.applyInstallPlan(activeInstallPlan);
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        installResult: {
          status: result.status,
          message: `Installed ${activeInstallPlan.writes.length} files by copy projection.`
        }
      }
    }));
  }

  async function handleSecurityScan(): Promise<void> {
    const skill = workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.scanSkill) {
      return;
    }

    const scan = await window.theOpenHub.scanSkill(skill.id);
    setWorkspaceState((current) => ({
      ...current,
      securityCenter: {
        ...current.securityCenter,
        queue: [{ skillName: skill.name, status: scan.blocked ? 'blocked' : 'passed' }, ...current.securityCenter.queue],
        riskScore: scan.score,
        level: scan.level,
        findings: scan.findings.map((finding) => ({
          ruleName: finding.ruleName,
          severity: finding.severity
        })),
        history: [{ skillName: skill.name, level: scan.level }, ...current.securityCenter.history]
      }
    }));
  }

  const pageLabel = viewModel.navItems.find((item) => item.key === activePage)?.label ?? 'Dashboard';

  return (
    <main className="screen">
      <Sidebar activePage={activePage} navItems={viewModel.navItems} onNavigate={setActivePage} />
      <section className="app-frame" aria-label="TheOpenHub workspace">
        <Topbar searchRef={searchRef} />
        <section className="content">
          <div className="workbench">
            <section className="main-pane" aria-label={`${pageLabel} workspace`}>
              <Tabs activePage={activePage} />
              <Filters activePage={activePage} />
              <div className="main-pad">
                <PageContent
                  activePage={activePage}
                  activeInstallPlan={activeInstallPlan}
                  hasImportBridge={Boolean(window.theOpenHub?.importLocalFolder)}
                  hasInstallBridge={Boolean(window.theOpenHub?.createInstallPlan)}
                  hasScanBridge={Boolean(window.theOpenHub?.scanAgentRoots)}
                  hasSecurityBridge={Boolean(window.theOpenHub?.scanSkill)}
                  importPath={importPath}
                  installTargetRoot={installTargetRoot}
                  onApplyInstallPlan={() => {
                    void handleApplyInstallPlan();
                  }}
                  onCreateInstallPlan={() => {
                    void handleCreateInstallPlan();
                  }}
                  onImportLocalFolder={() => {
                    void handleImportLocalFolder();
                  }}
                  onImportPathChange={setImportPath}
                  onInstallTargetRootChange={setInstallTargetRoot}
                  onScanAgentRoots={() => {
                    void handleScanAgentRoots();
                  }}
                  onSecurityScan={() => {
                    void handleSecurityScan();
                  }}
                  viewModel={viewModel}
                  workspaceState={workspaceState}
                />
              </div>
            </section>
            <RightRail activePage={activePage} viewModel={viewModel} />
          </div>
        </section>
        <Statusbar databasePath={viewModel.databasePath} lastScanLabel={viewModel.lastScanLabel} />
      </section>
    </main>
  );
}

function initialWorkspaceState({
  initialLibrarySkills,
  initialSkills,
  initialManagementFlow,
  initialSecurityCenter,
  initialUsageCenter,
  initialReviewCenter,
  initialGovernance,
  initialSyncCenter,
  initialPlugins
}: Required<AppProps>): DesktopWorkspaceState {
  const empty = createEmptyWorkspaceState();
  return {
    ...empty,
    librarySkills: initialLibrarySkills,
    skills: initialSkills,
    managementFlow: initialManagementFlow ?? empty.managementFlow,
    securityCenter: initialSecurityCenter ?? empty.securityCenter,
    usageCenter: initialUsageCenter ?? empty.usageCenter,
    reviewCenter: initialReviewCenter ?? empty.reviewCenter,
    governance: initialGovernance ?? empty.governance,
    syncCenter: initialSyncCenter ?? empty.syncCenter,
    plugins: initialPlugins ?? empty.plugins
  };
}

function Sidebar({
  activePage,
  navItems,
  onNavigate
}: {
  activePage: PageKey;
  navItems: Array<{ key: PageKey; label: string }>;
  onNavigate: (page: PageKey) => void;
}): ReactElement {
  return (
    <aside className="sidebar" aria-label="Product">
      <div className="brand">
        <div className="brand-cube" aria-hidden="true" />
        <div>
          <div className="brand-title">
            TheOpenHub <span className="version-pill">v0.9.0</span>
          </div>
          <div className="brand-subtitle">Skills Studio</div>
        </div>
      </div>
      <nav className="nav" aria-label="Primary pages">
        {navItems.map((item) => {
          const Icon = navIconByPage[item.key];
          return (
            <button
              aria-current={activePage === item.key ? 'page' : undefined}
              className={`nav-item ${activePage === item.key ? 'active' : ''}`}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <Icon aria-hidden="true" className="nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <button className="foot-line" type="button">
          <PanelLeftClose aria-hidden="true" className="small-icon" />
          Collapse
        </button>
        <button className="foot-line" type="button">
          <HelpCircle aria-hidden="true" className="small-icon" />
          Help
        </button>
      </div>
    </aside>
  );
}

function Topbar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }): ReactElement {
  return (
    <header className="topbar">
      <label className="search">
        <Search aria-hidden="true" className="small-icon" />
        <input
          aria-label="Search local skills, sources, reviews"
          id="workspace-search"
          name="workspace-search"
          placeholder="Search local skills, sources, reviews..."
          ref={searchRef}
          type="search"
        />
        <span>Ctrl K</span>
      </label>
      <div className="divider" aria-hidden="true" />
      <button className="control offline" type="button">
        <span className="dot" aria-hidden="true" />
        <span>
          <strong>Offline</strong>
          <small>All good</small>
        </span>
        <ChevronDown aria-hidden="true" className="small-icon" />
      </button>
      <button className="control" type="button">
        <FilePlus2 aria-hidden="true" className="small-icon" />
        Import
        <ChevronDown aria-hidden="true" className="small-icon" />
      </button>
      <button className="primary" type="button">
        <Download aria-hidden="true" className="small-icon" />
        Download
        <ChevronDown aria-hidden="true" className="small-icon" />
      </button>
      <button aria-label="More workspace actions" className="icon-btn" type="button">
        <Ellipsis aria-hidden="true" className="small-icon" />
      </button>
    </header>
  );
}

function Statusbar({ databasePath, lastScanLabel }: { databasePath: string; lastScanLabel: string }): ReactElement {
  return (
    <footer className="statusbar" role="contentinfo">
      <div className="status-group">
        <div className="status-item truncate">
          <Database aria-hidden="true" className="small-icon" />
          DB: {databasePath}
        </div>
      </div>
      <div className="status-group">
        <div className="status-item">Detected agents:</div>
        <div className="status-item">
          <span className="agent-dot">C</span> Codex 1.2.0
        </div>
        <div className="status-item">
          <span className="agent-dot claude">C</span> Claude 1.5.1
        </div>
        <div className="status-item">
          <span className="agent-dot gemini">G</span> Gemini 1.1.0
        </div>
        <div className="status-item">
          <span className="agent-dot open">O</span> OpenCode 0.9.0
        </div>
      </div>
      <div className="status-group status-right">
        <div className="status-item">{lastScanLabel}</div>
        <div className="status-item">SQLite source of truth</div>
        <div className="status-item">Offline by default</div>
      </div>
    </footer>
  );
}

function Tabs({ activePage }: { activePage: PageKey }): ReactElement {
  return (
    <div className="tabs" role="tablist" aria-label={`${labelForPage(activePage)} sections`}>
      {pageTabs[activePage].map((tab, index) => (
        <button
          aria-selected={index === 0}
          className={`tab ${index === 0 ? 'active' : ''}`}
          key={tab}
          role="tab"
          type="button"
        >
          {tab}
          {tab === 'Needs review' || tab === 'Scan queue' || tab === 'Conflicts' ? <span className="badge">3</span> : null}
        </button>
      ))}
    </div>
  );
}

function Filters({ activePage }: { activePage: PageKey }): ReactElement | null {
  const filters = filterSets[activePage];
  if (!filters) {
    return null;
  }

  return (
    <div className="filters" aria-label={`${labelForPage(activePage)} filters`}>
      {filters.map((filter) => (
        <button
          aria-label={`${filter.label} filter: ${filter.value}`}
          aria-pressed="true"
          className="filter"
          key={`${filter.label}:${filter.value}`}
          type="button"
        >
          {filter.label} <strong>{filter.value}</strong>
          <ChevronDown aria-hidden="true" className="small-icon" />
        </button>
      ))}
      <div className="spacer" />
      <button className="filter blue" type="button">
        {activePage === 'reviews' ? 'Start review' : activePage === 'installs' ? 'New plan' : 'More filters'}
      </button>
    </div>
  );
}

function PageContent({
  activePage,
  activeInstallPlan,
  hasImportBridge,
  hasInstallBridge,
  hasScanBridge,
  hasSecurityBridge,
  importPath,
  installTargetRoot,
  onApplyInstallPlan,
  onCreateInstallPlan,
  onImportLocalFolder,
  onImportPathChange,
  onInstallTargetRootChange,
  onScanAgentRoots,
  onSecurityScan,
  viewModel,
  workspaceState
}: {
  activePage: PageKey;
  activeInstallPlan: InstallPlan | null;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  hasSecurityBridge: boolean;
  importPath: string;
  installTargetRoot: string;
  onApplyInstallPlan: () => void;
  onCreateInstallPlan: () => void;
  onImportLocalFolder: () => void;
  onImportPathChange: (value: string) => void;
  onInstallTargetRootChange: (value: string) => void;
  onScanAgentRoots: () => void;
  onSecurityScan: () => void;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
  workspaceState: DesktopWorkspaceState;
}): ReactElement {
  if (activePage === 'library') {
    return (
      <LibraryPage
        activeInstallPlan={activeInstallPlan}
        hasImportBridge={hasImportBridge}
        hasInstallBridge={hasInstallBridge}
        hasScanBridge={hasScanBridge}
        importPath={importPath}
        installTargetRoot={installTargetRoot}
        onApplyInstallPlan={onApplyInstallPlan}
        onCreateInstallPlan={onCreateInstallPlan}
        onImportLocalFolder={onImportLocalFolder}
        onImportPathChange={onImportPathChange}
        onInstallTargetRootChange={onInstallTargetRootChange}
        onScanAgentRoots={onScanAgentRoots}
        viewModel={viewModel}
        workspaceState={workspaceState}
      />
    );
  }

  if (activePage === 'discover') {
    return <DiscoverPage viewModel={viewModel} />;
  }

  if (activePage === 'installs') {
    return <InstallsPage viewModel={viewModel} />;
  }

  if (activePage === 'usage') {
    return <UsagePage viewModel={viewModel} />;
  }

  if (activePage === 'reviews') {
    return <ReviewsPage viewModel={viewModel} />;
  }

  if (activePage === 'security') {
    return <SecurityPage hasSecurityBridge={hasSecurityBridge} onSecurityScan={onSecurityScan} viewModel={viewModel} />;
  }

  if (activePage === 'settings') {
    return <SettingsPage viewModel={viewModel} />;
  }

  return <DashboardPage hasScanBridge={hasScanBridge} onScanAgentRoots={onScanAgentRoots} viewModel={viewModel} />;
}

function DashboardPage({
  hasScanBridge,
  onScanAgentRoots,
  viewModel
}: {
  hasScanBridge: boolean;
  onScanAgentRoots: () => void;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  return (
    <>
      <PageTitle
        action={
          <button className="filter blue" disabled={!hasScanBridge} onClick={onScanAgentRoots} type="button">
            Run scan
          </button>
        }
        description="Local library health, agent coverage, and install readiness."
        title="Dashboard"
      />
      <MetricGrid metrics={viewModel.dashboard.metrics} />
      <div className="section-grid">
        <Panel title="Recent activity" tag="SQLite source of truth" rows={viewModel.dashboard.activity} />
        <section className="panel" aria-label="Agent coverage">
          <PanelHeader tag="4 detected" title="Agent coverage" />
          <BarChart values={viewModel.dashboard.agentCoverageBars} />
        </section>
      </div>
      <section className="panel panel-spaced" aria-label="Readiness queue">
        <PanelHeader tag="3 actions" title="Readiness queue" />
        <DataTable
          columns={[
            { key: 'item', label: 'Item', width: '28%' },
            { key: 'owner', label: 'Owner', width: '20%' },
            { key: 'signal', label: 'Signal', width: '18%' },
            { key: 'lastCheck', label: 'Last check', width: '18%' },
            { key: 'status', label: 'Status', width: '16%' }
          ]}
          rows={viewModel.dashboard.readinessRows}
        />
      </section>
    </>
  );
}

function LibraryPage({
  activeInstallPlan,
  hasImportBridge,
  hasInstallBridge,
  hasScanBridge,
  importPath,
  installTargetRoot,
  onApplyInstallPlan,
  onCreateInstallPlan,
  onImportLocalFolder,
  onImportPathChange,
  onInstallTargetRootChange,
  onScanAgentRoots,
  viewModel,
  workspaceState
}: {
  activeInstallPlan: InstallPlan | null;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  importPath: string;
  installTargetRoot: string;
  onApplyInstallPlan: () => void;
  onCreateInstallPlan: () => void;
  onImportLocalFolder: () => void;
  onImportPathChange: (value: string) => void;
  onInstallTargetRootChange: (value: string) => void;
  onScanAgentRoots: () => void;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
  workspaceState: DesktopWorkspaceState;
}): ReactElement {
  return (
    <>
      <PageTitle
        action={
          <button className="filter blue" disabled={!hasScanBridge} onClick={onScanAgentRoots} type="button">
            Scan agent roots
          </button>
        }
        description="Indexed local skills, imports, install planning, and governance state."
        title="Library"
      />
      {viewModel.librarySkills.length > 0 ? (
        <section aria-label="Indexed skills" className="library-list">
          {viewModel.librarySkills.map((skill) => (
            <article className="skill-row" key={`${skill.id}:${skill.path}`}>
              <div>
                <h2>{skill.name}</h2>
                <p>{skill.path}</p>
              </div>
              <dl>
                <div>
                  <dt>Agent</dt>
                  <dd>{skill.sourceAgent}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{skill.installStatus}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state" aria-label="Library empty state">
          <Box aria-hidden="true" className="empty-icon" />
          <div className="empty-copy">
            <h2>No skills indexed yet</h2>
            <p>The desktop shell is ready for local library indexing and typed agent adapters.</p>
          </div>
        </section>
      )}
      <ManagementFlow
        activeInstallPlan={activeInstallPlan}
        flow={workspaceState.managementFlow}
        hasImportBridge={hasImportBridge}
        hasInstallBridge={hasInstallBridge}
        hasScanBridge={hasScanBridge}
        hasSkills={workspaceState.skills.length > 0}
        importPath={importPath}
        installTargetRoot={installTargetRoot}
        onApplyInstallPlan={onApplyInstallPlan}
        onCreateInstallPlan={onCreateInstallPlan}
        onImportLocalFolder={onImportLocalFolder}
        onImportPathChange={onImportPathChange}
        onInstallTargetRootChange={onInstallTargetRootChange}
        onScanAgentRoots={onScanAgentRoots}
      />
      <div className="section-grid panel-spaced">
        <Panel
          title="History"
          rows={workspaceState.governance.history.map((item) => ({
            label: `v${item.versionNo}`,
            value: item.summary
          }))}
        />
        <Panel
          title="Diff"
          rows={workspaceState.governance.diff.map((item) => ({
            label: item.relativePath,
            value: item.changeType
          }))}
        />
      </div>
      <Panel
        className="panel-spaced"
        title="Collections"
        rows={workspaceState.governance.collections.map((item) => ({
          label: item.name,
          value: String(item.skillCount)
        }))}
      />
    </>
  );
}

function DiscoverPage({ viewModel }: { viewModel: ReturnType<typeof createWorkspaceViewModel> }): ReactElement {
  return (
    <>
      <PageTitle
        action={<span className="tag">48 sources</span>}
        description="Browse trusted local and remote skill sources before importing."
        title="Discover"
      />
      <div className="card-grid">
        {viewModel.discover.sources.map((source) => (
          <SourceCardView key={source.name} source={source} />
        ))}
      </div>
      <section className="panel panel-spaced" aria-label="Source updates">
        <PanelHeader tag="Offline cache" title="Source updates" />
        <DataTable
          columns={[
            { key: 'source', label: 'Source', width: '28%' },
            { key: 'trust', label: 'Trust', width: '22%' },
            { key: 'newSkills', label: 'New skills', width: '18%' },
            { key: 'lastChecked', label: 'Last checked', width: '17%' },
            { key: 'status', label: 'Status', width: '15%' }
          ]}
          rows={viewModel.discover.sourceUpdates}
        />
      </section>
    </>
  );
}

function InstallsPage({ viewModel }: { viewModel: ReturnType<typeof createWorkspaceViewModel> }): ReactElement {
  return (
    <>
      <PageTitle
        action={<span className="tag">Copy only</span>}
        description="Plan, apply, rollback, and uninstall app-owned skill projections."
        title="Installs"
      />
      <section className="panel" aria-label="Pending install plans">
        <PanelHeader tag="2 conflicts" title="Pending install plans" />
        <DataTable
          columns={[
            { key: 'skill', label: 'Skill', width: '26%' },
            { key: 'agent', label: 'Agent', width: '18%' },
            { key: 'targetRoot', label: 'Target root', width: '24%' },
            { key: 'writes', label: 'Writes', width: '12%' },
            { key: 'conflict', label: 'Conflict', width: '11%' },
            { key: 'status', label: 'Status', width: '9%' }
          ]}
          rows={viewModel.installs.plans}
        />
      </section>
      <div className="split-two panel-spaced">
        <Panel title="Install result stream" tag="Last 24h" rows={viewModel.installs.resultStream} />
        <Panel title="Export packages" tag="Hash checked" rows={viewModel.installs.exportPackages} />
      </div>
    </>
  );
}

function UsagePage({ viewModel }: { viewModel: ReturnType<typeof createWorkspaceViewModel> }): ReactElement {
  return (
    <>
      <PageTitle
        action={<button className="filter blue" type="button">Download CSV</button>}
        description="Local usage signals from installs, launches, scans, and exports."
        title="Usage"
      />
      <MetricGrid metrics={viewModel.usage.metrics} />
      <section className="panel" aria-label="Daily activity">
        <PanelHeader tag="No telemetry" title="Daily activity" />
        <BarChart values={viewModel.usage.dailyBars} />
      </section>
      <div className="split-two panel-spaced">
        <Panel title="Top skills" tag="By launch" rows={viewModel.usage.topSkills} />
        <Panel title="Agent split" tag="Detected roots" rows={viewModel.usage.agentSplit} />
      </div>
    </>
  );
}

function ReviewsPage({ viewModel }: { viewModel: ReturnType<typeof createWorkspaceViewModel> }): ReactElement {
  return (
    <>
      <PageTitle
        action={<span className="tag">3 open</span>}
        description="Review imported skills, package changes, and source trust decisions."
        title="Reviews"
      />
      <section className="panel" aria-label="Review queue">
        <PanelHeader tag="Threaded" title="Review queue" />
        <DataTable
          columns={[
            { key: 'reviewItem', label: 'Review item', width: '28%' },
            { key: 'reason', label: 'Reason', width: '20%' },
            { key: 'source', label: 'Source', width: '15%' },
            { key: 'reviewer', label: 'Reviewer', width: '15%' },
            { key: 'risk', label: 'Risk', width: '12%' },
            { key: 'status', label: 'Status', width: '10%' }
          ]}
          rows={viewModel.reviews.queue}
        />
      </section>
      <div className="split-two panel-spaced">
        <Panel title="Review notes" tag="Open" rows={viewModel.reviews.notes} />
        <Panel title="Community signal" tag="Local cache" rows={viewModel.reviews.communitySignal} />
      </div>
    </>
  );
}

function SecurityPage({
  hasSecurityBridge,
  onSecurityScan,
  viewModel
}: {
  hasSecurityBridge: boolean;
  onSecurityScan: () => void;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  return (
    <>
      <PageTitle
        action={
          <button className="filter blue" disabled={!hasSecurityBridge} onClick={onSecurityScan} type="button">
            Run rescan
          </button>
        }
        description="Pre-install scanning, policy enforcement, and scoped exemptions."
        title="Security"
      />
      <MetricGrid metrics={viewModel.security.metrics} />
      <section className="panel" aria-label="Security Center">
        <PanelHeader tag="5 pending" title="Security Center" />
        <DataTable
          columns={[
            { key: 'skill', label: 'Skill', width: '28%' },
            { key: 'finding', label: 'Rule finding', width: '20%' },
            { key: 'category', label: 'Category', width: '20%' },
            { key: 'severity', label: 'Severity', width: '16%' },
            { key: 'policy', label: 'Policy', width: '16%' }
          ]}
          rows={viewModel.security.queue}
        />
      </section>
      <div className="split-two panel-spaced">
        <Panel title="Rule details" tag="6 active" rows={viewModel.security.ruleDetails} />
        <Panel title="Exemption lifecycle" tag="Audited" rows={viewModel.security.exemptions} />
      </div>
    </>
  );
}

function SettingsPage({ viewModel }: { viewModel: ReturnType<typeof createWorkspaceViewModel> }): ReactElement {
  return (
    <>
      <PageTitle
        action={<button className="filter blue" type="button">Save changes</button>}
        description="Configure local roots, storage, disabled sync, and plugin permissions."
        title="Settings"
      />
      <section className="panel" aria-label="Detected agent roots">
        <PanelHeader tag="4 agents" title="Detected agent roots" />
        <AgentRootList roots={viewModel.settings.agentRoots} />
      </section>
      <div className="split-two panel-spaced">
        <Panel title="Offline-first sync" tag="Disabled" rows={viewModel.settings.syncRows} />
        <Panel title="Plugin runtime" tag="Opt-in" rows={viewModel.settings.pluginRows} />
      </div>
      <section className="panel panel-spaced" aria-label="Database and privacy">
        <PanelHeader tag="Local only" title="Database and privacy" />
        <DataTable
          columns={[
            { key: 'setting', label: 'Setting', width: '32%' },
            { key: 'value', label: 'Value', width: '42%' },
            { key: 'status', label: 'Status', width: '26%' }
          ]}
          rows={viewModel.settings.databaseRows}
        />
      </section>
    </>
  );
}

function RightRail({
  activePage,
  viewModel
}: {
  activePage: PageKey;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  const label = labelForPage(activePage);
  const config = railConfig(activePage, viewModel);

  return (
    <aside aria-label={`${label} details`} className="right-pane">
      <div className="rail-head">
        <div className={`rail-icon ${config.tone ? `rail-${config.tone}` : ''}`}>{config.initials}</div>
        <div className="rail-title">
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>
        <Ellipsis aria-hidden="true" className="small-icon" />
      </div>
      {config.panels.map((panel) => (
        <Panel
          ariaLabel={panel.title}
          className="rail-card"
          key={panel.title}
          rows={panel.rows}
          text={panel.text}
          title={panel.title}
        />
      ))}
    </aside>
  );
}

function railConfig(
  activePage: PageKey,
  viewModel: ReturnType<typeof createWorkspaceViewModel>
): {
  initials: string;
  title: string;
  subtitle: string;
  tone?: Tone;
  panels: PanelModel[];
} {
  if (activePage === 'library') {
    return {
      initials: 'L',
      title: 'Library selection',
      subtitle: 'Indexed local state',
      panels: [
        {
          title: 'Library summary',
          rows: [
            { label: 'Indexed rows', value: String(viewModel.librarySkills.length) },
            { label: 'Install source', value: 'SQLite' },
            { label: 'Filesystem', value: 'Preload IPC only' }
          ]
        },
        {
          title: 'Next action',
          text: 'Run an agent scan or import a local folder before creating install plans.'
        }
      ]
    };
  }

  if (activePage === 'discover') {
    return {
      initials: 'S',
      title: 'skills.sh official',
      subtitle: 'Verified remote source',
      panels: [
        {
          title: 'Source profile',
          rows: [
            { label: 'Trust level', value: 'Verified' },
            { label: 'Signature', value: 'Valid' },
            { label: 'Catalog size', value: '312' },
            { label: 'Default install', value: 'Manual' }
          ]
        },
        {
          title: 'Recommended collection',
          rows: [
            { label: 'Included skills', value: '18' },
            { label: 'Avg. risk', value: 'Low' },
            { label: 'Reviews', value: '412' },
            { label: 'Last update', value: 'Today' }
          ]
        },
        {
          title: 'Import preview',
          text: 'No files are written to agent roots until an install plan is reviewed.'
        }
      ]
    };
  }

  if (activePage === 'installs') {
    return {
      initials: 'S',
      title: 'sui-move-contract',
      subtitle: 'Clean install plan',
      panels: [
        {
          title: 'Plan summary',
          rows: [
            { label: 'Target agent', value: 'Codex' },
            { label: 'Scope', value: 'User' },
            { label: 'Planned writes', value: '24' },
            { label: 'Conflicts', value: 'None' },
            { label: 'Security', value: 'Low' }
          ]
        },
        {
          title: 'Write preview',
          rows: [
            { label: 'SKILL.md', value: 'new' },
            { label: 'prompts/review.md', value: 'new' },
            { label: 'scripts/scan.ts', value: 'new' },
            { label: 'README.md', value: 'new' }
          ]
        },
        {
          title: 'Safety rule',
          text: 'Apply only writes files recorded by the plan. Uninstall later removes app-owned files only.'
        }
      ]
    };
  }

  if (activePage === 'usage') {
    return {
      initials: 'U',
      title: 'Usage insight',
      subtitle: 'Local events only',
      tone: 'green',
      panels: [
        {
          title: 'Privacy boundary',
          text: 'Usage is derived from local SQLite records. No cloud analytics.'
        },
        {
          title: 'Activity heatmap',
          text: 'Dense local activity on weekdays, lighter export usage on weekends.'
        },
        {
          title: 'Recent usage',
          rows: viewModel.usage.recentUsage
        }
      ]
    };
  }

  if (activePage === 'reviews') {
    return {
      initials: 'R',
      title: 'gh-fix-ci update',
      subtitle: 'Review decision',
      tone: 'red',
      panels: [
        {
          title: 'Decision checklist',
          rows: [
            { label: 'Security scan', value: 'High' },
            { label: 'Diff reviewed', value: 'Pending' },
            { label: 'Source trust', value: 'GitHub' },
            { label: 'Install block', value: 'Enabled' }
          ]
        },
        {
          title: 'Changed files',
          rows: [
            { label: 'SKILL.md', value: 'modified' },
            { label: 'scripts/diagnose.ts', value: 'added' },
            { label: 'prompts/ci.md', value: 'modified' },
            { label: 'README.md', value: 'modified' }
          ]
        },
        {
          title: 'Reviewer action',
          text: 'High-risk installs stay blocked until a scoped exemption is recorded.'
        }
      ]
    };
  }

  if (activePage === 'security') {
    return {
      initials: '!',
      title: 'Current posture',
      subtitle: 'High risk guarded',
      tone: 'red',
      panels: [
        {
          title: 'Policy summary',
          rows: [
            { label: 'High risk installs', value: 'Blocked' },
            { label: 'Critical installs', value: 'Blocked' },
            { label: 'Medium risk', value: 'Warn' },
            { label: 'Exemptions', value: 'Scoped only' }
          ]
        },
        {
          title: 'Finding excerpt',
          text: 'scripts/diagnose.ts references shell execution and needs explicit reviewer approval.'
        },
        {
          title: 'Recommended action',
          text: 'Review changed executable files and record an exemption only if the script is required.'
        }
      ]
    };
  }

  if (activePage === 'settings') {
    return {
      initials: 'S',
      title: 'Workspace settings',
      subtitle: 'Local-first defaults',
      panels: [
        {
          title: 'Current defaults',
          rows: viewModel.settings.defaults
        },
        {
          title: 'Sync preview',
          rows: viewModel.settings.syncPreview
        },
        {
          title: 'Plugin request',
          text: 'mock-agent-adapter wants to register one adapter capability. Filesystem and network APIs remain unavailable.'
        }
      ]
    };
  }

  return {
    initials: 'OH',
    title: 'Workspace health',
    subtitle: 'Phase 10 maintainer operations',
    panels: [
      {
        title: "Today's focus",
        rows: [
          { label: 'Risk posture', value: 'Medium' },
          { label: 'Sync state', value: 'Disabled' },
          { label: 'DB status', value: 'Healthy' },
          { label: 'Pending imports', value: '5' }
        ]
      },
      {
        title: 'Agent roots',
        rows: viewModel.dashboard.agentRoots.map((root) => ({ label: root.agent, value: root.status }))
      },
      {
        title: 'Next recommended action',
        text: 'Open Security and resolve high-risk findings before applying new install plans.'
      }
    ]
  };
}

function PageTitle({
  action,
  description,
  title
}: {
  action?: ReactElement;
  description: string;
  title: string;
}): ReactElement {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="sub-actions">{action}</div> : null}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: MetricCard[] }): ReactElement {
  return (
    <div className="metric-grid">
      {metrics.map((metricItem) => (
        <article className="metric" key={metricItem.label}>
          <span>{metricItem.label}</span>
          <strong>{metricItem.value}</strong>
          <small>{metricItem.detail}</small>
        </article>
      ))}
    </div>
  );
}

function Panel({
  ariaLabel,
  className = 'panel',
  rows = [],
  tag,
  text,
  title
}: PanelModel & { ariaLabel?: string; className?: string }): ReactElement {
  return (
    <section aria-label={ariaLabel ?? title} className={className}>
      <PanelHeader tag={tag} title={title} />
      {text ? <p>{text}</p> : null}
      {rows.length > 0 ? <KeyValueList rows={rows} /> : null}
    </section>
  );
}

function PanelHeader({ tag, title }: { tag?: string | undefined; title: string }): ReactElement {
  return (
    <header>
      <h2>{title}</h2>
      {tag ? <span className="tag">{tag}</span> : null}
    </header>
  );
}

function KeyValueList({ rows }: { rows: KeyValueRow[] }): ReactElement {
  return (
    <ul className="list">
      {rows.map((row) => (
        <li key={`${row.label}:${row.value}`}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function SourceCardView({ source }: { source: SourceCard }): ReactElement {
  return (
    <article className={`card ${source.selected ? 'selected' : ''}`}>
      <header>
        <div className="row-title">
          <span className="avatar">{source.name.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{source.name}</strong>
            <small>{source.sourcePath}</small>
          </span>
        </div>
        <span className={`risk ${source.risk === 'Medium' ? 'medium' : 'low'}`}>{source.risk}</span>
      </header>
      <p>{source.description}</p>
      <div className="tag-row">
        {source.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
        <span className="stars">5.0 / 5</span>
      </div>
    </article>
  );
}

function DataTable({ columns, rows }: { columns: TableColumn[]; rows: TableRow[] }): ReactElement {
  return (
    <table>
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className={row.selected ? 'selected' : ''} key={row.id}>
            {row.cells.map((cell, index) => (
              <td key={`${row.id}:${index}`}>
                <TableCellView cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableCellView({ cell }: { cell: TableCell }): ReactElement {
  if (cell.avatar) {
    return (
      <div className="row-title">
        <span className={`avatar ${cell.avatarTone ?? ''}`}>{cell.avatar}</span>
        <span>
          <strong>{cell.label}</strong>
          {cell.detail ? <small>{cell.detail}</small> : null}
        </span>
      </div>
    );
  }

  if (cell.tone) {
    return <span className={`status ${cell.tone}`}>{cell.label}</span>;
  }

  if (cell.detail) {
    return (
      <span className="stack">
        <strong>{cell.label}</strong>
        <small>{cell.detail}</small>
      </span>
    );
  }

  return <>{cell.label}</>;
}

function ManagementFlow({
  activeInstallPlan,
  flow,
  hasImportBridge,
  hasInstallBridge,
  hasScanBridge,
  hasSkills,
  importPath,
  installTargetRoot,
  onApplyInstallPlan,
  onCreateInstallPlan,
  onImportLocalFolder,
  onImportPathChange,
  onInstallTargetRootChange,
  onScanAgentRoots
}: {
  activeInstallPlan: InstallPlan | null;
  flow: ManagementFlowState;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  hasSkills: boolean;
  importPath: string;
  installTargetRoot: string;
  onApplyInstallPlan: () => void;
  onCreateInstallPlan: () => void;
  onImportLocalFolder: () => void;
  onImportPathChange: (value: string) => void;
  onInstallTargetRootChange: (value: string) => void;
  onScanAgentRoots: () => void;
}): ReactElement {
  return (
    <section className="management-flow panel-spaced" aria-label="Local management flow">
      <article className="flow-panel">
        <header>
          <h2>Import Queue</h2>
          <span>{flow.importItems.length}</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="import-source-path">
            Import source path
            <input
              aria-label="Import source path"
              id="import-source-path"
              name="importSourcePath"
              onChange={(event) => onImportPathChange(event.target.value)}
              placeholder="/path/to/skill"
              value={importPath}
            />
          </label>
          <button
            disabled={!hasImportBridge || importPath.trim().length === 0}
            onClick={onImportLocalFolder}
            type="button"
          >
            Import local folder
          </button>
          <button disabled={!hasScanBridge} onClick={onScanAgentRoots} type="button">
            Scan agent roots
          </button>
        </div>
        <KeyValueList rows={flow.importItems.map((item) => ({ label: item.label, value: item.status }))} />
      </article>

      <article className="flow-panel">
        <header>
          <h2>Install Plan</h2>
          <span>{flow.installPlan?.conflictState ?? 'not planned'}</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="install-target-root">
            Install target root
            <input
              aria-label="Install target root"
              id="install-target-root"
              name="installTargetRoot"
              onChange={(event) => onInstallTargetRootChange(event.target.value)}
              placeholder="/path/to/agent/skills"
              value={installTargetRoot}
            />
          </label>
          <button
            disabled={!hasInstallBridge || !hasSkills || installTargetRoot.trim().length === 0}
            onClick={onCreateInstallPlan}
            type="button"
          >
            Create install plan
          </button>
          <button disabled={!hasInstallBridge || !activeInstallPlan} onClick={onApplyInstallPlan} type="button">
            Apply install plan
          </button>
        </div>
        {flow.installPlan ? (
          <dl className="flow-details">
            <div>
              <dt>Skill</dt>
              <dd>{flow.installPlan.skillName}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{flow.installPlan.targetRoot}</dd>
            </div>
            <div>
              <dt>Writes</dt>
              <dd>{flow.installPlan.writeCount} planned writes</dd>
            </div>
          </dl>
        ) : (
          <p>No install plan yet</p>
        )}
      </article>

      <article className="flow-panel">
        <header>
          <h2>Install Result</h2>
          <span>{flow.installResult?.status ?? 'pending'}</span>
        </header>
        <p>{flow.installResult?.message ?? 'No install has been applied yet.'}</p>
      </article>
    </section>
  );
}

function AgentRootList({ roots }: { roots: AgentRootView[] }): ReactElement {
  return (
    <div className="path-box">
      {roots.map((root) => (
        <div className="path-row" key={`${root.agent}:${root.path}`}>
          <span className={`agent-dot ${agentTone(root.agent)}`}>{root.agent.slice(0, 1)}</span>
          <span>
            <strong>{root.agent} user skills</strong>
            <small>{root.path}</small>
          </span>
          <span className={`status ${root.tone}`}>{root.status}</span>
        </div>
      ))}
    </div>
  );
}

function BarChart({ values }: { values: number[] }): ReactElement {
  return (
    <div className="bar-chart" aria-hidden="true">
      {values.map((value, index) => (
        <i
          className={`bar ${index % 5 === 0 ? 'alt' : index % 7 === 0 ? 'warn' : ''}`}
          key={`${value}:${index}`}
          style={{ height: `${value}px` }}
        />
      ))}
    </div>
  );
}

function labelForPage(page: PageKey): string {
  return page.slice(0, 1).toUpperCase() + page.slice(1);
}

function agentTone(agent: string): string {
  const lower = agent.toLowerCase();
  if (lower === 'claude') {
    return 'claude';
  }
  if (lower === 'gemini') {
    return 'gemini';
  }
  if (lower === 'opencode') {
    return 'open';
  }
  return '';
}
