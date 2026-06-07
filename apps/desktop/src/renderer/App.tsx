import { FolderSearch, Home, Library, Plug, RefreshCw, Search, Settings, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AgentRootTarget,
  DesktopWorkspaceState,
  DiscoverSkillPreview,
  DiscoverSource,
  InstallPlan,
  LibraryScanResult,
  PluginRegistry
} from '@theopenhub/shared';

import './app.css';
import {
  createEmptyWorkspaceState,
  createWorkspaceUxModel,
  createWorkspaceViewModel,
  mergeScanIntoWorkspaceState,
  pageOrder,
  type PageKey
} from './workspace-view-model';

const pageIcons = {
  home: Home,
  skills: Library,
  settings: Settings
} as const;

const agentTabs = [
  { key: 'codex', label: 'Codex' },
  { key: 'claude', label: 'Claude' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'opencode', label: 'OpenCode' },
  { key: 'agents', label: 'Agents' },
  { key: 'marketplace', label: 'Marketplace' }
] as const;

type SkillsTabKey = (typeof agentTabs)[number]['key'];
type RootAgentCode = 'codex' | 'claude' | 'gemini' | 'opencode' | 'agents';
type AsyncGuard = () => boolean;
type StatusTone = 'default' | 'error';

const defaultPluginRegistry: PluginRegistry = { agentAdapters: [], importers: [], syncDrivers: [] };

export interface AppProps {
  initialState?: DesktopWorkspaceState;
  initialAgentRoots?: AgentRootTarget[];
  initialPreviewSkills?: DiscoverSkillPreview[];
  initialPluginRegistry?: PluginRegistry;
}

