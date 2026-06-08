import {
  BarChart3,
  Bell,
  CircleHelp,
  FolderSearch,
  Home,
  Library,
  Plug,
  RefreshCw,
  Search,
  Settings,
  Star,
  Store
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

import type {
  AgentRootTarget,
  AppSettings,
  DesktopWorkspaceState,
  DiscoverSkillPreview,
  DiscoverSource,
  InstallPlan,
  LibrarySkillSummary,
  LibraryScanResult,
  PluginRegistry,
  SkillDetail,
  SyncProfile
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
  marketplace: Store,
  skills: Library,
  analytics: BarChart3,
  settings: Settings
} as const;

const agentTabs = [
  { key: 'codex', label: 'Codex' },
  { key: 'claude', label: 'Claude' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'opencode', label: 'OpenCode' },
  { key: 'agents', label: 'Agents' }
] as const;

type SkillsTabKey = (typeof agentTabs)[number]['key'];
type RootAgentCode = 'codex' | 'claude' | 'gemini' | 'opencode' | 'agents';
type SyncProfileMode = 'shared-folder' | 'git';
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
  const [state, setState] = useState<DesktopWorkspaceState>(
    initialState ?? createEmptyWorkspaceState()
  );
  const [agentRoots, setAgentRoots] = useState<AgentRootTarget[]>(initialAgentRoots);
  const [previewSkills, setPreviewSkills] = useState<DiscoverSkillPreview[]>(initialPreviewSkills);
  const [discoverSources, setDiscoverSources] = useState<DiscoverSource[]>([]);
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry>(initialPluginRegistry);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [query, setQuery] = useState('');
  const [skillsTab, setSkillsTab] = useState<SkillsTabKey>('codex');
  const [sourceName, setSourceName] = useState('Local Source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [rootAgentCode, setRootAgentCode] = useState<RootAgentCode>('codex');
  const [rootPath, setRootPath] = useState('');
  const [pluginDirectoryPath, setPluginDirectoryPath] = useState('');
  const [syncMode, setSyncMode] = useState<SyncProfileMode>('shared-folder');
  const [syncRemoteUrl, setSyncRemoteUrl] = useState('');
  const [syncProfileEnabled, setSyncProfileEnabled] = useState(true);
  const [selectedTargetRoot, setSelectedTargetRoot] = useState('');
  const [projectionMode, setProjectionMode] = useState<'copy' | 'symlink'>('copy');
  const [pendingPlan, setPendingPlan] = useState<InstallPlan | null>(null);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<SkillDetail | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [importedCandidates, setImportedCandidates] = useState<Record<string, string>>({});
  const [installedSkillIds, setInstalledSkillIds] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('Ready');
  const [statusTone, setStatusTone] = useState<StatusTone>('default');
  const mountedRef = useRef(true);
  const skillDetailPanelRef = useRef<HTMLElement | null>(null);

  const viewModel = useMemo(() => createWorkspaceViewModel(state), [state]);
  const uxModel = useMemo(
    () =>
      createWorkspaceUxModel({
        state,
        activePage,
        selectedSkillDetail,
        discoverPreviewSkills: previewSkills,
        agentRootTargets: agentRoots
      }),
    [activePage, agentRoots, previewSkills, selectedSkillDetail, state]
  );
  const installedCandidateSourcePaths = useMemo(
    () =>
      state.librarySkills.reduce<Record<string, string>>((installed, skill) => {
        if (skill.ownership === 'app-owned' && skill.installationId && skill.sourceUrl) {
          installed[normalizeSourcePath(skill.sourceUrl)] = skill.installationId;
        }
        return installed;
      }, {}),
    [state.librarySkills]
  );
  const homeMetrics = useMemo(
    () => [
      {
        label: 'Total active skills',
        value: String(state.skills.length || state.librarySkills.length),
        detail: 'Library skills',
        trend: state.librarySkills.length > 0 ? 'Indexed from local roots' : 'No index yet',
        tone: 'blue' as const
      },
      {
        label: 'Indexed root locations',
        value: String(new Set(state.librarySkills.map((skill) => skill.rootPath)).size),
        detail: 'Root locations',
        trend: `${agentRoots.length} detected local root${agentRoots.length === 1 ? '' : 's'}`,
        tone: 'green' as const
      },
      {
        label: 'App-managed skills',
        value: String(
          state.librarySkills.filter((skill) => skill.ownership === 'app-owned').length
        ),
        detail: 'Managed files',
        trend: `${discoverSources.length} marketplace source${discoverSources.length === 1 ? '' : 's'}`,
        tone: 'amber' as const
      }
    ],
    [agentRoots.length, discoverSources.length, state.librarySkills, state.skills.length]
  );

  const setRootsAndSources = useCallback((roots: AgentRootTarget[], sources: DiscoverSource[]) => {
    setAgentRoots(roots);
    setDiscoverSources(sources);
    setSelectedSourceId((current) => current || sources[0]?.id || '');
    setSelectedTargetRoot((current) => {
      const currentRoot = roots.find((root) => root.rootPath === current);
      if (currentRoot?.writable) {
        return current;
      }
      return '';
    });
  }, []);
  const setStatusMessage = useCallback((message: string, tone: StatusTone = 'default') => {
    setStatus(message);
    setStatusTone(tone);
  }, []);
  const openPage = useCallback(
    (page: PageKey) => {
      setActivePage(page);
      if (page === 'skills') {
        setSkillsTab((current) =>
          firstPopulatedAgentTab(
            state.librarySkills.map((skill) => skill.agentCode),
            current
          )
        );
      }
    },
    [state.librarySkills]
  );
  const navigateHomeStep = useCallback(
    (step: ReturnType<typeof createWorkspaceUxModel>['actionSteps'][number]) => {
      setActivePage(step.targetPage);
      if (step.targetPage === 'skills') {
        setSkillsTab((current) =>
          firstPopulatedAgentTab(
            state.librarySkills.map((skill) => skill.agentCode),
            current
          )
        );
      }
    },
    [state.librarySkills]
  );
  const updateSearchQuery = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.trim() && activePage === 'home') {
        const nextPage = firstSearchResultPage(state.librarySkills, previewSkills, value);
        setActivePage(nextPage);
        if (nextPage === 'skills') {
          setSkillsTab((current) => firstSearchResultTab(state.librarySkills, value, current));
        }
      }
    },
    [activePage, previewSkills, state.librarySkills]
  );

  const isInactive = useCallback(
    (isCancelled?: AsyncGuard) => !mountedRef.current || Boolean(isCancelled?.()),
    []
  );

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
        setSkillsTab((current) =>
          firstPopulatedAgentTab(
            scan.indexedSkills.map((skill) => skill.agentCode),
            current
          )
        );
        await refreshWorkspace(isCancelled).catch(() => undefined);
        if (!isInactive(isCancelled)) {
          setStatusMessage(formatScanStatus(scan), scan.errors.length > 0 ? 'error' : 'default');
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
      api.getPluginRegistry?.() ?? Promise.resolve(initialPluginRegistry),
      api.getSettings?.() ?? Promise.resolve(null)
    ])
      .then(([workspace, roots, sources, registry, settings]) => {
        if (cancelled) {
          return;
        }
        setState(workspace);
        setRootsAndSources(roots, sources);
        setPluginRegistry(registry);
        setAppSettings(settings);
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

  useEffect(() => {
    if (!selectedSkillDetail || !window.matchMedia?.('(max-width: 900px)').matches) {
      return;
    }
    skillDetailPanelRef.current?.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'smooth'
    });
  }, [selectedSkillDetail]);

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

  function selectMarketplaceSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setPreviewSkills([]);
    setPendingPlan(null);
  }

  async function previewSource() {
    const api = window.theOpenHub;
    if (!api || !selectedSourceId) {
      return;
    }
    try {
      const preview = await api.previewDiscoverSource(selectedSourceId);
      setPreviewSkills(preview.skills);
      setPendingPlan(null);
      setStatusMessage(`${preview.skills.length} candidates`);
    } catch (error: unknown) {
      setPreviewSkills([]);
      setPendingPlan(null);
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function addMarketplaceSource() {
    const api = window.theOpenHub;
    const trimmedSourceUrl = sourceUrl.trim();
    if (!trimmedSourceUrl) {
      setStatusMessage('Enter a marketplace source URL first', 'error');
      return;
    }
    if (!api) {
      return;
    }
    try {
      const sourceInput = normalizeDiscoverSourceInput(trimmedSourceUrl);
      const source = await api.addDiscoverSource({
        name: sourceName.trim() || 'Local Source',
        sourceType: sourceInput.sourceType,
        url: sourceInput.url
      });
      setDiscoverSources((current) => [source, ...current.filter((item) => item.id !== source.id)]);
      setSelectedSourceId(source.id);
      setPreviewSkills([]);
      setPendingPlan(null);
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
        current.filter(
          (item) =>
            item.rootPath !== root.rootPath ||
            item.agentCode !== root.agentCode ||
            item.rootKind !== 'project'
        )
      );
      setSelectedTargetRoot((current) => (current === root.rootPath ? '' : current));
      setStatusMessage('Root removed');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function setUpdateChecksPreference(enabled: boolean) {
    const api = window.theOpenHub;
    if (!api?.setUpdateChecks) {
      return;
    }
    try {
      const settings = await api.setUpdateChecks(enabled);
      setAppSettings(settings);
      setStatusMessage('Settings updated');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function setLogLevelPreference(logLevel: AppSettings['logLevel']) {
    const api = window.theOpenHub;
    if (!api?.setLogLevel) {
      return;
    }
    try {
      const settings = await api.setLogLevel(logLevel);
      setAppSettings(settings);
      setStatusMessage('Settings updated');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function addRoot() {
    const api = window.theOpenHub;
    const trimmedRootPath = rootPath.trim();
    if (!trimmedRootPath) {
      setStatusMessage('Enter a root path first', 'error');
      return;
    }
    if (!api) {
      return;
    }
    try {
      const root = await api.addProjectRoot({
        agentCode: rootAgentCode,
        rootPath: trimmedRootPath
      });
      setAgentRoots((current) => [
        root,
        ...current.filter(
          (item) => item.rootPath !== root.rootPath || item.agentCode !== root.agentCode
        )
      ]);
      setSelectedTargetRoot(root.rootPath);
      setStatusMessage(`Root added: ${root.agentDisplayName}`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function addSyncProfile() {
    const api = window.theOpenHub;
    const trimmedSyncRemoteUrl = syncRemoteUrl.trim();
    if (!trimmedSyncRemoteUrl) {
      setStatusMessage('Enter a sync remote path first', 'error');
      return;
    }
    if (!api?.createSyncProfile) {
      return;
    }
    try {
      const profile = await api.createSyncProfile({
        mode: syncMode,
        remoteUrl: trimmedSyncRemoteUrl,
        enabled: syncProfileEnabled
      });
      setState((current) => ({
        ...current,
        syncCenter: {
          ...current.syncCenter,
          profiles: upsertSyncCenterProfile(
            current.syncCenter.profiles,
            syncProfileToCenterProfile(profile)
          )
        }
      }));
      setSyncRemoteUrl('');
      setStatusMessage('Sync profile added');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function addPluginDirectory() {
    const api = window.theOpenHub;
    const trimmedPluginDirectoryPath = pluginDirectoryPath.trim();
    if (!trimmedPluginDirectoryPath) {
      setStatusMessage('Enter a plugin directory path first', 'error');
      return;
    }
    if (!api?.addSettingsPluginDirectory) {
      return;
    }
    try {
      const directory = await api.addSettingsPluginDirectory(trimmedPluginDirectoryPath);
      setAppSettings((current) =>
        current
          ? {
              ...current,
              pluginDirectories: upsertPluginDirectory(current.pluginDirectories, directory)
            }
          : current
      );
      setState((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          directories: upsertPluginDirectory(current.plugins.directories, directory)
        }
      }));
      setPluginDirectoryPath('');
      setStatusMessage('Plugin directory added');
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function scanPluginDirectory(directoryId: string) {
    const api = window.theOpenHub;
    if (!api?.scanPluginDirectory) {
      return;
    }
    try {
      const result = await api.scanPluginDirectory(directoryId);
      setAppSettings((current) =>
        current
          ? {
              ...current,
              pluginDirectories: upsertPluginDirectory(current.pluginDirectories, result.directory)
            }
          : current
      );
      setState((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          directories: upsertPluginDirectory(current.plugins.directories, result.directory),
          catalog: replacePluginCatalogForDirectory(
            current.plugins.catalog,
            directoryId,
            result.catalog
          )
        }
      }));
      setStatusMessage(`${result.catalog.length} plugin entries`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function removePluginDirectory(directoryId: string) {
    const api = window.theOpenHub;
    if (!api?.removeSettingsPluginDirectory) {
      return;
    }
    try {
      await api.removeSettingsPluginDirectory(directoryId);
      setAppSettings((current) =>
        current
          ? {
              ...current,
              pluginDirectories: current.pluginDirectories.filter(
                (directory) => directory.id !== directoryId
              )
            }
          : current
      );
      setState((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          directories: current.plugins.directories.filter(
            (directory) => directory.id !== directoryId
          ),
          catalog: current.plugins.catalog.filter((entry) => entry.directoryId !== directoryId)
        }
      }));
      setStatusMessage('Plugin directory removed');
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
    const writableRoots = agentRoots.filter((candidate) => candidate.writable);
    if (!api) {
      return;
    }
    if (writableRoots.length === 0) {
      setStatusMessage('Select a writable root first', 'error');
      return;
    }
    if (!selectedTargetRoot) {
      setStatusMessage('Select an install target root first', 'error');
      return;
    }
    const root = writableRoots.find((candidate) => candidate.rootPath === selectedTargetRoot);
    if (!root) {
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
      setInstalledSkillIds((current) => ({
        ...current,
        [installed.skillId]: installed.installationId
      }));
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
      setInstalledSkillIds((current) => ({
        ...current,
        [installed.skillId]: installed.installationId
      }));
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
      const removedSkillIds = new Set(
        state.librarySkills
          .filter((skill) => skill.installationId === installationId)
          .map((skill) => skill.id)
      );
      setInstalledSkillIds((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([, currentInstallationId]) => currentInstallationId !== installationId
          )
        )
      );
      setState((current) => ({
        ...current,
        librarySkills: current.librarySkills.filter(
          (skill) => skill.installationId !== installationId
        )
      }));
      setSelectedSkillDetail((detail) =>
        detail && removedSkillIds.has(detail.skill.id) ? null : detail
      );
      let refreshFailed = false;
      await refreshWorkspace().catch((error: unknown) => {
        refreshFailed = true;
        setStatusMessage(`Uninstalled; ${formatError(error)}`, 'error');
      });
      if (!refreshFailed) {
        setStatusMessage('Uninstalled');
      }
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function openSkillDetail(skillId: string) {
    const api = window.theOpenHub;
    if (!api?.getSkillDetail) {
      return;
    }
    try {
      const detail = await api.getSkillDetail(skillId);
      setSelectedSkillDetail(detail);
      setStatusMessage(`Opened ${detail.skill.name}`);
    } catch (error: unknown) {
      setStatusMessage(formatError(error), 'error');
    }
  }

  async function toggleFavorite(skill: LibrarySkillSummary) {
    const api = window.theOpenHub;
    if (!api?.setFavorite) {
      return;
    }
    try {
      const updated = await api.setFavorite(skill.id, !skill.favorite);
      const favorite = Boolean(updated.favorite);
      setState((current) => ({
        ...current,
        librarySkills: current.librarySkills.map((item) =>
          item.id === skill.id ? { ...item, favorite } : item
        ),
        skills: current.skills.map((item) => (item.id === skill.id ? { ...item, favorite } : item))
      }));
      setSelectedSkillDetail((current) =>
        current?.skill.id === skill.id
          ? { ...current, skill: { ...current.skill, favorite } }
          : current
      );
      setStatusMessage(favorite ? `Favorited ${updated.name}` : `Unfavorited ${updated.name}`);
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
                aria-label={item?.label ?? page}
                aria-current={activePage === page ? 'page' : undefined}
                onClick={() => openPage(page)}
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
              placeholder={searchPlaceholderForPage(activePage)}
              value={query}
              onChange={(event) => updateSearchQuery(event.target.value)}
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
            <button type="button" className="top-icon-button" aria-label="Notifications">
              <Bell size={18} aria-hidden="true" />
            </button>
            <button type="button" className="top-icon-button" aria-label="Help">
              <CircleHelp size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="workspace" aria-label={`${titleForPage(activePage)} workspace`}>
          <div className="page-title">
            <div>
              <p>
                {state.appInfo.localFirst ? 'Local-first workspace' : state.appInfo.productName}
              </p>
              <h1>{titleForPage(activePage)}</h1>
            </div>
            <span className={statusTone === 'error' ? 'status status-error' : 'status'}>
              {status}
            </span>
          </div>

          {activePage === 'home' ? (
            <HomePage
              metrics={homeMetrics}
              steps={uxModel.actionSteps}
              onNavigate={navigateHomeStep}
            />
          ) : null}
          {activePage === 'marketplace' ? (
            <MarketplacePage
              roots={agentRoots}
              sources={discoverSources}
              selectedSourceId={selectedSourceId}
              setSelectedSourceId={selectMarketplaceSource}
              previewSkills={previewSkills}
              searchQuery={query}
              selectedTargetRoot={selectedTargetRoot}
              setSelectedTargetRoot={setSelectedTargetRoot}
              projectionMode={projectionMode}
              setProjectionMode={setProjectionMode}
              pendingPlan={pendingPlan}
              importedCandidates={importedCandidates}
              installedSkillIds={installedSkillIds}
              installedCandidateSourcePaths={installedCandidateSourcePaths}
              onPreview={previewSource}
              onImport={importCandidate}
              onInstall={installCandidate}
              onConfirmOverwrite={applyPendingPlan}
              onOpenSettings={() => setActivePage('settings')}
            />
          ) : null}
          {activePage === 'skills' ? (
            <SkillsPage
              rows={state.librarySkills}
              searchQuery={query}
              activeTab={skillsTab}
              setActiveTab={setSkillsTab}
              selectedSkillDetail={selectedSkillDetail}
              skillDetailPanelRef={skillDetailPanelRef}
              favoritesOnly={favoritesOnly}
              setFavoritesOnly={setFavoritesOnly}
              onUninstall={uninstallSkill}
              onOpenDetail={openSkillDetail}
              onToggleFavorite={toggleFavorite}
            />
          ) : null}
          {activePage === 'analytics' ? (
            <AnalyticsPage
              state={state}
              roots={agentRoots}
              sources={discoverSources}
              previewSkills={previewSkills}
            />
          ) : null}
          {activePage === 'settings' ? (
            <SettingsPage
              roots={agentRoots}
              state={state}
              pluginRegistry={pluginRegistry}
              appSettings={appSettings}
              sourceName={sourceName}
              sourceUrl={sourceUrl}
              setSourceName={setSourceName}
              setSourceUrl={setSourceUrl}
              rootAgentCode={rootAgentCode}
              setRootAgentCode={setRootAgentCode}
              rootPath={rootPath}
              setRootPath={setRootPath}
              pluginDirectoryPath={pluginDirectoryPath}
              setPluginDirectoryPath={setPluginDirectoryPath}
              syncMode={syncMode}
              setSyncMode={setSyncMode}
              syncRemoteUrl={syncRemoteUrl}
              setSyncRemoteUrl={setSyncRemoteUrl}
              syncProfileEnabled={syncProfileEnabled}
              setSyncProfileEnabled={setSyncProfileEnabled}
              discoverSources={discoverSources}
              onAddRoot={addRoot}
              onRemoveRoot={removeProjectRoot}
              onAddSource={addMarketplaceSource}
              onRemoveSource={removeMarketplaceSource}
              onSetUpdateChecks={setUpdateChecksPreference}
              onSetLogLevel={setLogLevelPreference}
              onAddSyncProfile={addSyncProfile}
              onAddPluginDirectory={addPluginDirectory}
              onScanPluginDirectory={scanPluginDirectory}
              onRemovePluginDirectory={removePluginDirectory}
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
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    trend: string;
    tone: 'blue' | 'green' | 'amber';
  }>;
  steps: ReturnType<typeof createWorkspaceUxModel>['actionSteps'];
  onNavigate: (step: ReturnType<typeof createWorkspaceUxModel>['actionSteps'][number]) => void;
}) {
  const metricIcons = [Library, FolderSearch, Store] as const;
  const readiness = Math.round(
    (steps.filter((step) => step.status === 'done').length / steps.length) * 100
  );

  return (
    <div className="content-grid">
      <section className="metric-grid metric-grid-primary" aria-label="Workspace metrics">
        {metrics.map((metric, index) => {
          const Icon = metricIcons[index] ?? Library;
          return (
            <article className={`metric metric-${metric.tone}`} key={metric.label}>
              <div className="metric-heading">
                <span>{metric.label}</span>
                <span className="metric-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
              </div>
              <strong>{metric.value}</strong>
              <div className="metric-footer">
                <span className="trend-chip">{metric.trend}</span>
                <p>{metric.detail}</p>
              </div>
              {index === 2 ? (
                <div className="metric-progress">
                  <div className="metric-progress-label">
                    <span>Workspace readiness</span>
                    <strong>{readiness}%</strong>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Workspace readiness"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={readiness}
                  >
                    <span style={{ '--progress-value': `${readiness}%` } as CSSProperties} />
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
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
  selectedSkillDetail,
  skillDetailPanelRef,
  favoritesOnly,
  setFavoritesOnly,
  onUninstall,
  onOpenDetail,
  onToggleFavorite
}: {
  rows: DesktopWorkspaceState['librarySkills'];
  searchQuery: string;
  activeTab: SkillsTabKey;
  setActiveTab: (value: SkillsTabKey) => void;
  selectedSkillDetail: SkillDetail | null;
  skillDetailPanelRef: RefObject<HTMLElement | null>;
  favoritesOnly: boolean;
  setFavoritesOnly: (value: boolean) => void;
  onUninstall: (installationId: string) => void;
  onOpenDetail: (skillId: string) => void;
  onToggleFavorite: (skill: LibrarySkillSummary) => void;
}) {
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const favoriteFilteredRows = favoritesOnly ? rows.filter((skill) => skill.favorite) : rows;
  const agentRows = favoriteFilteredRows.filter((skill) => skill.agentCode === activeTab);
  const visibleAgentRows = normalizedSearchQuery
    ? agentRows.filter((skill) => skillMatchesSearch(skill, normalizedSearchQuery))
    : agentRows;
  const visibleSkillIds = new Set(visibleAgentRows.map((skill) => skill.id));
  const visibleSelectedSkillDetail =
    selectedSkillDetail && visibleSkillIds.has(selectedSkillDetail.skill.id)
      ? selectedSkillDetail
      : null;
  const rootGroups = groupByRoot(visibleAgentRows);
  const emptyMessage =
    agentRows.length > 0 && normalizedSearchQuery
      ? `No skills match "${searchQuery.trim()}"`
      : 'No indexed skills';

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

      <>
        <section className="panel">
          <h2>{agentTabs.find((tab) => tab.key === activeTab)?.label} skills</h2>
          <div className="skill-toolbar">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(event) => setFavoritesOnly(event.target.checked)}
              />
              Favorites only
            </label>
          </div>
          {rootGroups.length === 0 ? <p className="empty">{emptyMessage}</p> : null}
          {rootGroups.map((group) => (
            <section className="root-section" key={group.rootPath}>
              <div className="root-header">
                <strong>{group.rootPath}</strong>
                <span>{group.rows.length} skills</span>
              </div>
              <div
                className="table skills-table"
                role="table"
                aria-label={`${group.rootPath} skills`}
              >
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
                      <button
                        type="button"
                        className="icon-action"
                        aria-label={`${skill.favorite ? 'Unfavorite' : 'Favorite'} ${skill.name}`}
                        aria-pressed={Boolean(skill.favorite)}
                        onClick={() => void onToggleFavorite(skill)}
                      >
                        <Star size={15} aria-hidden="true" />
                      </button>
                      <span className="skill-name">{skill.name}</span>
                    </span>
                    <span role="cell">{skill.path}</span>
                    <span role="cell">
                      <span className="tag">{skill.visibilityStatus}</span>
                    </span>
                    <span role="cell">{skill.ownership}</span>
                    <span role="cell">
                      <span className="row-actions">
                        <button
                          type="button"
                          className="inline-action"
                          aria-label={`Open ${skill.name} details`}
                          onClick={() => onOpenDetail(skill.id)}
                        >
                          Details
                        </button>
                        {skill.ownership === 'app-owned' && skill.installationId ? (
                          <button
                            type="button"
                            className="inline-action"
                            aria-label={`Uninstall ${skill.name}`}
                            onClick={() => onUninstall(skill.installationId!)}
                          >
                            Uninstall
                          </button>
                        ) : (
                          <span className="muted">Indexed</span>
                        )}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>
        <SkillDetailPanel
          detail={visibleSelectedSkillDetail}
          detailPanelRef={skillDetailPanelRef}
        />
      </>
    </div>
  );
}

function MarketplacePage(props: {
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
  installedCandidateSourcePaths: Record<string, string>;
  onPreview: () => void;
  onImport: (skill: DiscoverSkillPreview) => Promise<string | null>;
  onInstall: (skill: DiscoverSkillPreview) => void;
  onConfirmOverwrite: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="content-grid">
      <section className="market-hero" aria-label="Marketplace source preview">
        <span>LOCAL / GIT PREVIEW</span>
        <h2>Bring external skills into a managed local workflow.</h2>
        <p>
          Preview a source, inspect candidates, then explicitly import or copy into a writable agent
          root.
        </p>
      </section>
      <div className="market-filters" aria-label="Marketplace filters">
        <span className="chip chip-active">All candidates</span>
        <span className="chip">Local folders</span>
        <span className="chip">Git sources</span>
        <span className="chip">Ready to import</span>
      </div>
      <MarketplaceTab {...props} />
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
  installedCandidateSourcePaths,
  onPreview,
  onImport,
  onInstall,
  onConfirmOverwrite,
  onOpenSettings
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
  installedCandidateSourcePaths: Record<string, string>;
  onPreview: () => void;
  onImport: (skill: DiscoverSkillPreview) => Promise<string | null>;
  onInstall: (skill: DiscoverSkillPreview) => void;
  onConfirmOverwrite: () => void;
  onOpenSettings: () => void;
}) {
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const visiblePreviewSkills = normalizedSearchQuery
    ? previewSkills.filter((skill) => candidateMatchesSearch(skill, normalizedSearchQuery))
    : previewSkills;
  const writableRoots = roots.filter((root) => root.writable);
  const candidateEmptyMessage =
    previewSkills.length > 0 && normalizedSearchQuery
      ? `No candidates match "${searchQuery.trim()}"`
      : 'No sources previewed';
  const showEmptyGuidance =
    sources.length === 0 && previewSkills.length === 0 && !normalizedSearchQuery;

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
              {writableRoots.map((root) => (
                <option value={root.rootPath} key={`${root.agentCode}:${root.rootPath}`}>
                  {root.agentDisplayName} - {root.rootPath}
                </option>
              ))}
            </select>
          </label>
          {selectedTargetRoot ? (
            <code className="selected-path" aria-label="Selected install target path">
              {selectedTargetRoot}
            </code>
          ) : null}
          {writableRoots.length === 0 ? <p className="empty">No writable install roots</p> : null}
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
            <ConflictBox plan={pendingPlan} onConfirmOverwrite={onConfirmOverwrite} />
          ) : null}
        </div>
      </section>
      <section className="panel">
        <h2>Candidates</h2>
        {showEmptyGuidance ? (
          <MarketplaceEmptyGuidance
            sourceCount={sources.length}
            previewCount={previewSkills.length}
            writableRootCount={writableRoots.length}
            onOpenSettings={onOpenSettings}
          />
        ) : (
          <>
            {sources.length === 0 ? <p className="empty">No marketplace sources</p> : null}
            {visiblePreviewSkills.length === 0 ? (
              <p className="empty">{candidateEmptyMessage}</p>
            ) : null}
            <div className="candidate-list marketplace-cards">
              {visiblePreviewSkills.map((skill) => {
                const importedSkillId = importedCandidates[skill.path];
                const isInstalled = Boolean(
                  installedCandidateSourcePaths[normalizeSourcePath(skill.path)] ||
                  (importedSkillId && installedSkillIds[importedSkillId])
                );

                return (
                  <article
                    key={skill.path}
                    className="candidate skill-card"
                    aria-label={skill.name}
                  >
                    <div className="candidate-heading">
                      <strong>{skill.name}</strong>
                      <span className="tag">preview</span>
                    </div>
                    <span>{skill.path}</span>
                    <p>{skill.description}</p>
                    <div className="tag-row" aria-label={`${skill.name} tags`}>
                      {skill.tags.map((tag) => (
                        <span className="tag tag-neutral" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
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
          </>
        )}
      </section>
    </div>
  );
}

function MarketplaceEmptyGuidance({
  sourceCount,
  previewCount,
  writableRootCount,
  onOpenSettings
}: {
  sourceCount: number;
  previewCount: number;
  writableRootCount: number;
  onOpenSettings: () => void;
}) {
  return (
    <div className="market-empty-grid" aria-label="Marketplace setup steps">
      <article className="market-empty-card" aria-label="Add a local source">
        <div className="market-empty-icon">
          <FolderSearch size={22} aria-hidden="true" />
        </div>
        <span className="market-empty-count">{sourceCount} sources</span>
        <h3>Add a local source</h3>
        <p>Point OpenHub at a folder that contains SKILL.md files and inspect it before import.</p>
        <button type="button" onClick={onOpenSettings}>
          Configure sources
        </button>
      </article>
      <article className="market-empty-card" aria-label="Preview a Git source">
        <div className="market-empty-icon market-empty-icon-dark">
          <Store size={22} aria-hidden="true" />
        </div>
        <span className="market-empty-count">{previewCount} previewed</span>
        <h3>Preview a Git source</h3>
        <p>Register a repository URL, preview candidates, then import only the selected skills.</p>
        <button type="button" onClick={onOpenSettings}>
          Add source URL
        </button>
      </article>
      <article className="market-empty-card" aria-label="Choose a writable root">
        <div className="market-empty-icon market-empty-icon-green">
          <Library size={22} aria-hidden="true" />
        </div>
        <span className="market-empty-count">{writableRootCount} writable roots</span>
        <h3>Choose a writable root</h3>
        <p>Copy or symlink selected skills into an app-managed target after preview.</p>
        <button type="button" onClick={onOpenSettings}>
          Configure roots
        </button>
      </article>
    </div>
  );
}

function ConflictBox({
  plan,
  onConfirmOverwrite
}: {
  plan: InstallPlan;
  onConfirmOverwrite: () => void;
}) {
  const conflicts = plan.writes.filter((write) => write.status === 'conflict');
  const visibleConflicts = conflicts.slice(0, 3);
  const hiddenConflictCount = conflicts.length - visibleConflicts.length;

  return (
    <div className="conflict-box">
      <div className="conflict-summary">
        <strong>{formatConflictCount(plan)}</strong>
        <div className="conflict-files" aria-label="Conflicting files">
          {visibleConflicts.map((write) => (
            <code key={write.targetPath}>{write.relativePath}</code>
          ))}
          {hiddenConflictCount > 0 ? <span>+{hiddenConflictCount} more</span> : null}
        </div>
      </div>
      <button type="button" onClick={onConfirmOverwrite}>
        Confirm overwrite
      </button>
    </div>
  );
}

function AnalyticsPage({
  state,
  roots,
  sources,
  previewSkills
}: {
  state: DesktopWorkspaceState;
  roots: AgentRootTarget[];
  sources: DiscoverSource[];
  previewSkills: DiscoverSkillPreview[];
}) {
  const localEvents = buildLocalActivityRows(state, roots, sources, previewSkills);
  const activeCategories = [
    { label: 'Indexed skills', value: state.librarySkills.length, tone: 'blue' },
    { label: 'Agent roots', value: roots.length, tone: 'dark' },
    { label: 'Source candidates', value: previewSkills.length, tone: 'green' }
  ];
  const totalLocalSignals = activeCategories.reduce((total, item) => total + item.value, 0);

  return (
    <div className="content-grid">
      <section className="analytics-toolbar" aria-label="Analytics range">
        <div>
          <strong>Local signal review</strong>
          <span>Derived from local library, roots, source previews, and app-managed changes.</span>
        </div>
        <div className="range-tabs" role="tablist" aria-label="Activity range">
          {['7D', '30D', '3M', '1Y'].map((range) => (
            <button key={range} type="button" role="tab" aria-selected={range === '30D'}>
              {range}
            </button>
          ))}
        </div>
      </section>

      <section className="analytics-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Workspace Activity</h2>
              <p>Local signals across the current workspace.</p>
            </div>
            <strong>{totalLocalSignals}</strong>
          </div>
          <div className="line-chart" aria-label="Local activity trend">
            {[28, 42, 34, 55, 49, 67, 59, 78, 72].map((height, index) => (
              <span key={index} style={{ '--bar-height': `${height}%` } as CSSProperties} />
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Activity by Category</h2>
          <div className="donut-card" aria-label="Local activity category summary">
            <div className="donut-value">
              {activeCategories.filter((item) => item.value > 0).length}
            </div>
            <span>Active local groups</span>
          </div>
          <div className="legend-list">
            {activeCategories.map((item) => (
              <div className="legend-row" key={item.label}>
                <span className={`legend-dot legend-${item.tone}`} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel activity-table-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent Local Events</h2>
            <p>App-observable changes, not skill runtime traces.</p>
          </div>
        </div>
        <div className="activity-table" role="table" aria-label="Recent local activity">
          <div className="activity-row activity-head" role="row">
            <span role="columnheader">Time</span>
            <span role="columnheader">Event</span>
            <span role="columnheader">Category</span>
            <span role="columnheader">State</span>
          </div>
          {localEvents.map((event) => (
            <div className="activity-row" role="row" key={`${event.time}:${event.label}`}>
              <span role="cell">{event.time}</span>
              <span role="cell">{event.label}</span>
              <span role="cell">{event.category}</span>
              <span role="cell">
                <span className="tag">{event.state}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SkillDetailPanel({
  detail,
  detailPanelRef
}: {
  detail: SkillDetail | null;
  detailPanelRef: RefObject<HTMLElement | null>;
}) {
  if (!detail) {
    return (
      <section className="panel detail-panel" aria-label="Skill detail" ref={detailPanelRef}>
        <p className="empty">Select a skill to inspect files and versions.</p>
      </section>
    );
  }

  return (
    <section
      className="panel detail-panel"
      aria-label={`${detail.skill.name} details`}
      ref={detailPanelRef}
    >
      <div className="detail-crumbs" aria-label="Skill detail breadcrumb">
        <span>My Skills</span>
        <span>/</span>
        <strong>{detail.skill.name}</strong>
      </div>
      <div className="detail-hero">
        <div className="detail-glyph">
          <Library size={36} aria-hidden="true" />
        </div>
        <div className="detail-copy">
          <div className="detail-title-row">
            <h2>{detail.skill.name}</h2>
            <span className="tag">Version {detail.skill.versionNo}</span>
          </div>
          <p>{detail.skill.description}</p>
        </div>
      </div>
      <div className="detail-tab-strip" aria-label="Skill detail sections">
        <span aria-current="page">Overview</span>
        <span>Files</span>
        <span>Versions</span>
        <span>Markdown</span>
      </div>
      <div className="detail-columns">
        <div className="detail-main-stack">
          <section className="detail-section">
            <h3>Local Overview</h3>
            <div className="tag-row">
              <span className="tag tag-neutral">{detail.source.url ?? detail.source.type}</span>
              {detail.skill.favorite ? <span className="tag tag-neutral">favorite</span> : null}
              {detail.skill.tags.map((tag) => (
                <span className="tag tag-neutral" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="key-row">
              <span>Source</span>
              <strong>{detail.source.url ?? detail.source.type}</strong>
            </div>
            <div className="key-row">
              <span>Slug</span>
              <strong>{detail.skill.slug}</strong>
            </div>
          </section>
          <section className="detail-section">
            <h3>Files</h3>
            {detail.files.length === 0 ? <p className="empty">No files recorded</p> : null}
            {detail.files.map((file) => (
              <div className="key-row" key={file.relativePath}>
                <span>{file.kind}</span>
                <strong>{file.relativePath}</strong>
              </div>
            ))}
          </section>
          <section className="detail-section">
            <h3>Versions</h3>
            {detail.versions.length === 0 ? <p className="empty">No version history</p> : null}
            {detail.versions.map((version) => (
              <div className="key-row" key={version.versionId}>
                <span>v{version.versionNo}</span>
                <strong>{version.changeSummary || version.createdAt}</strong>
              </div>
            ))}
          </section>
          <section className="detail-section">
            <h3>Skill markdown</h3>
            <pre className="markdown-preview">{detail.skillMarkdown}</pre>
          </section>
        </div>
        <aside className="detail-meta-panel">
          <h3>Skill metadata</h3>
          <div className="key-row">
            <span>Source type</span>
            <strong>{detail.source.type}</strong>
          </div>
          <div className="key-row">
            <span>Version</span>
            <strong>{detail.skill.versionNo}</strong>
          </div>
          <div className="key-row">
            <span>Favorite</span>
            <strong>{detail.skill.favorite ? 'Yes' : 'No'}</strong>
          </div>
          <div className="key-row">
            <span>Tags</span>
            <strong>{detail.skill.tags.length > 0 ? detail.skill.tags.join(', ') : 'None'}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SettingsPage({
  roots,
  state,
  pluginRegistry,
  appSettings,
  sourceName,
  sourceUrl,
  setSourceName,
  setSourceUrl,
  rootAgentCode,
  setRootAgentCode,
  rootPath,
  setRootPath,
  pluginDirectoryPath,
  setPluginDirectoryPath,
  syncMode,
  setSyncMode,
  syncRemoteUrl,
  setSyncRemoteUrl,
  syncProfileEnabled,
  setSyncProfileEnabled,
  discoverSources,
  onAddRoot,
  onRemoveRoot,
  onAddSource,
  onRemoveSource,
  onSetUpdateChecks,
  onSetLogLevel,
  onAddSyncProfile,
  onAddPluginDirectory,
  onScanPluginDirectory,
  onRemovePluginDirectory
}: {
  roots: AgentRootTarget[];
  state: DesktopWorkspaceState;
  pluginRegistry: PluginRegistry;
  appSettings: AppSettings | null;
  sourceName: string;
  sourceUrl: string;
  setSourceName: (value: string) => void;
  setSourceUrl: (value: string) => void;
  rootAgentCode: RootAgentCode;
  setRootAgentCode: (value: RootAgentCode) => void;
  rootPath: string;
  setRootPath: (value: string) => void;
  pluginDirectoryPath: string;
  setPluginDirectoryPath: (value: string) => void;
  syncMode: SyncProfileMode;
  setSyncMode: (value: SyncProfileMode) => void;
  syncRemoteUrl: string;
  setSyncRemoteUrl: (value: string) => void;
  syncProfileEnabled: boolean;
  setSyncProfileEnabled: (value: boolean) => void;
  discoverSources: DiscoverSource[];
  onAddRoot: () => void;
  onRemoveRoot: (root: AgentRootTarget) => void;
  onAddSource: () => void;
  onRemoveSource: (sourceId: string) => void;
  onSetUpdateChecks: (enabled: boolean) => void;
  onSetLogLevel: (logLevel: AppSettings['logLevel']) => void;
  onAddSyncProfile: () => void;
  onAddPluginDirectory: () => void;
  onScanPluginDirectory: (directoryId: string) => void;
  onRemovePluginDirectory: (directoryId: string) => void;
}) {
  const pluginDirectories = appSettings?.pluginDirectories ?? state.plugins.directories;

  return (
    <div className="settings-layout">
      <section className="panel settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <Settings size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>General</h2>
            <p>Desktop preferences backed by local app settings.</p>
          </div>
        </div>
        <div className="settings-subsection">
          <h3>App preferences</h3>
          {appSettings ? (
            <div className="settings-stack">
              <label className="preference-row">
                <span>
                  <strong>Check for updates</strong>
                  <small>Local setting for OpenHub desktop update checks.</small>
                </span>
                <input
                  type="checkbox"
                  aria-label="Check for updates"
                  checked={appSettings.updateChecksEnabled}
                  onChange={(event) => onSetUpdateChecks(event.target.checked)}
                />
              </label>
              <label className="preference-row">
                <span>
                  <strong>Log level</strong>
                  <small>Controls local runtime log filtering.</small>
                </span>
                <select
                  aria-label="Log level"
                  value={appSettings.logLevel}
                  onChange={(event) => onSetLogLevel(event.target.value as AppSettings['logLevel'])}
                >
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </label>
            </div>
          ) : (
            <p className="empty">Local app preferences unavailable</p>
          )}
        </div>
      </section>

      <section className="panel settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <Library size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>Skill Repositories</h2>
            <p>Manage local roots, marketplace preview sources, and sync profiles.</p>
          </div>
        </div>
        <div className="settings-subsection">
          <h3>Local roots</h3>
          <div className="form-grid compact-form settings-fields-three">
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
            <div
              className="key-row three-col"
              key={`${root.agentCode}:${root.rootPath}:${root.scope}`}
            >
              <span>{root.agentDisplayName}</span>
              <strong>{root.rootPath}</strong>
              {root.rootKind === 'project' ? (
                <button
                  type="button"
                  className="inline-action"
                  aria-label={`Remove ${root.rootPath}`}
                  onClick={() => onRemoveRoot(root)}
                >
                  Remove
                </button>
              ) : (
                <span className="muted">Detected</span>
              )}
            </div>
          ))}
        </div>
        <div className="settings-subsection">
          <h3>Marketplace sources</h3>
          <div className="form-grid compact-form settings-fields-three">
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
              <button
                type="button"
                className="inline-action"
                aria-label={`Remove ${source.name}`}
                onClick={() => onRemoveSource(source.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="settings-subsection">
          <h3>Sync</h3>
          <div className="form-grid compact-form settings-fields-four">
            <label>
              Sync mode
              <select
                aria-label="Sync mode"
                value={syncMode}
                onChange={(event) => setSyncMode(event.target.value as SyncProfileMode)}
              >
                <option value="shared-folder">shared-folder</option>
                <option value="git">git</option>
              </select>
            </label>
            <label>
              Sync remote path
              <input
                value={syncRemoteUrl}
                onChange={(event) => setSyncRemoteUrl(event.target.value)}
              />
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                aria-label="Enable sync profile"
                checked={syncProfileEnabled}
                onChange={(event) => setSyncProfileEnabled(event.target.checked)}
              />
              Enable sync profile
            </label>
            <button type="button" onClick={onAddSyncProfile}>
              Add sync profile
            </button>
          </div>
          {state.syncCenter.profiles.length === 0 ? (
            <p className="empty">No sync profiles</p>
          ) : null}
          {state.syncCenter.profiles.map((profile) => (
            <div className="key-row three-col" key={profile.id}>
              <span>{profile.mode}</span>
              <strong>{profile.remoteUrl}</strong>
              <span className="tag">{profile.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <Bell size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>Local Privacy</h2>
            <p>Workspace data remains in the local OpenHub runtime.</p>
          </div>
        </div>
        <div className="settings-privacy-list">
          <div className="preference-row">
            <span>
              <strong>Source previews</strong>
              <small>Local and Git candidates stay in preview until you import a selection.</small>
            </span>
            <span className="settings-value-pill">Explicit</span>
          </div>
          <div className="preference-row">
            <span>
              <strong>Workspace records</strong>
              <small>
                Roots, sources, sync profiles, and plugin paths are read from local state.
              </small>
            </span>
            <span className="settings-value-pill">Local</span>
          </div>
        </div>
      </section>

      <section className="panel settings-card">
        <div className="settings-card-title">
          <span className="settings-icon settings-icon-blue">
            <Plug size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>About</h2>
            <p>{state.appInfo.productName} desktop runtime and extension catalog.</p>
          </div>
          <span className="settings-value-pill">
            {state.appInfo.localFirst ? 'Local-first' : 'App'}
          </span>
        </div>
        <div className="settings-about-row">
          <div>
            <strong>{state.appInfo.productName} Desktop</strong>
            <span>{state.appInfo.phase}</span>
          </div>
          <span className="settings-value-pill">OpenHub</span>
        </div>
        <div className="settings-subsection">
          <h3>Plugins</h3>
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
        </div>
        <div className="settings-subsection">
          <h3>Plugin directories</h3>
          <div className="form-grid compact-form settings-fields-two">
            <label>
              Plugin directory path
              <input
                value={pluginDirectoryPath}
                onChange={(event) => setPluginDirectoryPath(event.target.value)}
              />
            </label>
            <button type="button" onClick={onAddPluginDirectory}>
              Add plugin directory
            </button>
          </div>
          {pluginDirectories.length === 0 ? <p className="empty">No plugin directories</p> : null}
          {pluginDirectories.map((directory) => (
            <div className="key-row three-col" key={directory.id}>
              <span>{directory.status}</span>
              <strong>{directory.rootPath}</strong>
              <span className="row-actions">
                <button
                  type="button"
                  className="inline-action"
                  aria-label={`Scan ${directory.rootPath}`}
                  onClick={() => onScanPluginDirectory(directory.id)}
                >
                  Scan
                </button>
                <button
                  type="button"
                  className="inline-action"
                  aria-label={`Remove ${directory.rootPath}`}
                  onClick={() => onRemovePluginDirectory(directory.id)}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="settings-subsection">
          <h3>Plugin catalog</h3>
          {state.plugins.catalog.length === 0 ? (
            <p className="empty">No plugin catalog entries</p>
          ) : null}
          {state.plugins.catalog.map((entry) => (
            <div className="key-row three-col" key={entry.id}>
              <span>{entry.name}</span>
              <strong>{entry.rootPath}</strong>
              <span className="tag">{entry.installed ? 'Installed' : entry.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function titleForPage(page: PageKey): string {
  return {
    home: 'Dashboard Overview',
    marketplace: 'Marketplace',
    skills: 'My Skills',
    analytics: 'Local Activity Analytics',
    settings: 'Settings'
  }[page];
}

function searchPlaceholderForPage(page: PageKey): string {
  return {
    home: 'Search skills, sources, or settings...',
    marketplace: 'Search marketplace candidates...',
    skills: 'Search skills...',
    analytics: 'Search local activity...',
    settings: 'Search settings...'
  }[page];
}

function firstPopulatedAgentTab(agentCodes: string[], current: SkillsTabKey): SkillsTabKey {
  const populatedAgents = new Set(agentCodes);
  if (populatedAgents.has(current)) {
    return current;
  }

  return agentTabs.find((tab) => populatedAgents.has(tab.key))?.key ?? current;
}

function firstSearchResultTab(
  rows: DesktopWorkspaceState['librarySkills'],
  searchQuery: string,
  current: SkillsTabKey
): SkillsTabKey {
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const matchingAgentTab = agentTabs.find((tab) =>
    rows.some(
      (skill) => skill.agentCode === tab.key && skillMatchesSearch(skill, normalizedSearchQuery)
    )
  );
  if (matchingAgentTab) {
    return matchingAgentTab.key;
  }
  return agentTabs.find((tab) => rows.some((skill) => skill.agentCode === tab.key))?.key ?? current;
}

function firstSearchResultPage(
  rows: DesktopWorkspaceState['librarySkills'],
  previewSkills: DiscoverSkillPreview[],
  searchQuery: string
): PageKey {
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  if (previewSkills.some((skill) => candidateMatchesSearch(skill, normalizedSearchQuery))) {
    return 'marketplace';
  }
  if (rows.some((skill) => skillMatchesSearch(skill, normalizedSearchQuery))) {
    return 'skills';
  }
  return 'skills';
}

function buildLocalActivityRows(
  state: DesktopWorkspaceState,
  roots: AgentRootTarget[],
  sources: DiscoverSource[],
  previewSkills: DiscoverSkillPreview[]
) {
  const rows = [
    {
      time: 'Current session',
      label: `${state.librarySkills.length} indexed skill${state.librarySkills.length === 1 ? '' : 's'}`,
      category: 'Library',
      state: state.librarySkills.length > 0 ? 'Available' : 'Empty'
    },
    {
      time: 'Current session',
      label: `${roots.length} agent root${roots.length === 1 ? '' : 's'} detected`,
      category: 'Roots',
      state: roots.length > 0 ? 'Ready' : 'Pending'
    },
    {
      time: 'Current session',
      label: `${sources.length} marketplace source${sources.length === 1 ? '' : 's'} configured`,
      category: 'Sources',
      state: sources.length > 0 ? 'Configured' : 'Pending'
    },
    {
      time: 'Current session',
      label: `${previewSkills.length} preview candidate${previewSkills.length === 1 ? '' : 's'} visible`,
      category: 'Preview',
      state: previewSkills.length > 0 ? 'Reviewed' : 'Empty'
    },
    {
      time: 'Current session',
      label: `${state.librarySkills.filter((skill) => skill.ownership === 'app-owned').length} app-managed skill${
        state.librarySkills.filter((skill) => skill.ownership === 'app-owned').length === 1
          ? ''
          : 's'
      }`,
      category: 'Managed files',
      state: 'Local'
    }
  ];

  return rows;
}

function groupByRoot(rows: DesktopWorkspaceState['librarySkills']) {
  const groups = new Map<string, DesktopWorkspaceState['librarySkills']>();
  for (const row of rows) {
    const rootPath = row.rootPath;
    groups.set(rootPath, [...(groups.get(rootPath) ?? []), row]);
  }
  return [...groups.entries()].map(([rootPath, groupedRows]) => ({ rootPath, rows: groupedRows }));
}

function upsertPluginDirectory(
  directories: DesktopWorkspaceState['plugins']['directories'],
  directory: DesktopWorkspaceState['plugins']['directories'][number]
) {
  return [directory, ...directories.filter((item) => item.id !== directory.id)];
}

function upsertSyncCenterProfile(
  profiles: DesktopWorkspaceState['syncCenter']['profiles'],
  profile: DesktopWorkspaceState['syncCenter']['profiles'][number]
) {
  return [profile, ...profiles.filter((item) => item.id !== profile.id)];
}

function syncProfileToCenterProfile(
  profile: SyncProfile
): DesktopWorkspaceState['syncCenter']['profiles'][number] {
  return {
    id: profile.id,
    mode: profile.mode,
    remoteUrl: profile.remoteUrl,
    enabled: profile.enabled,
    status: profile.enabled ? 'enabled' : 'disabled'
  };
}

function replacePluginCatalogForDirectory(
  catalog: DesktopWorkspaceState['plugins']['catalog'],
  directoryId: string,
  entries: DesktopWorkspaceState['plugins']['catalog']
) {
  return [...catalog.filter((entry) => entry.directoryId !== directoryId), ...entries];
}

function skillMatchesSearch(
  skill: DesktopWorkspaceState['librarySkills'][number],
  normalizedSearchQuery: string
): boolean {
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

function candidateMatchesSearch(
  skill: DiscoverSkillPreview,
  normalizedSearchQuery: string
): boolean {
  return [skill.name, skill.description, skill.path, ...skill.tags].some((value) =>
    normalizeSearchText(value).includes(normalizedSearchQuery)
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSourcePath(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/[/\\]+$/, '') || trimmed;
}

function formatScanStatus(scan: LibraryScanResult): string {
  if (scan.errors.length === 0) {
    return `${scan.indexedSkills.length} indexed`;
  }
  const errorLabel = scan.errors.length === 1 ? '1 error' : `${scan.errors.length} errors`;
  const firstError = scan.errors[0]!;
  return `${scan.indexedSkills.length} indexed, ${errorLabel}: ${firstError.code} at ${firstError.skillPath} - ${firstError.message}`;
}

function normalizeDiscoverSourceInput(sourceUrl: string): {
  sourceType: 'local' | 'git';
  url: string;
} {
  if (sourceUrl.startsWith('file://')) {
    return { sourceType: 'local', url: fileUrlToLocalPath(sourceUrl) };
  }
  return { sourceType: sourceUrl.includes('://') ? 'git' : 'local', url: sourceUrl };
}

function fileUrlToLocalPath(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'file:') {
      return sourceUrl;
    }
    const localPath = decodeURIComponent(url.pathname);
    if (url.hostname && url.hostname !== 'localhost') {
      return `//${url.hostname}${localPath}`;
    }
    return /^\/[A-Za-z]:\//.test(localPath) ? localPath.slice(1) : localPath;
  } catch {
    return sourceUrl;
  }
}

function formatConflictCount(plan: InstallPlan): string {
  const conflictCount = plan.writes.filter((write) => write.status === 'conflict').length;
  return conflictCount === 1 ? '1 conflict' : `${conflictCount} conflicts`;
}

function formatError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method ['"][^'"]+['"]:\s*/, '')
    .replace(/^Error:\s*/, '');
  return summarizeCommandFailure(message);
}

function summarizeCommandFailure(message: string): string {
  if (!message.startsWith('Command failed:')) {
    return message;
  }
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fatalLine = lines.find((line) => line.startsWith('fatal:'));
  if (fatalLine) {
    return `Command failed: ${fatalLine.replace(/^fatal:\s*/, '')}`;
  }
  const errorLine = lines.find((line) => /^error:/i.test(line));
  if (errorLine) {
    return `Command failed: ${errorLine.replace(/^error:\s*/i, '')}`;
  }
  return lines[0] ?? 'Command failed';
}
