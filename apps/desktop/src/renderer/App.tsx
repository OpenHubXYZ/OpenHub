import { FolderSearch, Home, Library, Plug, RefreshCw, Search, Settings, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type {
  AgentRootTarget,
  DesktopWorkspaceState,
  DiscoverSkillPreview,
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
  inventory: Library,
  sources: FolderSearch,
  settings: Settings
} as const;

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
  initialPluginRegistry = { agentAdapters: [], importers: [], syncDrivers: [] }
}: AppProps) {
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [state, setState] = useState<DesktopWorkspaceState>(initialState ?? createEmptyWorkspaceState());
  const [agentRoots, setAgentRoots] = useState<AgentRootTarget[]>(initialAgentRoots);
  const [previewSkills, setPreviewSkills] = useState<DiscoverSkillPreview[]>(initialPreviewSkills);
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry>(initialPluginRegistry);
  const [query, setQuery] = useState('');
  const [sourceName, setSourceName] = useState('Local Source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    let cancelled = false;
    const api = window.theOpenHub;
    if (!api) {
      return;
    }

    Promise.all([
      api.getWorkspaceState(),
      api.listAgentRoots(),
      api.getPluginRegistry?.() ?? Promise.resolve(initialPluginRegistry)
    ])
      .then(([workspace, roots, registry]) => {
        if (cancelled) {
          return;
        }
        setState(workspace);
        setAgentRoots(roots);
        setPluginRegistry(registry);
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [initialPluginRegistry]);

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
  const inventoryRows = query.trim()
    ? state.librarySkills.filter((skill) => skill.name.toLowerCase().includes(query.trim().toLowerCase()))
    : state.librarySkills;

  async function refreshWorkspace() {
    const workspace = await window.theOpenHub?.getWorkspaceState();
    if (workspace) {
      setState(workspace);
    }
  }

  async function scanRoots() {
    const scan = await window.theOpenHub?.scanAgentRoots();
    if (!scan) {
      return;
    }
    setState((current) => mergeScanIntoWorkspaceState(current, scan));
    await refreshWorkspace().catch(() => undefined);
    setStatus(`${scan.indexedSkills.length} indexed`);
  }

  async function previewSource() {
    const api = window.theOpenHub;
    if (!api || !sourceUrl.trim()) {
      return;
    }
    const source = await api.addDiscoverSource({
      name: sourceName.trim() || 'Local Source',
      sourceType: sourceUrl.includes('://') ? 'git' : 'local',
      url: sourceUrl.trim()
    });
    const preview = await api.previewDiscoverSource(source.id);
    setPreviewSkills(preview.skills);
    setStatus(`${preview.skills.length} candidates`);
  }

  return (
    <main className="screen">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OH</div>
          <div>
            <strong>OpenHub</strong>
            <span>Local inventory</span>
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
            <span className="sr-only">Search inventory</span>
            <input
              type="search"
              aria-label="Search inventory"
              placeholder="Search inventory"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="context-commandbar" role="toolbar" aria-label="Workspace commands">
            <button type="button" onClick={scanRoots}>
              <RefreshCw size={16} aria-hidden="true" />
              Scan roots
            </button>
            <button type="button" onClick={refreshWorkspace}>
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
            <span className="status">{status}</span>
          </div>

          {activePage === 'home' ? (
            <HomePage metrics={viewModel.dashboard.metrics} steps={uxModel.actionSteps} onNavigate={setActivePage} />
          ) : null}
          {activePage === 'inventory' ? <InventoryPage rows={inventoryRows} /> : null}
          {activePage === 'sources' ? (
            <SourcesPage
              sourceName={sourceName}
              sourceUrl={sourceUrl}
              previewSkills={previewSkills}
              setSourceName={setSourceName}
              setSourceUrl={setSourceUrl}
              onPreview={previewSource}
            />
          ) : null}
          {activePage === 'settings' ? (
            <SettingsPage roots={agentRoots} state={state} pluginRegistry={pluginRegistry} />
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
  onNavigate: (page: PageKey) => void;
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
          {steps.map((step) => (
            <button type="button" key={step.label} onClick={() => onNavigate(step.targetPage)}>
              <span>{step.label}</span>
              <small>{step.provenance}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function InventoryPage({ rows }: { rows: DesktopWorkspaceState['librarySkills'] }) {
  return (
    <section className="panel">
      <h2>Indexed skills</h2>
      <div className="table" role="table" aria-label="Inventory skills">
        <div className="table-head" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Agent</span>
          <span role="columnheader">State</span>
        </div>
        {rows.length === 0 ? <p className="empty">No indexed skills</p> : null}
        {rows.map((skill) => (
          <div className="table-row" role="row" key={skill.id}>
            <span role="cell">
              <Star size={15} aria-hidden="true" />
              {skill.name}
            </span>
            <span role="cell">{skill.sourceAgent}</span>
            <span role="cell">
              <span className="tag">{skill.visibilityStatus}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourcesPage({
  sourceName,
  sourceUrl,
  previewSkills,
  setSourceName,
  setSourceUrl,
  onPreview
}: {
  sourceName: string;
  sourceUrl: string;
  previewSkills: DiscoverSkillPreview[];
  setSourceName: (value: string) => void;
  setSourceUrl: (value: string) => void;
  onPreview: () => void;
}) {
  return (
    <div className="split-two">
      <section className="panel">
        <h2>Source preview</h2>
        <div className="form-grid">
          <label>
            Source name
            <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
          </label>
          <label>
            Source URL
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
          </label>
          <button type="button" onClick={onPreview}>
            <FolderSearch size={16} aria-hidden="true" />
            Preview source
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>Candidates</h2>
        {previewSkills.length === 0 ? <p className="empty">No sources previewed</p> : null}
        <div className="candidate-list">
          {previewSkills.map((skill) => (
            <article key={skill.path} className="candidate">
              <strong>{skill.name}</strong>
              <span>{skill.path}</span>
              <p>{skill.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsPage({
  roots,
  state,
  pluginRegistry
}: {
  roots: AgentRootTarget[];
  state: DesktopWorkspaceState;
  pluginRegistry: PluginRegistry;
}) {
  return (
    <div className="split-two">
      <section className="panel">
        <h2>Local roots</h2>
        {roots.length === 0 ? <p className="empty">No local roots</p> : null}
        {roots.map((root) => (
          <div className="key-row" key={`${root.agentCode}:${root.rootPath}`}>
            <span>{root.agentDisplayName}</span>
            <strong>{root.rootPath}</strong>
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
    inventory: 'Inventory',
    sources: 'Sources',
    settings: 'Settings'
  }[page];
}