export function App({
  initialState,
  initialAgentRoots = [],
  initialPreviewSkills = [],
  initialPluginRegistry = defaultPluginRegistry
}: AppProps) {
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [state, setState] = useState<DesktopWorkspaceState>(initialState ?? createEmptyWorkspaceState());
  const [agentRoots, setAgentRoots] = useState<AgentRootTarget[]>(initialAgentRoots);
  const [previewSkills, setPreviewSkills] = useState<DiscoverSkillPreview[]>(initialPreviewSkills);
  const [discoverSources, setDiscoverSources] = useState<DiscoverSource[]>([]);
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry>(initialPluginRegistry);
  const [query, setQuery] = useState('');
  const [skillsTab, setSkillsTab] = useState<SkillsTabKey>('codex');
  const [sourceName, setSourceName] = useState('Local Source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [rootAgentCode, setRootAgentCode] = useState<RootAgentCode>('codex');
  const [rootPath, setRootPath] = useState('');
  const [selectedTargetRoot, setSelectedTargetRoot] = useState('');
  const [projectionMode, setProjectionMode] = useState<'copy' | 'symlink'>('copy');
  const [pendingPlan, setPendingPlan] = useState<InstallPlan | null>(null);
  const [importedCandidates, setImportedCandidates] = useState<Record<string, string>>({});
  const [installedSkillIds, setInstalledSkillIds] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('Ready');
  const [statusTone, setStatusTone] = useState<StatusTone>('default');
  const mountedRef = useRef(true);

  const viewModel = useMemo(() => createWorkspaceViewModel(state), [state]);
  const uxModel = useMemo(
    () =>
      createWorkspaceUxModel({
        state,
        activePage,
        selectedSkillDetail: null,
        discoverPreviewSkills: previewSkills,
        agentRootTargets: agentRoots
      }),
    [activePage, agentRoots, previewSkills, state]
  );
  const installedCandidateNames = useMemo(
    () =>
      state.librarySkills.reduce<Record<string, string>>((installed, skill) => {
        if (skill.ownership === 'app-owned' && skill.installationId) {
          installed[skill.name] = skill.installationId;
        }
        return installed;
      }, {}),
    [state.librarySkills]
  );
  const homeMetrics = useMemo(
    () => [
      {
        label: 'Library skills',
        value: String(state.skills.length || state.librarySkills.length),
        detail: 'SQLite library'
      },
      {
        label: 'Root locations',
        value: String(new Set(state.librarySkills.map((skill) => skill.rootPath)).size),
        detail: 'Indexed roots'
      },
      {
        label: 'Local roots',
        value: String(agentRoots.length),
        detail: 'Detected roots'
      },
      {
        label: 'Marketplace sources',
        value: String(discoverSources.length),
        detail: 'Configured sources'
      },
      {
        label: 'App-owned installs',
        value: String(state.librarySkills.filter((skill) => skill.ownership === 'app-owned').length),
        detail: 'Managed files'
      }
    ],
    [agentRoots.length, discoverSources.length, state.librarySkills, state.skills.length]
  );

  const setRootsAndSources = useCallback((roots: AgentRootTarget[], sources: DiscoverSource[]) => {
    setAgentRoots(roots);
    setDiscoverSources(sources);
    setSelectedSourceId((current) => current || sources[0]?.id || '');
    setSelectedTargetRoot((current) => current || roots.find((root) => root.writable)?.rootPath || roots[0]?.rootPath || '');
  }, []);
  const setStatusMessage = useCallback((message: string, tone: StatusTone = 'default') => {
    setStatus(message);
    setStatusTone(tone);
  }, []);
  const navigateHomeStep = useCallback((step: ReturnType<typeof createWorkspaceUxModel>['actionSteps'][number]) => {
    setActivePage(step.targetPage);
    if (step.targetSkillsTab) {
      setSkillsTab(step.targetSkillsTab);
    }
  }, []);

  const isInactive = useCallback((isCancelled?: AsyncGuard) => !mountedRef.current || Boolean(isCancelled?.()), []);

  const refreshRootsAndSources = useCallback(
    async (isCancelled?: AsyncGuard) => {
      const api = window.theOpenHub;
      if (!api) {
        return;
      }
      const [roots, sources] = await Promise.all([
        api.listAgentRoots(),
        api.listDiscoverSources?.() ?? Promise.resolve([])
      ]);
      if (isInactive(isCancelled)) {
        return;
      }
      setRootsAndSources(roots, sources);
    },
    [isInactive, setRootsAndSources]
  );

  const refreshWorkspace = useCallback(
    async (isCancelled?: AsyncGuard) => {
      const workspace = await window.theOpenHub?.getWorkspaceState();
      if (isInactive(isCancelled)) {
        return;
      }
      if (workspace) {
        setState(workspace);
      }
      await refreshRootsAndSources(isCancelled).catch(() => undefined);
    },
    [isInactive, refreshRootsAndSources]
  );

  const runRootScan = useCallback(
    async (isCancelled?: AsyncGuard) => {
      const api = window.theOpenHub;
      if (!api?.scanAgentRoots) {
        return;
      }
      if (!isInactive(isCancelled)) {
        setStatusMessage('Scanning roots...');
      }
      try {
        const scan = await api.scanAgentRoots();
        if (!scan || isInactive(isCancelled)) {
          return;
        }
        setState((current) => mergeScanIntoWorkspaceState(current, scan));
        await refreshWorkspace(isCancelled).catch(() => undefined);
        if (!isInactive(isCancelled)) {
          setStatusMessage(formatScanStatus(scan));
        }
      } catch (error: unknown) {
        if (!isInactive(isCancelled)) {
          setStatusMessage(formatError(error), 'error');
        }
      }
    },
    [isInactive, refreshWorkspace, setStatusMessage]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const api = window.theOpenHub;
    if (!api) {
      return;
    }

    Promise.all([
      api.getWorkspaceState(),
      api.listAgentRoots(),
      api.listDiscoverSources?.() ?? Promise.resolve([]),
      api.getPluginRegistry?.() ?? Promise.resolve(initialPluginRegistry)
    ])
      .then(([workspace, roots, sources, registry]) => {
        if (cancelled) {
          return;
        }
        setState(workspace);
        setRootsAndSources(roots, sources);
        setPluginRegistry(registry);
        void runRootScan(() => cancelled);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatusMessage(formatError(error), 'error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialPluginRegistry, runRootScan, setRootsAndSources, setStatusMessage]);

  async function refreshWorkspaceCommand() {
    try {
      await refreshWorkspace();
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function scanRoots() {
    await runRootScan();
  }

  async function previewSource() {
    const api = window.theOpenHub;
    if (!api || !selectedSourceId) {
      return;
    }
    try {
      const preview = await api.previewDiscoverSource(selectedSourceId);
      setPreviewSkills(preview.skills);
      setStatusMessage(`${preview.skills.length} candidates`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function addMarketplaceSource() {
    const api = window.theOpenHub;
    if (!api || !sourceUrl.trim()) {
      return;
    }
    try {
      const source = await api.addDiscoverSource({
        name: sourceName.trim() || 'Local Source',
        sourceType: sourceUrl.includes('://') ? 'git' : 'local',
        url: sourceUrl.trim()
      });
      setDiscoverSources((current) => [source, ...current.filter((item) => item.id !== source.id)]);
      setSelectedSourceId(source.id);
      setStatusMessage(`Source added: ${source.name}`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function removeMarketplaceSource(sourceId: string) {
    const api = window.theOpenHub;
    if (!api) {
      return;
    }
    try {
      await api.removeDiscoverSource?.(sourceId);
      setDiscoverSources((current) => current.filter((source) => source.id !== sourceId));
      setPreviewSkills([]);
      setSelectedSourceId((current) => (current === sourceId ? '' : current));
      setStatusMessage('Source removed');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function removeProjectRoot(root: AgentRootTarget) {
    const api = window.theOpenHub;
    if (!api?.removeProjectRoot) {
      return;
    }
    try {
      await api.removeProjectRoot({ agentCode: root.agentCode, rootPath: root.rootPath });
      await refreshWorkspace().catch(() => undefined);
      setAgentRoots((current) =>
        current.filter((item) => item.rootPath !== root.rootPath || item.agentCode !== root.agentCode || item.rootKind !== 'project')
      );
      setSelectedTargetRoot((current) => (current === root.rootPath ? '' : current));
      setStatusMessage('Root removed');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function addRoot() {
    const api = window.theOpenHub;
    if (!api || !rootPath.trim()) {
      return;
    }
    try {
      const root = await api.addProjectRoot({
        agentCode: rootAgentCode,
        rootPath: rootPath.trim()
      });
      setAgentRoots((current) => [root, ...current.filter((item) => item.rootPath !== root.rootPath || item.agentCode !== root.agentCode)]);
      setSelectedTargetRoot(root.rootPath);
      setStatusMessage(`Root added: ${root.agentDisplayName}`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function importCandidate(skill: DiscoverSkillPreview): Promise<string | null> {
    const api = window.theOpenHub;
    if (!api) {
      return null;
    }
    try {
      const imported = await api.importLocalFolder(skill.path);
      setImportedCandidates((current) => ({ ...current, [skill.path]: imported.skill.id }));
      await refreshWorkspace().catch(() => undefined);
      setStatusMessage(`Imported ${imported.skill.name}`);
      return imported.skill.id;
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
      return null;
    }
  }

  async function installCandidate(skill: DiscoverSkillPreview) {
    const api = window.theOpenHub;
    const root = agentRoots.find((candidate) => candidate.rootPath === selectedTargetRoot) ?? agentRoots.find((candidate) => candidate.writable);
    if (!api || !root) {
      setStatusMessage('Select a writable root first', 'error');
      return;
    }
    try {
      const skillId = importedCandidates[skill.path] ?? (await importCandidate(skill));
      if (!skillId) {
        return;
      }
      const plan = await api.createInstallPlan({
        skillId,
        targetRoot: root.rootPath,
        agentCode: root.agentCode,
        agentDisplayName: root.agentDisplayName,
        adapterVersion: root.adapterVersion,
        scope: root.scope,
        projectionMode,
        ...(root.rootKind ? { rootKind: root.rootKind } : {})
      });
      if (plan.status === 'conflict') {
        setPendingPlan(plan);
        setStatusMessage('Overwrite confirmation required');
        return;
      }
      if (plan.status === 'blocked') {
        setPendingPlan(null);
        setStatusMessage('Install plan blocked', 'error');
        return;
      }
      const installed = await api.applyInstallPlan(plan, false);
      setInstalledSkillIds((current) => ({ ...current, [installed.skillId]: installed.installationId }));
      await refreshWorkspace();
      setStatusMessage(`Installed ${skill.name}`);
    } catch (error: unknown) {
      setPendingPlan(null);
      setStatusMessage(formatError(error), 'error');
      return;
    }
  }

  async function applyPendingPlan() {
    const api = window.theOpenHub;
    if (!api || !pendingPlan) {
      return;
    }
    try {
      const installed = await api.applyInstallPlan(pendingPlan, true);
      setPendingPlan(null);
      setInstalledSkillIds((current) => ({ ...current, [installed.skillId]: installed.installationId }));
      await refreshWorkspace();
      setStatusMessage(`Installed ${pendingPlan.skillName}`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function uninstallSkill(installationId: string) {
    const api = window.theOpenHub;
    if (!api) {
      return;
    }
    try {
      await api.uninstallSkill(installationId);
      setInstalledSkillIds((current) =>
        Object.fromEntries(Object.entries(current).filter(([, currentInstallationId]) => currentInstallationId !== installationId))
      );
      await refreshWorkspace();
      setStatusMessage('Uninstalled');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  return (
    <main className="screen">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OH</div>
          <div>
            <strong>OpenHub</strong>
            <span>Local skills</span>
          </div>
        </div>
        <nav aria-label="Primary pages" className="nav-list">
          {pageOrder.map((page) => {
            const item = viewModel.navItems.find((navItem) => navItem.key === page);
            const Icon = pageIcons[page];
            return (
              <button
                key={page}
                type="button"
                aria-current={activePage === page ? 'page' : undefined}
                onClick={() => setActivePage(page)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item?.label ?? page}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="app-frame">
        <header className="topbar">
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search skills</span>
            <input
              type="search"
              aria-label="Search skills"
              placeholder="Search skills"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="context-commandbar" role="toolbar" aria-label="Workspace commands">
            <button type="button" onClick={scanRoots}>
              <RefreshCw size={16} aria-hidden="true" />
              Scan roots
            </button>
            <button type="button" onClick={refreshWorkspaceCommand}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <section className="workspace" aria-label={`${titleForPage(activePage)} workspace`}>
          <div className="page-title">
            <div>
              <p>{state.appInfo.phase}</p>
              <h1>{titleForPage(activePage)}</h1>
            </div>
            <span className={statusTone === 'error' ? 'status status-error' : 'status'}>{status}</span>
          </div>

          {activePage === 'home' ? (
            <HomePage metrics={homeMetrics} steps={uxModel.actionSteps} onNavigate={navigateHomeStep} />
          ) : null}
          {activePage === 'skills' ? (
            <SkillsPage
              rows={state.librarySkills}
              searchQuery={query}
              activeTab={skillsTab}
              setActiveTab={setSkillsTab}
              agentRoots={agentRoots}
              discoverSources={discoverSources}
              selectedSourceId={selectedSourceId}
              setSelectedSourceId={setSelectedSourceId}
              previewSkills={previewSkills}
              selectedTargetRoot={selectedTargetRoot}
              setSelectedTargetRoot={setSelectedTargetRoot}
              projectionMode={projectionMode}
              setProjectionMode={setProjectionMode}
              pendingPlan={pendingPlan}
              importedCandidates={importedCandidates}
              installedSkillIds={installedSkillIds}
              installedCandidateNames={installedCandidateNames}
              onPreview={previewSource}
              onImport={importCandidate}
              onInstall={installCandidate}
              onConfirmOverwrite={applyPendingPlan}
              onUninstall={uninstallSkill}
            />
          ) : null}
          {activePage === 'settings' ? (
            <SettingsPage
              roots={agentRoots}
              state={state}
              pluginRegistry={pluginRegistry}
              sourceName={sourceName}
              sourceUrl={sourceUrl}
              setSourceName={setSourceName}
              setSourceUrl={setSourceUrl}
              rootAgentCode={rootAgentCode}
              setRootAgentCode={setRootAgentCode}
              rootPath={rootPath}
              setRootPath={setRootPath}
              discoverSources={discoverSources}
              onAddRoot={addRoot}
              onRemoveRoot={removeProjectRoot}
              onAddSource={addMarketplaceSource}
              onRemoveSource={removeMarketplaceSource}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function HomePage({
  metrics,
  steps,
  onNavigate
}: {
  metrics: ReturnType<typeof createWorkspaceViewModel>['dashboard']['metrics'];
  steps: ReturnType<typeof createWorkspaceUxModel>['actionSteps'];
  onNavigate: (step: ReturnType<typeof createWorkspaceUxModel>['actionSteps'][number]) => void;
}) {
  return (
    <div className="content-grid">
      <section className="metric-grid" aria-label="Workspace metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Start here</h2>
        <div className="steps">
          {steps.map((step) => {
            const descriptionId = `home-step-${step.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <button
                type="button"
                key={step.label}
                aria-label={step.label}
                aria-describedby={descriptionId}
                onClick={() => onNavigate(step)}
              >
                <span>{step.label}</span>
                <small id={descriptionId}>{step.provenance}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SkillsPage({
  rows,
  searchQuery,
  activeTab,
  setActiveTab,
  agentRoots,
  discoverSources,
  selectedSourceId,
  setSelectedSourceId,
  previewSkills,
  selectedTargetRoot,
  setSelectedTargetRoot,
  projectionMode,
  setProjectionMode,
  pendingPlan,
  importedCandidates,
  installedSkillIds,
  installedCandidateNames,
  onPreview,
  onImport,
  onInstall,
  onConfirmOverwrite,
  onUninstall
}: {
  rows: DesktopWorkspaceState['librarySkills'];
  searchQuery: string;
  activeTab: SkillsTabKey;
  setActiveTab: (value: SkillsTabKey) => void;
  agentRoots: AgentRootTarget[];
  discoverSources: DiscoverSource[];
  selectedSourceId: string;
  setSelectedSourceId: (value: string) => void;
  previewSkills: DiscoverSkillPreview[];
  selectedTargetRoot: string;
  setSelectedTargetRoot: (value: string) => void;
  projectionMode: 'copy' | 'symlink';
  setProjectionMode: (value: 'copy' | 'symlink') => void;
  pendingPlan: InstallPlan | null;
  importedCandidates: Record<string, string>;
  installedSkillIds: Record<string, string>;
  installedCandidateNames: Record<string, string>;
  onPreview: () => void;
  onImport: (skill: DiscoverSkillPreview) => Promise<string | null>;
  onInstall: (skill: DiscoverSkillPreview) => void;
  onConfirmOverwrite: () => void;
  onUninstall: (installationId: string) => void;
}) {
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const agentRows = rows.filter((skill) => skill.agentCode === activeTab);
  const visibleAgentRows = normalizedSearchQuery ? agentRows.filter((skill) => skillMatchesSearch(skill, normalizedSearchQuery)) : agentRows;
  const rootGroups = groupByRoot(visibleAgentRows);
  const emptyMessage =
    agentRows.length > 0 && normalizedSearchQuery ? `No skills match "${searchQuery.trim()}"` : 'No indexed skills';

  return (
    <div className="content-grid">
      <div className="tab-list" role="tablist" aria-label="Skill views">
        {agentTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'marketplace' ? (
        <MarketplaceTab
          roots={agentRoots}
          sources={discoverSources}
          selectedSourceId={selectedSourceId}
          setSelectedSourceId={setSelectedSourceId}
          previewSkills={previewSkills}
          searchQuery={searchQuery}
          selectedTargetRoot={selectedTargetRoot}
          setSelectedTargetRoot={setSelectedTargetRoot}
          projectionMode={projectionMode}
          setProjectionMode={setProjectionMode}
          pendingPlan={pendingPlan}
          importedCandidates={importedCandidates}
          installedSkillIds={installedSkillIds}
          installedCandidateNames={installedCandidateNames}
          onPreview={onPreview}
          onImport={onImport}
          onInstall={onInstall}
          onConfirmOverwrite={onConfirmOverwrite}
        />
      ) : (
        <section className="panel">
          <h2>{agentTabs.find((tab) => tab.key === activeTab)?.label} skills</h2>
          {rootGroups.length === 0 ? <p className="empty">{emptyMessage}</p> : null}
          {rootGroups.map((group) => (
            <section className="root-section" key={group.rootPath}>
              <div className="root-header">
                <strong>{group.rootPath}</strong>
                <span>{group.rows.length} skills</span>
              </div>
              <div className="table skills-table" role="table" aria-label={`${group.rootPath} skills`}>
                <div className="table-head" role="row">
                  <span role="columnheader">Name</span>
                  <span role="columnheader">Path</span>
                  <span role="columnheader">State</span>
                  <span role="columnheader">Owner</span>
                  <span role="columnheader">Action</span>
                </div>
                {group.rows.map((skill) => (
                  <div className="table-row" role="row" key={`${skill.id}:${skill.path}`}>
                    <span role="cell">
                      <Star size={15} aria-hidden="true" />
                      {skill.name}
                    </span>
                    <span role="cell">{skill.path}</span>
                    <span role="cell">
                      <span className="tag">{skill.visibilityStatus}</span>
                    </span>
                    <span role="cell">{skill.ownership}</span>
                    <span role="cell">
                      {skill.ownership === 'app-owned' && skill.installationId ? (
                        <button type="button" className="inline-action" onClick={() => onUninstall(skill.installationId!)}>
                          Uninstall
                        </button>
                      ) : (
                        <span className="muted">Indexed</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </div>
  );
}

function MarketplaceTab({
  roots,
  sources,
  selectedSourceId,
  setSelectedSourceId,
  previewSkills,
  searchQuery,
  selectedTargetRoot,
  setSelectedTargetRoot,
  projectionMode,
  setProjectionMode,
  pendingPlan,
  importedCandidates,
  installedSkillIds,
  installedCandidateNames,
  onPreview,
  onImport,
  onInstall,
  onConfirmOverwrite
}: {
  roots: AgentRootTarget[];
  sources: DiscoverSource[];
  selectedSourceId: string;
  setSelectedSourceId: (value: string) => void;
  previewSkills: DiscoverSkillPreview[];
  searchQuery: string;
  selectedTargetRoot: string;
  setSelectedTargetRoot: (value: string) => void;
  projectionMode: 'copy' | 'symlink';
  setProjectionMode: (value: 'copy' | 'symlink') => void;
  pendingPlan: InstallPlan | null;
  importedCandidates: Record<string, string>;
  installedSkillIds: Record<string, string>;
  installedCandidateNames: Record<string, string>;
  onPreview: () => void;
  onImport: (skill: DiscoverSkillPreview) => Promise<string | null>;
  onInstall: (skill: DiscoverSkillPreview) => void;
  onConfirmOverwrite: () => void;
}) {
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const visiblePreviewSkills = normalizedSearchQuery
    ? previewSkills.filter((skill) => candidateMatchesSearch(skill, normalizedSearchQuery))
    : previewSkills;
  const candidateEmptyMessage =
    previewSkills.length > 0 && normalizedSearchQuery ? `No candidates match "${searchQuery.trim()}"` : 'No sources previewed';

  return (
    <div className="split-two">
      <section className="panel">
        <h2>Marketplace</h2>
        <div className="form-grid">
          <label>
            Source
            <select
              aria-label="Marketplace source"
              value={selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
            >
              <option value="">Select source</option>
              {sources.map((source) => (
                <option value={source.id} key={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target root
            <select
              aria-label="Install target root"
              value={selectedTargetRoot}
              onChange={(event) => setSelectedTargetRoot(event.target.value)}
            >
              <option value="">Select root</option>
              {roots.map((root) => (
                <option value={root.rootPath} key={`${root.agentCode}:${root.rootPath}`}>
                  {root.agentDisplayName} - {root.rootPath}
                </option>
              ))}
            </select>
          </label>
          <label>
            Projection mode
            <select
              aria-label="Projection mode"
              value={projectionMode}
              onChange={(event) => setProjectionMode(event.target.value as 'copy' | 'symlink')}
            >
              <option value="copy">copy</option>
              <option value="symlink">symlink</option>
            </select>
          </label>
          <button type="button" onClick={onPreview} disabled={!selectedSourceId}>
            <FolderSearch size={16} aria-hidden="true" />
            Preview source
          </button>
          {pendingPlan ? (
            <div className="conflict-box">
              <strong>{formatConflictCount(pendingPlan)}</strong>
              <button type="button" onClick={onConfirmOverwrite}>
                Confirm overwrite
              </button>
            </div>
          ) : null}
        </div>
      </section>
      <section className="panel">
        <h2>Candidates</h2>
        {sources.length === 0 ? <p className="empty">No marketplace sources</p> : null}
        {visiblePreviewSkills.length === 0 ? <p className="empty">{candidateEmptyMessage}</p> : null}
        <div className="candidate-list">
          {visiblePreviewSkills.map((skill) => {
            const importedSkillId = importedCandidates[skill.path];
            const isInstalled = Boolean(
              installedCandidateNames[skill.name] || (importedSkillId && installedSkillIds[importedSkillId])
            );

            return (
              <article key={skill.path} className="candidate">
                <strong>{skill.name}</strong>
                <span>{skill.path}</span>
                <p>{skill.description}</p>
                <div className="candidate-actions">
                  {isInstalled ? (
                    <span className="tag">Installed</span>
                  ) : (
                    <>
                      {importedSkillId ? (
                        <span className="tag">Imported</span>
                      ) : (
                        <button type="button" onClick={() => void onImport(skill)}>
                          Import
                        </button>
                      )}
                      <button type="button" onClick={() => onInstall(skill)}>
                        Install
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SettingsPage({
  roots,
  state,
  pluginRegistry,
  sourceName,
  sourceUrl,
  setSourceName,
  setSourceUrl,
  rootAgentCode,
  setRootAgentCode,
  rootPath,
  setRootPath,
  discoverSources,
  onAddRoot,
  onRemoveRoot,
  onAddSource,
  onRemoveSource
}: {
  roots: AgentRootTarget[];
  state: DesktopWorkspaceState;
  pluginRegistry: PluginRegistry;
  sourceName: string;
  sourceUrl: string;
  setSourceName: (value: string) => void;
  setSourceUrl: (value: string) => void;
  rootAgentCode: RootAgentCode;
  setRootAgentCode: (value: RootAgentCode) => void;
  rootPath: string;
  setRootPath: (value: string) => void;
  discoverSources: DiscoverSource[];
  onAddRoot: () => void;
  onRemoveRoot: (root: AgentRootTarget) => void;
  onAddSource: () => void;
  onRemoveSource: (sourceId: string) => void;
}) {
  return (
    <div className="split-two">
      <section className="panel">
        <h2>Local roots</h2>
        <div className="form-grid compact-form">
          <label>
            Agent
            <select
              aria-label="Root agent"
              value={rootAgentCode}
              onChange={(event) => setRootAgentCode(event.target.value as RootAgentCode)}
            >
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="opencode">OpenCode</option>
              <option value="agents">Agents</option>
            </select>
          </label>
          <label>
            Root path
            <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} />
          </label>
          <button type="button" onClick={onAddRoot}>
            Add root
          </button>
        </div>
        {roots.length === 0 ? <p className="empty">No local roots</p> : null}
        {roots.map((root) => (
          <div className="key-row three-col" key={`${root.agentCode}:${root.rootPath}:${root.scope}`}>
            <span>{root.agentDisplayName}</span>
            <strong>{root.rootPath}</strong>
            {root.rootKind === 'project' ? (
              <button type="button" className="inline-action" aria-label={`Remove ${root.rootPath}`} onClick={() => onRemoveRoot(root)}>
                Remove
              </button>
            ) : (
              <span className="muted">Detected</span>
            )}
          </div>
        ))}
        <h2>Marketplace sources</h2>
        <div className="form-grid compact-form">
          <label>
            Marketplace source name
            <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
          </label>
          <label>
            Marketplace source URL
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
          </label>
          <button type="button" onClick={onAddSource}>
            Add source
          </button>
        </div>
        {discoverSources.length === 0 ? <p className="empty">No marketplace sources</p> : null}
        {discoverSources.map((source) => (
          <div className="key-row three-col" key={source.id}>
            <span>{source.name}</span>
            <strong>{source.url}</strong>
            <button type="button" className="inline-action" aria-label={`Remove ${source.name}`} onClick={() => onRemoveSource(source.id)}>
              Remove
            </button>
          </div>
        ))}
        <h2>Sync</h2>
        {state.syncCenter.profiles.length === 0 ? <p className="empty">No sync profiles</p> : null}
        {state.syncCenter.profiles.map((profile) => (
          <div className="key-row" key={`${profile.mode}:${profile.status}`}>
            <span>{profile.mode}</span>
            <strong>{profile.status}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Plugins</h2>
        <div className="capability-grid">
          <div>
            <span>Agent adapters</span>
            <strong>{pluginRegistry.agentAdapters.length}</strong>
          </div>
          <div>
            <span>Importers</span>
            <strong>{pluginRegistry.importers.length}</strong>
          </div>
          <div>
            <span>Sync drivers</span>
            <strong>{pluginRegistry.syncDrivers.length}</strong>
          </div>
        </div>
        {state.plugins.plugins.length === 0 ? <p className="empty">No plugins enabled</p> : null}
        {state.plugins.plugins.map((plugin) => (
          <div className="plugin-row" key={plugin.id ?? plugin.name}>
            <Plug size={16} aria-hidden="true" />
            <span>{plugin.name}</span>
            <strong>{plugin.status}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

function titleForPage(page: PageKey): string {
  return {
    home: 'Home',
    skills: 'Skills',
    settings: 'Settings'
  }[page];
}

function groupByRoot(rows: DesktopWorkspaceState['librarySkills']) {
  const groups = new Map<string, DesktopWorkspaceState['librarySkills']>();
  for (const row of rows) {
    const rootPath = row.rootPath;
    groups.set(rootPath, [...(groups.get(rootPath) ?? []), row]);
  }
  return [...groups.entries()].map(([rootPath, groupedRows]) => ({ rootPath, rows: groupedRows }));
}

function skillMatchesSearch(skill: DesktopWorkspaceState['librarySkills'][number], normalizedSearchQuery: string): boolean {
  return [
    skill.name,
    skill.path,
    skill.rootPath,
    skill.sourceAgent,
    skill.agentCode,
    skill.visibilityStatus,
    skill.ownership
  ].some((value) => normalizeSearchText(value).includes(normalizedSearchQuery));
}

function candidateMatchesSearch(skill: DiscoverSkillPreview, normalizedSearchQuery: string): boolean {
  return [skill.name, skill.description, skill.path, ...skill.tags].some((value) =>
    normalizeSearchText(value).includes(normalizedSearchQuery)
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function formatScanStatus(scan: LibraryScanResult): string {
  if (scan.errors.length === 0) {
    return `${scan.indexedSkills.length} indexed`;
  }
  const errorLabel = scan.errors.length === 1 ? '1 error' : `${scan.errors.length} errors`;
  return `${scan.indexedSkills.length} indexed, ${errorLabel}`;
}

function formatConflictCount(plan: InstallPlan): string {
  const conflictCount = plan.writes.filter((write) => write.status === 'conflict').length;
  return conflictCount === 1 ? '1 conflict' : `${conflictCount} conflicts`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
