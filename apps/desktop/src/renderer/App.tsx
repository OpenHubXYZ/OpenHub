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
  DiscoverSkillPreview,
  DiscoverSource,
  InstallPlan,
  InstallTarget,
  LibrarySkillSummary,
  PluginRegistry,
  PluginsState,
  ReviewCenterState,
  SecurityCenterState,
  SkillDetail,
  SkillSummary,
  SyncProfile,
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
  type TableRow
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
  const [activeTabs, setActiveTabs] = useState<Record<PageKey, string>>(() => ({
    dashboard: firstTabForPage('dashboard'),
    library: firstTabForPage('library'),
    discover: firstTabForPage('discover'),
    installs: firstTabForPage('installs'),
    usage: firstTabForPage('usage'),
    reviews: firstTabForPage('reviews'),
    security: firstTabForPage('security'),
    settings: firstTabForPage('settings')
  }));
  const [importPath, setImportPath] = useState('');
  const [gitImportUrl, setGitImportUrl] = useState('');
  const [zipImportPath, setZipImportPath] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [librarySearchResults, setLibrarySearchResults] = useState<SkillSummary[]>([]);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<SkillDetail | null>(null);
  const [exportDirectory, setExportDirectory] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [lastCollectionId, setLastCollectionId] = useState('');
  const [collectionDirectory, setCollectionDirectory] = useState('');
  const [collectionPackageDirectory, setCollectionPackageDirectory] = useState('');
  const [installTargetRoot, setInstallTargetRoot] = useState('');
  const [installProjectionMode, setInstallProjectionMode] = useState<InstallPlan['projectionMode']>('copy');
  const [installTargets, setInstallTargets] = useState<InstallTarget[]>([]);
  const [activeInstallPlan, setActiveInstallPlan] = useState<InstallPlan | null>(null);
  const [lastInstallationId, setLastInstallationId] = useState('');
  const [rollbackVersionId, setRollbackVersionId] = useState('');
  const [exemptionReason, setExemptionReason] = useState('');
  const [lastExemptionId, setLastExemptionId] = useState('');
  const [syncRemoteUrl, setSyncRemoteUrl] = useState('');
  const [syncMode, setSyncMode] = useState<'shared-folder' | 'git' | 'rest' | 'mock-rest'>('shared-folder');
  const [syncProfile, setSyncProfile] = useState<SyncProfile | null>(null);
  const [pluginRootPath, setPluginRootPath] = useState('');
  const [pluginId, setPluginId] = useState('');
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry | null>(null);
  const [discoverSourceName, setDiscoverSourceName] = useState('');
  const [discoverSourceUrl, setDiscoverSourceUrl] = useState('');
  const [discoverSource, setDiscoverSource] = useState<DiscoverSource | null>(null);
  const [discoverPreviewSkills, setDiscoverPreviewSkills] = useState<DiscoverSkillPreview[]>([]);
  const [migrationSourcePath, setMigrationSourcePath] = useState('');
  const [operationMessage, setOperationMessage] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const viewModel = useMemo(() => createWorkspaceViewModel(workspaceState), [workspaceState]);

  const applyWorkspaceState = useCallback((state: DesktopWorkspaceState) => {
    setWorkspaceState(state);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspaceState(): Promise<void> {
      if (window.theOpenHub?.getWorkspaceState) {
        const runtimeState = await window.theOpenHub.getWorkspaceState();
        if (cancelled) {
          return;
        }

        if (
          runtimeState.librarySkills.length === 0 &&
          runtimeState.skills.length === 0 &&
          window.theOpenHub.scanAgentRoots
        ) {
          const scan = await window.theOpenHub.scanAgentRoots();
          const refreshedState = await window.theOpenHub.getWorkspaceState();
          if (!cancelled) {
            setWorkspaceState(mergeScanIntoWorkspaceState(refreshedState, scan));
          }
          return;
        }

        applyWorkspaceState(runtimeState);
        return;
      }

      if (initialLibrarySkills.length > 0 || !window.theOpenHub?.listLibrarySkills) {
        return;
      }

      const librarySkills = await window.theOpenHub.listLibrarySkills();
      if (!cancelled) {
        setWorkspaceState((current) => ({ ...current, librarySkills }));
      }
    }

    void hydrateWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [applyWorkspaceState, initialLibrarySkills.length]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateInstallTargets(): Promise<void> {
      if (!window.theOpenHub?.listInstallTargets) {
        return;
      }

      const targets = await window.theOpenHub.listInstallTargets();
      if (!cancelled) {
        setInstallTargets(targets);
        setInstallTargetRoot((current) => current || targets[0]?.rootPath || '');
      }
    }

    void hydrateInstallTargets();
    return () => {
      cancelled = true;
    };
  }, []);

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
    setSelectedSkillDetail(null);
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
    setOperationMessage(`Imported ${imported.skill.name}`);
  }

  async function handleImportGit(): Promise<void> {
    if (!window.theOpenHub?.importGit || gitImportUrl.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importGit(gitImportUrl.trim());
    setWorkspaceState((current) => ({
      ...current,
      skills: [imported.skill, ...current.skills.filter((skill) => skill.id !== imported.skill.id)],
      managementFlow: {
        ...current.managementFlow,
        importItems: [{ label: imported.skill.name, status: 'git imported' }, ...current.managementFlow.importItems].slice(0, 8)
      }
    }));
    setOperationMessage(`Git import ${imported.skill.name}`);
  }

  async function handleImportZip(): Promise<void> {
    if (!window.theOpenHub?.importZip || zipImportPath.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importZip(zipImportPath.trim());
    setWorkspaceState((current) => ({
      ...current,
      skills: [imported.skill, ...current.skills.filter((skill) => skill.id !== imported.skill.id)],
      managementFlow: {
        ...current.managementFlow,
        importItems: [{ label: imported.skill.name, status: 'zip imported' }, ...current.managementFlow.importItems].slice(0, 8)
      }
    }));
    setOperationMessage(`ZIP import ${imported.skill.name}`);
  }

  async function handleSearchLibrary(): Promise<void> {
    if (!window.theOpenHub?.searchLibrary || librarySearchQuery.trim().length === 0) {
      setLibrarySearchResults([]);
      return;
    }

    setLibrarySearchResults(await window.theOpenHub.searchLibrary(librarySearchQuery.trim()));
  }

  async function handleSelectSkill(skillId: string): Promise<void> {
    if (!window.theOpenHub?.getSkillDetail) {
      return;
    }

    const detail = await window.theOpenHub.getSkillDetail(skillId);
    setSelectedSkillDetail(detail);
    setRollbackVersionId(detail.versions.at(-1)?.versionId ?? '');
    setLastInstallationId(detail.installations[0]?.installationId ?? lastInstallationId);
  }

  async function handleExportSkill(): Promise<void> {
    const skill = selectedSkillDetail?.skill ?? workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.exportSkill || exportDirectory.trim().length === 0) {
      return;
    }

    const exported = await window.theOpenHub.exportSkill(skill.id, exportDirectory.trim());
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        importItems: [{ label: skill.name, status: `exported ${exported.outputDirectory}` }, ...current.managementFlow.importItems].slice(0, 8)
      }
    }));
    setOperationMessage(`Exported ${skill.name}`);
  }

  async function handleCreateCollection(): Promise<void> {
    if (!window.theOpenHub?.createCollection || collectionName.trim().length === 0 || workspaceState.skills.length === 0) {
      return;
    }

    const collection = await window.theOpenHub.createCollection({
      name: collectionName.trim(),
      description: '',
      skillIds: workspaceState.skills.map((skill) => skill.id)
    });
    setLastCollectionId(collection.id);
    setWorkspaceState((current) => ({
      ...current,
      governance: {
        ...current.governance,
        collections: [{ name: collection.name, skillCount: workspaceState.skills.length }, ...current.governance.collections]
      }
    }));
    setOperationMessage(`Created collection ${collection.name}`);
  }

  async function handleExportCollection(): Promise<void> {
    if (!lastCollectionId || !window.theOpenHub?.exportCollection || collectionDirectory.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.exportCollection(lastCollectionId, collectionDirectory.trim());
    setOperationMessage(`Exported collection ${result.outputDirectory}`);
  }

  async function handleImportCollection(): Promise<void> {
    if (!window.theOpenHub?.importCollection || collectionPackageDirectory.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.importCollection(collectionPackageDirectory.trim());
    setWorkspaceState((current) => ({
      ...current,
      skills: [...result.skills, ...current.skills],
      governance: {
        ...current.governance,
        collections: [{ name: result.collection.name, skillCount: result.skills.length }, ...current.governance.collections]
      }
    }));
    setOperationMessage(`Imported collection ${result.collection.name}`);
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
    const skill = selectedSkillDetail?.skill ?? workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.createInstallPlan || installTargetRoot.trim().length === 0) {
      return;
    }
    const selectedTarget = installTargets.find((target) => target.rootPath === installTargetRoot.trim());

    const plan = await window.theOpenHub.createInstallPlan({
      skillId: skill.id,
      targetRoot: installTargetRoot.trim(),
      agentCode: selectedTarget?.agentCode ?? 'codex',
      agentDisplayName: selectedTarget?.agentDisplayName ?? 'Codex',
      adapterVersion: selectedTarget?.adapterVersion ?? 'builtin',
      scope: selectedTarget?.scope ?? 'user',
      rootKind: selectedTarget?.rootKind ?? (selectedTarget?.scope === 'project' ? 'project' : 'user'),
      projectionMode: installProjectionMode
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
    setLastInstallationId(result.installationId ?? '');
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        installResult: {
          status: result.status,
          message: `${result.status === 'exported' ? 'Exported' : 'Installed'} ${activeInstallPlan.writes.length} files by ${activeInstallPlan.projectionMode} projection.`
        }
      }
    }));
    setOperationMessage(`${result.status === 'exported' ? 'Exported' : 'Installed'} ${activeInstallPlan.skillName}`);
  }

  async function handleUninstall(): Promise<void> {
    if (!window.theOpenHub?.uninstall || lastInstallationId.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.uninstall(lastInstallationId.trim());
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        installResult: {
          status: result.status,
          message: `Uninstalled app-owned files for ${result.installationId}.`
        }
      }
    }));
    setOperationMessage(`Uninstalled ${result.installationId}`);
  }

  async function handleRollback(): Promise<void> {
    if (!window.theOpenHub?.rollbackVersion || lastInstallationId.trim().length === 0 || rollbackVersionId.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.rollbackVersion(lastInstallationId.trim(), rollbackVersionId.trim());
    setOperationMessage(`Rolled back ${result.installationId}`);
  }

  async function handleSecurityScan(): Promise<void> {
    const skill = workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.scanSkill) {
      return;
    }

    const scan = await window.theOpenHub.scanSkill(skill.id);
    const refreshed = window.theOpenHub.getWorkspaceState ? await window.theOpenHub.getWorkspaceState() : null;
    setWorkspaceState((current) => ({
      ...(refreshed ?? current),
      securityCenter: {
        ...(refreshed?.securityCenter ?? current.securityCenter),
        queue:
          refreshed?.securityCenter.queue ?? [
            { skillName: skill.name, status: scan.blocked ? 'blocked' : 'passed' },
            ...current.securityCenter.queue
          ],
        riskScore: refreshed?.securityCenter.riskScore ?? scan.score,
        level: refreshed?.securityCenter.level ?? scan.level,
        findings:
          refreshed?.securityCenter.findings ??
          scan.findings.map((finding) => ({
            ruleName: finding.ruleName,
            severity: finding.severity
          })),
        history: refreshed?.securityCenter.history ?? [
          { skillName: skill.name, level: scan.level },
          ...current.securityCenter.history
        ]
      }
    }));
  }

  async function handleSecurityRescanAll(): Promise<void> {
    if (!window.theOpenHub?.rescanSecurity) {
      return;
    }

    const scans = await window.theOpenHub.rescanSecurity(workspaceState.skills.map((skill) => skill.id));
    setOperationMessage(`Rescanned ${scans.length} skills`);
    const refreshed = window.theOpenHub.getWorkspaceState ? await window.theOpenHub.getWorkspaceState() : null;
    if (refreshed) {
      applyWorkspaceState(refreshed);
    }
  }

  async function handleCreateExemption(): Promise<void> {
    const skill = selectedSkillDetail?.skill ?? workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.createSecurityExemption || exemptionReason.trim().length === 0) {
      return;
    }

    const exemption = await window.theOpenHub.createSecurityExemption({
      skillId: skill.id,
      scope: 'user',
      reason: exemptionReason.trim()
    });
    setLastExemptionId(exemption.id);
    setWorkspaceState((current) => ({
      ...current,
      securityCenter: {
        ...current.securityCenter,
        exemptions: [
          { skillName: skill.name, scope: exemption.scope, reason: exemption.reason },
          ...current.securityCenter.exemptions
        ]
      }
    }));
    setOperationMessage(`Created exemption for ${skill.name}`);
  }

  async function handleRevokeExemption(): Promise<void> {
    if (!window.theOpenHub?.revokeSecurityExemption || lastExemptionId.trim().length === 0) {
      return;
    }

    await window.theOpenHub.revokeSecurityExemption(lastExemptionId.trim());
    setWorkspaceState((current) => ({
      ...current,
      securityCenter: {
        ...current.securityCenter,
        exemptions: current.securityCenter.exemptions.slice(1)
      }
    }));
    setOperationMessage(`Revoked exemption ${lastExemptionId}`);
  }

  async function handleCreateSyncProfile(): Promise<void> {
    if (!window.theOpenHub?.createSyncProfile || syncRemoteUrl.trim().length === 0) {
      return;
    }

    const profile = await window.theOpenHub.createSyncProfile({
      mode: syncMode,
      remoteUrl: syncRemoteUrl.trim(),
      enabled: true
    });
    setSyncProfile(profile);
    setWorkspaceState((current) => ({
      ...current,
      syncCenter: {
        ...current.syncCenter,
        profiles: [{ mode: profile.mode, status: profile.enabled ? 'enabled' : 'disabled' }, ...current.syncCenter.profiles]
      }
    }));
    setOperationMessage(`Created sync profile ${profile.mode}`);
  }

  async function handleSyncPushPull(): Promise<void> {
    const skill = workspaceState.skills[0];
    if (!syncProfile || !skill || !window.theOpenHub?.enqueueSyncLocalChange || !window.theOpenHub.pushSync || !window.theOpenHub.pullSync) {
      return;
    }

    const outbox = await window.theOpenHub.enqueueSyncLocalChange({
      profileId: syncProfile.id,
      entityType: 'skill_version',
      entityId: skill.versionId,
      payload: { skillId: skill.id, versionNo: skill.versionNo }
    });
    await window.theOpenHub.pushSync(syncProfile.id);
    const inbox = await window.theOpenHub.pullSync(syncProfile.id);
    setWorkspaceState((current) => ({
      ...current,
      syncCenter: {
        ...current.syncCenter,
        outbox: [{ entityType: outbox.entityType, status: 'sent' }, ...current.syncCenter.outbox],
        inbox: [...inbox.map((item) => ({ entityType: item.entityType, status: item.status })), ...current.syncCenter.inbox]
      }
    }));
    setOperationMessage(`Synced ${syncProfile.mode}`);
  }

  async function handleInstallPlugin(): Promise<void> {
    if (!window.theOpenHub?.installPlugin || pluginRootPath.trim().length === 0) {
      return;
    }

    const plugin = await window.theOpenHub.installPlugin(pluginRootPath.trim());
    setPluginId(plugin.id);
    setWorkspaceState((current) => ({
      ...current,
      plugins: {
        plugins: [
          {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            rootPath: plugin.rootPath,
            status: plugin.status,
            capabilities: [],
            permissions: [],
            errors: []
          },
          ...current.plugins.plugins
        ]
      }
    }));
    setOperationMessage(`Installed plugin ${plugin.name}`);
  }

  async function handleAuthorizePlugin(): Promise<void> {
    if (!window.theOpenHub?.authorizePluginPermission || pluginId.trim().length === 0) {
      return;
    }

    await window.theOpenHub.authorizePluginPermission({
      pluginId: pluginId.trim(),
      permission: 'network:fetch',
      reason: 'User authorized from Settings'
    });
    setOperationMessage(`Authorized plugin ${pluginId}`);
  }

  async function handleEnablePlugin(): Promise<void> {
    if (!window.theOpenHub?.enablePlugin || pluginId.trim().length === 0) {
      return;
    }

    const registry = await window.theOpenHub.enablePlugin(pluginId.trim());
    setPluginRegistry(registry);
    setOperationMessage(`Enabled plugin ${pluginId}`);
  }

  async function handleDisablePlugin(): Promise<void> {
    if (!window.theOpenHub?.disablePlugin || !window.theOpenHub.getPluginRegistry || pluginId.trim().length === 0) {
      return;
    }

    await window.theOpenHub.disablePlugin(pluginId.trim());
    setPluginRegistry(await window.theOpenHub.getPluginRegistry());
    setOperationMessage(`Disabled plugin ${pluginId}`);
  }

  async function handleAddDiscoverSource(): Promise<void> {
    if (!window.theOpenHub?.addDiscoverSource || discoverSourceName.trim().length === 0 || discoverSourceUrl.trim().length === 0) {
      return;
    }

    const source = await window.theOpenHub.addDiscoverSource({
      name: discoverSourceName.trim(),
      sourceType: 'local',
      url: discoverSourceUrl.trim(),
      trustLevel: 'verified'
    });
    setDiscoverSource(source);
    setOperationMessage(`Added source ${source.name}`);
  }

  async function handlePreviewDiscoverSource(): Promise<void> {
    if (!discoverSource || !window.theOpenHub?.previewDiscoverSource) {
      return;
    }

    const preview = await window.theOpenHub.previewDiscoverSource(discoverSource.id);
    setDiscoverSource(preview.source);
    setDiscoverPreviewSkills(preview.skills);
    setOperationMessage(`Previewed ${preview.skills.length} skills`);
  }

  async function handlePreviewMigration(): Promise<void> {
    if (!window.theOpenHub?.previewMigration || migrationSourcePath.trim().length === 0) {
      return;
    }

    const preview = await window.theOpenHub.previewMigration({
      adapter: 'openskills',
      sourcePath: migrationSourcePath.trim()
    });
    setDiscoverPreviewSkills(preview.skills);
    setOperationMessage(`Migration preview ${preview.skills.length} skills`);
  }

  const pageLabel = viewModel.navItems.find((item) => item.key === activePage)?.label ?? 'Dashboard';
  const activeTab = activeTabs[activePage] ?? firstTabForPage(activePage);

  function handleNavigate(page: PageKey): void {
    setActivePage(page);
    setActiveTabs((current) => ({
      ...current,
      [page]: current[page] ?? firstTabForPage(page)
    }));
  }

  function handleSelectTab(tab: string): void {
    setActiveTabs((current) => ({
      ...current,
      [activePage]: tab
    }));
  }

  return (
    <main className="screen">
      <Sidebar activePage={activePage} navItems={viewModel.navItems} onNavigate={handleNavigate} />
      <section className="app-frame" aria-label="OpenHub workspace">
        <Topbar searchRef={searchRef} />
        <section className="content">
          <div className="workbench">
            <section className="main-pane" aria-label={`${pageLabel} workspace`}>
              <Tabs activePage={activePage} activeTab={activeTab} onSelectTab={handleSelectTab} />
              <Filters activePage={activePage} />
              <div className="main-pad">
                <PageContent
                  activePage={activePage}
                  activeTab={activeTab}
                  activeInstallPlan={activeInstallPlan}
                  collectionDirectory={collectionDirectory}
                  collectionName={collectionName}
                  collectionPackageDirectory={collectionPackageDirectory}
                  discoverPreviewSkills={discoverPreviewSkills}
                  discoverSource={discoverSource}
                  discoverSourceName={discoverSourceName}
                  discoverSourceUrl={discoverSourceUrl}
                  exemptionReason={exemptionReason}
                  exportDirectory={exportDirectory}
                  gitImportUrl={gitImportUrl}
                  hasImportBridge={Boolean(window.theOpenHub?.importLocalFolder)}
                  hasInstallBridge={Boolean(window.theOpenHub?.createInstallPlan)}
                  hasScanBridge={Boolean(window.theOpenHub?.scanAgentRoots)}
                  hasSecurityBridge={Boolean(window.theOpenHub?.scanSkill)}
                  installTargets={installTargets}
                  installProjectionMode={installProjectionMode}
                  importPath={importPath}
                  installTargetRoot={installTargetRoot}
                  lastInstallationId={lastInstallationId}
                  librarySearchQuery={librarySearchQuery}
                  librarySearchResults={librarySearchResults}
                  migrationSourcePath={migrationSourcePath}
                  onAddDiscoverSource={() => {
                    void handleAddDiscoverSource();
                  }}
                  onApplyInstallPlan={() => {
                    void handleApplyInstallPlan();
                  }}
                  onAuthorizePlugin={() => {
                    void handleAuthorizePlugin();
                  }}
                  onCollectionDirectoryChange={setCollectionDirectory}
                  onCollectionNameChange={setCollectionName}
                  onCollectionPackageDirectoryChange={setCollectionPackageDirectory}
                  onCreateInstallPlan={() => {
                    void handleCreateInstallPlan();
                  }}
                  onCreateCollection={() => {
                    void handleCreateCollection();
                  }}
                  onCreateExemption={() => {
                    void handleCreateExemption();
                  }}
                  onCreateSyncProfile={() => {
                    void handleCreateSyncProfile();
                  }}
                  onDisablePlugin={() => {
                    void handleDisablePlugin();
                  }}
                  onDiscoverSourceNameChange={setDiscoverSourceName}
                  onDiscoverSourceUrlChange={setDiscoverSourceUrl}
                  onEnablePlugin={() => {
                    void handleEnablePlugin();
                  }}
                  onExemptionReasonChange={setExemptionReason}
                  onExportCollection={() => {
                    void handleExportCollection();
                  }}
                  onExportDirectoryChange={setExportDirectory}
                  onExportSkill={() => {
                    void handleExportSkill();
                  }}
                  onGitImportUrlChange={setGitImportUrl}
                  onImportCollection={() => {
                    void handleImportCollection();
                  }}
                  onImportGit={() => {
                    void handleImportGit();
                  }}
                  onImportLocalFolder={() => {
                    void handleImportLocalFolder();
                  }}
                  onImportPathChange={setImportPath}
                  onImportZip={() => {
                    void handleImportZip();
                  }}
                  onInstallPlugin={() => {
                    void handleInstallPlugin();
                  }}
                  onInstallProjectionModeChange={setInstallProjectionMode}
                  onInstallTargetRootChange={setInstallTargetRoot}
                  onLibrarySearch={() => {
                    void handleSearchLibrary();
                  }}
                  onLibrarySearchQueryChange={setLibrarySearchQuery}
                  onMigrationSourcePathChange={setMigrationSourcePath}
                  onPluginRootPathChange={setPluginRootPath}
                  onPreviewDiscoverSource={() => {
                    void handlePreviewDiscoverSource();
                  }}
                  onPreviewMigration={() => {
                    void handlePreviewMigration();
                  }}
                  onRevokeExemption={() => {
                    void handleRevokeExemption();
                  }}
                  onRollback={() => {
                    void handleRollback();
                  }}
                  onRollbackVersionIdChange={setRollbackVersionId}
                  onScanAgentRoots={() => {
                    void handleScanAgentRoots();
                  }}
                  onSecurityScan={() => {
                    void handleSecurityScan();
                  }}
                  onSecurityRescanAll={() => {
                    void handleSecurityRescanAll();
                  }}
                  onSelectSkill={(skillId) => {
                    void handleSelectSkill(skillId);
                  }}
                  onSyncModeChange={setSyncMode}
                  onSyncPushPull={() => {
                    void handleSyncPushPull();
                  }}
                  onSyncRemoteUrlChange={setSyncRemoteUrl}
                  onUninstall={() => {
                    void handleUninstall();
                  }}
                  onZipImportPathChange={setZipImportPath}
                  operationMessage={operationMessage}
                  pluginRegistry={pluginRegistry}
                  pluginRootPath={pluginRootPath}
                  rollbackVersionId={rollbackVersionId}
                  selectedSkillDetail={selectedSkillDetail}
                  syncMode={syncMode}
                  syncProfile={syncProfile}
                  syncRemoteUrl={syncRemoteUrl}
                  viewModel={viewModel}
                  workspaceState={workspaceState}
                  zipImportPath={zipImportPath}
                />
              </div>
            </section>
            <RightRail activePage={activePage} viewModel={viewModel} />
          </div>
        </section>
        <Statusbar
          agentRoots={viewModel.dashboard.agentRoots}
          databasePath={viewModel.databasePath}
          lastScanLabel={viewModel.lastScanLabel}
        />
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
        <div className="brand-title">
          OpenHub <span className="version-pill">v0.9.0</span>
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

function Statusbar({
  agentRoots,
  databasePath,
  lastScanLabel
}: {
  agentRoots: AgentRootView[];
  databasePath: string;
  lastScanLabel: string;
}): ReactElement {
  return (
    <footer className="statusbar" role="contentinfo">
      <div className="status-group">
        <div className="status-item truncate">
          <Database aria-hidden="true" className="small-icon" />
          DB: {databasePath}
        </div>
      </div>
      <div className="status-group">
        <div className="status-item">Indexed roots:</div>
        {agentRoots.length > 0 ? (
          agentRoots.slice(0, 4).map((root) => (
            <div className="status-item" key={`${root.agent}:${root.path}`}>
              <span className={`agent-dot ${agentTone(root.agent)}`}>{root.agent.slice(0, 1)}</span>
              {root.agent} {root.status}
            </div>
          ))
        ) : (
          <div className="status-item">None indexed</div>
        )}
      </div>
      <div className="status-group status-right">
        <div className="status-item">{lastScanLabel}</div>
        <div className="status-item">SQLite source of truth</div>
        <div className="status-item">Offline by default</div>
      </div>
    </footer>
  );
}

function Tabs({
  activePage,
  activeTab,
  onSelectTab
}: {
  activePage: PageKey;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}): ReactElement {
  return (
    <div className="tabs" role="tablist" aria-label={`${labelForPage(activePage)} sections`}>
      {pageTabs[activePage].map((tab) => (
        <button
          aria-selected={activeTab === tab}
          className={`tab ${activeTab === tab ? 'active' : ''}`}
          key={tab}
          onClick={() => onSelectTab(tab)}
          role="tab"
          type="button"
        >
          {tab}
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

type PageContentProps = {
  activePage: PageKey;
  activeTab: string;
  activeInstallPlan: InstallPlan | null;
  collectionDirectory: string;
  collectionName: string;
  collectionPackageDirectory: string;
  discoverPreviewSkills: DiscoverSkillPreview[];
  discoverSource: DiscoverSource | null;
  discoverSourceName: string;
  discoverSourceUrl: string;
  exemptionReason: string;
  exportDirectory: string;
  gitImportUrl: string;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  hasSecurityBridge: boolean;
  installTargets: InstallTarget[];
  installProjectionMode: InstallPlan['projectionMode'];
  importPath: string;
  installTargetRoot: string;
  lastInstallationId: string;
  librarySearchQuery: string;
  librarySearchResults: SkillSummary[];
  migrationSourcePath: string;
  onAddDiscoverSource: () => void;
  onApplyInstallPlan: () => void;
  onAuthorizePlugin: () => void;
  onCollectionDirectoryChange: (value: string) => void;
  onCollectionNameChange: (value: string) => void;
  onCollectionPackageDirectoryChange: (value: string) => void;
  onCreateCollection: () => void;
  onCreateExemption: () => void;
  onCreateInstallPlan: () => void;
  onCreateSyncProfile: () => void;
  onDisablePlugin: () => void;
  onDiscoverSourceNameChange: (value: string) => void;
  onDiscoverSourceUrlChange: (value: string) => void;
  onEnablePlugin: () => void;
  onExemptionReasonChange: (value: string) => void;
  onExportCollection: () => void;
  onExportDirectoryChange: (value: string) => void;
  onExportSkill: () => void;
  onGitImportUrlChange: (value: string) => void;
  onImportCollection: () => void;
  onImportGit: () => void;
  onImportLocalFolder: () => void;
  onImportPathChange: (value: string) => void;
  onImportZip: () => void;
  onInstallPlugin: () => void;
  onInstallProjectionModeChange: (value: InstallPlan['projectionMode']) => void;
  onInstallTargetRootChange: (value: string) => void;
  onLibrarySearch: () => void;
  onLibrarySearchQueryChange: (value: string) => void;
  onMigrationSourcePathChange: (value: string) => void;
  onPluginRootPathChange: (value: string) => void;
  onPreviewDiscoverSource: () => void;
  onPreviewMigration: () => void;
  onRevokeExemption: () => void;
  onRollback: () => void;
  onRollbackVersionIdChange: (value: string) => void;
  onScanAgentRoots: () => void;
  onSecurityRescanAll: () => void;
  onSecurityScan: () => void;
  onSelectSkill: (skillId: string) => void;
  onSyncModeChange: (value: 'shared-folder' | 'git' | 'rest' | 'mock-rest') => void;
  onSyncPushPull: () => void;
  onSyncRemoteUrlChange: (value: string) => void;
  onUninstall: () => void;
  onZipImportPathChange: (value: string) => void;
  operationMessage: string;
  pluginRegistry: PluginRegistry | null;
  pluginRootPath: string;
  rollbackVersionId: string;
  selectedSkillDetail: SkillDetail | null;
  syncMode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
  syncProfile: SyncProfile | null;
  syncRemoteUrl: string;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
  workspaceState: DesktopWorkspaceState;
  zipImportPath: string;
};

function PageContent(props: PageContentProps): ReactElement {
  const {
    activePage,
    activeTab,
    activeInstallPlan,
    collectionDirectory,
    collectionName,
    collectionPackageDirectory,
    discoverPreviewSkills,
    discoverSource,
    discoverSourceName,
    discoverSourceUrl,
    exemptionReason,
    exportDirectory,
    gitImportUrl,
    hasImportBridge,
    hasInstallBridge,
    hasScanBridge,
    hasSecurityBridge,
    installTargets,
    installProjectionMode,
    importPath,
    installTargetRoot,
    lastInstallationId,
    librarySearchQuery,
    librarySearchResults,
    migrationSourcePath,
    onAddDiscoverSource,
    onApplyInstallPlan,
    onAuthorizePlugin,
    onCollectionDirectoryChange,
    onCollectionNameChange,
    onCollectionPackageDirectoryChange,
    onCreateCollection,
    onCreateExemption,
    onCreateInstallPlan,
    onCreateSyncProfile,
    onDisablePlugin,
    onDiscoverSourceNameChange,
    onDiscoverSourceUrlChange,
    onEnablePlugin,
    onExemptionReasonChange,
    onExportCollection,
    onExportDirectoryChange,
    onExportSkill,
    onGitImportUrlChange,
    onImportCollection,
    onImportGit,
    onImportLocalFolder,
    onImportPathChange,
    onImportZip,
    onInstallPlugin,
    onInstallProjectionModeChange,
    onInstallTargetRootChange,
    onLibrarySearch,
    onLibrarySearchQueryChange,
    onMigrationSourcePathChange,
    onPluginRootPathChange,
    onPreviewDiscoverSource,
    onPreviewMigration,
    onRevokeExemption,
    onRollback,
    onRollbackVersionIdChange,
    onScanAgentRoots,
    onSecurityRescanAll,
    onSecurityScan,
    onSelectSkill,
    onSyncModeChange,
    onSyncPushPull,
    onSyncRemoteUrlChange,
    onUninstall,
    onZipImportPathChange,
    operationMessage,
    pluginRegistry,
    pluginRootPath,
    rollbackVersionId,
    selectedSkillDetail,
    syncMode,
    syncProfile,
    syncRemoteUrl,
    viewModel,
    workspaceState,
    zipImportPath
  } = props;
  if (activePage === 'library') {
    return (
      <LibraryPage
        activeInstallPlan={activeInstallPlan}
        activeTab={activeTab}
        collectionDirectory={collectionDirectory}
        collectionName={collectionName}
        collectionPackageDirectory={collectionPackageDirectory}
        exportDirectory={exportDirectory}
        gitImportUrl={gitImportUrl}
        hasImportBridge={hasImportBridge}
        hasInstallBridge={hasInstallBridge}
        hasScanBridge={hasScanBridge}
        installTargets={installTargets}
        installProjectionMode={installProjectionMode}
        importPath={importPath}
        installTargetRoot={installTargetRoot}
        librarySearchQuery={librarySearchQuery}
        librarySearchResults={librarySearchResults}
        onApplyInstallPlan={onApplyInstallPlan}
        onCollectionDirectoryChange={onCollectionDirectoryChange}
        onCollectionNameChange={onCollectionNameChange}
        onCollectionPackageDirectoryChange={onCollectionPackageDirectoryChange}
        onCreateCollection={onCreateCollection}
        onCreateInstallPlan={onCreateInstallPlan}
        onExportCollection={onExportCollection}
        onExportDirectoryChange={onExportDirectoryChange}
        onExportSkill={onExportSkill}
        onGitImportUrlChange={onGitImportUrlChange}
        onImportCollection={onImportCollection}
        onImportGit={onImportGit}
        onImportLocalFolder={onImportLocalFolder}
        onImportPathChange={onImportPathChange}
        onImportZip={onImportZip}
        onInstallProjectionModeChange={onInstallProjectionModeChange}
        onInstallTargetRootChange={onInstallTargetRootChange}
        onLibrarySearch={onLibrarySearch}
        onLibrarySearchQueryChange={onLibrarySearchQueryChange}
        onScanAgentRoots={onScanAgentRoots}
        onSelectSkill={onSelectSkill}
        onZipImportPathChange={onZipImportPathChange}
        operationMessage={operationMessage}
        selectedSkillDetail={selectedSkillDetail}
        viewModel={viewModel}
        workspaceState={workspaceState}
        zipImportPath={zipImportPath}
      />
    );
  }

  if (activePage === 'discover') {
    return (
      <DiscoverPage
        activeTab={activeTab}
        discoverPreviewSkills={discoverPreviewSkills}
        discoverSource={discoverSource}
        discoverSourceName={discoverSourceName}
        discoverSourceUrl={discoverSourceUrl}
        migrationSourcePath={migrationSourcePath}
        onAddDiscoverSource={onAddDiscoverSource}
        onDiscoverSourceNameChange={onDiscoverSourceNameChange}
        onDiscoverSourceUrlChange={onDiscoverSourceUrlChange}
        onMigrationSourcePathChange={onMigrationSourcePathChange}
        onPreviewDiscoverSource={onPreviewDiscoverSource}
        onPreviewMigration={onPreviewMigration}
        operationMessage={operationMessage}
        viewModel={viewModel}
      />
    );
  }

  if (activePage === 'installs') {
    return (
      <InstallsPage
        activeTab={activeTab}
        lastInstallationId={lastInstallationId}
        onRollback={onRollback}
        onRollbackVersionIdChange={onRollbackVersionIdChange}
        onUninstall={onUninstall}
        operationMessage={operationMessage}
        rollbackVersionId={rollbackVersionId}
        selectedSkillDetail={selectedSkillDetail}
        viewModel={viewModel}
      />
    );
  }

  if (activePage === 'usage') {
    return <UsagePage activeTab={activeTab} viewModel={viewModel} />;
  }

  if (activePage === 'reviews') {
    return <ReviewsPage activeTab={activeTab} viewModel={viewModel} />;
  }

  if (activePage === 'security') {
    return (
      <SecurityPage
        activeTab={activeTab}
        exemptionReason={exemptionReason}
        hasSecurityBridge={hasSecurityBridge}
        onCreateExemption={onCreateExemption}
        onExemptionReasonChange={onExemptionReasonChange}
        onRevokeExemption={onRevokeExemption}
        onSecurityRescanAll={onSecurityRescanAll}
        onSecurityScan={onSecurityScan}
        operationMessage={operationMessage}
        viewModel={viewModel}
        workspaceState={workspaceState}
      />
    );
  }

  if (activePage === 'settings') {
    return (
      <SettingsPage
        activeTab={activeTab}
        onAuthorizePlugin={onAuthorizePlugin}
        onCreateSyncProfile={onCreateSyncProfile}
        onDisablePlugin={onDisablePlugin}
        onEnablePlugin={onEnablePlugin}
        onInstallPlugin={onInstallPlugin}
        onPluginRootPathChange={onPluginRootPathChange}
        onSyncModeChange={onSyncModeChange}
        onSyncPushPull={onSyncPushPull}
        onSyncRemoteUrlChange={onSyncRemoteUrlChange}
        operationMessage={operationMessage}
        pluginRegistry={pluginRegistry}
        pluginRootPath={pluginRootPath}
        syncMode={syncMode}
        syncProfile={syncProfile}
        syncRemoteUrl={syncRemoteUrl}
        viewModel={viewModel}
      />
    );
  }

  return <DashboardPage activeTab={activeTab} hasScanBridge={hasScanBridge} onScanAgentRoots={onScanAgentRoots} viewModel={viewModel} />;
}

function DashboardPage({
  activeTab,
  hasScanBridge,
  onScanAgentRoots,
  viewModel
}: {
  activeTab: string;
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
      {activeTab === 'Agent roots' ? (
        <section className="panel" aria-label="Agent root inventory">
          <PanelHeader tag={`${viewModel.dashboard.agentRoots.length} indexed`} title="Agent root inventory" />
          <AgentRootList roots={viewModel.dashboard.agentRoots} />
        </section>
      ) : activeTab === 'Activity' ? (
        <Panel
          title="Activity log"
          tag="SQLite source of truth"
          rows={viewModel.dashboard.activity}
        />
      ) : activeTab === 'Readiness' ? (
        <ReadinessTable rows={viewModel.dashboard.readinessRows} title="Readiness actions" />
      ) : (
        <>
          <MetricGrid metrics={viewModel.dashboard.metrics} />
          <div className="section-grid">
            <Panel title="Recent activity" tag="SQLite source of truth" rows={viewModel.dashboard.activity} />
            <section className="panel" aria-label="Agent coverage">
              <PanelHeader tag={`${viewModel.dashboard.agentRoots.length} indexed`} title="Agent coverage" />
              <BarChart values={viewModel.dashboard.agentCoverageBars} />
            </section>
          </div>
          <ReadinessTable className="panel panel-spaced" rows={viewModel.dashboard.readinessRows} title="Readiness queue" />
        </>
      )}
    </>
  );
}

type LibraryPageProps = Pick<
  PageContentProps,
  | 'activeTab'
  | 'activeInstallPlan'
  | 'collectionDirectory'
  | 'collectionName'
  | 'collectionPackageDirectory'
  | 'exportDirectory'
  | 'gitImportUrl'
  | 'hasImportBridge'
  | 'hasInstallBridge'
  | 'hasScanBridge'
  | 'installTargets'
  | 'installProjectionMode'
  | 'importPath'
  | 'installTargetRoot'
  | 'librarySearchQuery'
  | 'librarySearchResults'
  | 'onApplyInstallPlan'
  | 'onCollectionDirectoryChange'
  | 'onCollectionNameChange'
  | 'onCollectionPackageDirectoryChange'
  | 'onCreateCollection'
  | 'onCreateInstallPlan'
  | 'onExportCollection'
  | 'onExportDirectoryChange'
  | 'onExportSkill'
  | 'onGitImportUrlChange'
  | 'onImportCollection'
  | 'onImportGit'
  | 'onImportLocalFolder'
  | 'onImportPathChange'
  | 'onImportZip'
  | 'onInstallProjectionModeChange'
  | 'onInstallTargetRootChange'
  | 'onLibrarySearch'
  | 'onLibrarySearchQueryChange'
  | 'onScanAgentRoots'
  | 'onSelectSkill'
  | 'onZipImportPathChange'
  | 'operationMessage'
  | 'selectedSkillDetail'
  | 'viewModel'
  | 'workspaceState'
  | 'zipImportPath'
>;

function LibraryPage({
  activeTab,
  activeInstallPlan,
  collectionDirectory,
  collectionName,
  collectionPackageDirectory,
  exportDirectory,
  gitImportUrl,
  hasImportBridge,
  hasInstallBridge,
  hasScanBridge,
  installTargets,
  installProjectionMode,
  importPath,
  installTargetRoot,
  librarySearchQuery,
  librarySearchResults,
  onApplyInstallPlan,
  onCollectionDirectoryChange,
  onCollectionNameChange,
  onCollectionPackageDirectoryChange,
  onCreateCollection,
  onCreateInstallPlan,
  onExportCollection,
  onExportDirectoryChange,
  onExportSkill,
  onGitImportUrlChange,
  onImportCollection,
  onImportGit,
  onImportLocalFolder,
  onImportPathChange,
  onImportZip,
  onInstallProjectionModeChange,
  onInstallTargetRootChange,
  onLibrarySearch,
  onLibrarySearchQueryChange,
  onScanAgentRoots,
  onSelectSkill,
  onZipImportPathChange,
  operationMessage,
  selectedSkillDetail,
  viewModel,
  workspaceState,
  zipImportPath
}: LibraryPageProps): ReactElement {
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
      {activeTab === 'Imports' ? (
        <ManagementFlow
          activeInstallPlan={activeInstallPlan}
          flow={workspaceState.managementFlow}
          hasImportBridge={hasImportBridge}
          hasInstallBridge={hasInstallBridge}
          hasScanBridge={hasScanBridge}
          hasSkills={workspaceState.skills.length > 0}
          installTargets={installTargets}
          installProjectionMode={installProjectionMode}
          importPath={importPath}
          gitImportUrl={gitImportUrl}
          installTargetRoot={installTargetRoot}
          onApplyInstallPlan={onApplyInstallPlan}
          onCreateInstallPlan={onCreateInstallPlan}
          onGitImportUrlChange={onGitImportUrlChange}
          onImportGit={onImportGit}
          onImportLocalFolder={onImportLocalFolder}
          onImportPathChange={onImportPathChange}
          onImportZip={onImportZip}
          onInstallProjectionModeChange={onInstallProjectionModeChange}
          onInstallTargetRootChange={onInstallTargetRootChange}
          onScanAgentRoots={onScanAgentRoots}
          onZipImportPathChange={onZipImportPathChange}
          zipImportPath={zipImportPath}
        />
      ) : activeTab === 'Governance' ? (
        <div className="section-grid">
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
      ) : activeTab === 'Collections' ? (
        <div className="split-two">
          <CollectionActions
            collectionDirectory={collectionDirectory}
            collectionName={collectionName}
            collectionPackageDirectory={collectionPackageDirectory}
            hasSkills={workspaceState.skills.length > 0}
            onCollectionDirectoryChange={onCollectionDirectoryChange}
            onCollectionNameChange={onCollectionNameChange}
            onCollectionPackageDirectoryChange={onCollectionPackageDirectoryChange}
            onCreateCollection={onCreateCollection}
            onExportCollection={onExportCollection}
            onImportCollection={onImportCollection}
            operationMessage={operationMessage}
          />
          <Panel
            title="Collections"
            rows={workspaceState.governance.collections.map((item) => ({
              label: item.name,
              value: String(item.skillCount)
            }))}
          />
        </div>
      ) : (
        <>
          <LibrarySearchPanel
            exportDirectory={exportDirectory}
            librarySearchQuery={librarySearchQuery}
            librarySearchResults={librarySearchResults}
            onExportDirectoryChange={onExportDirectoryChange}
            onExportSkill={onExportSkill}
            onLibrarySearch={onLibrarySearch}
            onLibrarySearchQueryChange={onLibrarySearchQueryChange}
            onSelectSkill={onSelectSkill}
            operationMessage={operationMessage}
            selectedSkillDetail={selectedSkillDetail}
          />
          <LibrarySkillList onSelectSkill={onSelectSkill} skills={viewModel.librarySkills} />
        </>
      )}
    </>
  );
}

function DiscoverPage({
  activeTab,
  discoverPreviewSkills,
  discoverSource,
  discoverSourceName,
  discoverSourceUrl,
  migrationSourcePath,
  onAddDiscoverSource,
  onDiscoverSourceNameChange,
  onDiscoverSourceUrlChange,
  onMigrationSourcePathChange,
  onPreviewDiscoverSource,
  onPreviewMigration,
  operationMessage,
  viewModel
}: {
  activeTab: string;
  discoverPreviewSkills: DiscoverSkillPreview[];
  discoverSource: DiscoverSource | null;
  discoverSourceName: string;
  discoverSourceUrl: string;
  migrationSourcePath: string;
  onAddDiscoverSource: () => void;
  onDiscoverSourceNameChange: (value: string) => void;
  onDiscoverSourceUrlChange: (value: string) => void;
  onMigrationSourcePathChange: (value: string) => void;
  onPreviewDiscoverSource: () => void;
  onPreviewMigration: () => void;
  operationMessage: string;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  return (
    <>
      <PageTitle
        action={<span className="tag">{viewModel.discover.sources.length} sources</span>}
        description="Browse trusted local and remote skill sources before importing."
        title="Discover"
      />
      {activeTab === 'Verified sources' ? (
        <SourceUpdatesTable rows={viewModel.discover.sourceUpdates} title="Verified source updates" />
      ) : activeTab === 'Trending' ? (
        <EmptyPanel title="Trending sources" text="No local source activity has been recorded yet." />
      ) : activeTab === 'New' ? (
        <EmptyPanel title="New sources" text="No newly configured sources are available yet." />
      ) : activeTab === 'Collections' ? (
        <EmptyPanel title="Source collections" text="No source collections have been configured yet." />
      ) : (
        <>
          <DiscoverActions
            discoverPreviewSkills={discoverPreviewSkills}
            discoverSource={discoverSource}
            discoverSourceName={discoverSourceName}
            discoverSourceUrl={discoverSourceUrl}
            migrationSourcePath={migrationSourcePath}
            onAddDiscoverSource={onAddDiscoverSource}
            onDiscoverSourceNameChange={onDiscoverSourceNameChange}
            onDiscoverSourceUrlChange={onDiscoverSourceUrlChange}
            onMigrationSourcePathChange={onMigrationSourcePathChange}
            onPreviewDiscoverSource={onPreviewDiscoverSource}
            onPreviewMigration={onPreviewMigration}
            operationMessage={operationMessage}
          />
          <SourceCards sources={viewModel.discover.sources} />
          <SourceUpdatesTable className="panel panel-spaced" rows={viewModel.discover.sourceUpdates} title="Source updates" />
        </>
      )}
    </>
  );
}

function InstallsPage({
  activeTab,
  lastInstallationId,
  onRollback,
  onRollbackVersionIdChange,
  onUninstall,
  operationMessage,
  rollbackVersionId,
  selectedSkillDetail,
  viewModel
}: {
  activeTab: string;
  lastInstallationId: string;
  onRollback: () => void;
  onRollbackVersionIdChange: (value: string) => void;
  onUninstall: () => void;
  operationMessage: string;
  rollbackVersionId: string;
  selectedSkillDetail: SkillDetail | null;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  const versionRows =
    selectedSkillDetail?.versions.map((version) => ({
      label: `v${version.versionNo}`,
      value: version.changeSummary || version.versionId
    })) ?? [];
  return (
    <>
      <PageTitle
        action={<span className="tag">Copy only</span>}
        description="Plan, apply, rollback, and uninstall app-owned skill projections."
        title="Installs"
      />
      {activeTab === 'Installed' ? (
        <div className="split-two">
          <Panel title="Install result stream" tag={`${viewModel.installs.resultStream.length} events`} rows={viewModel.installs.resultStream} />
          <Panel title="Version history" rows={versionRows} />
        </div>
      ) : activeTab === 'Conflicts' ? (
        <InstallPlansTable rows={viewModel.installs.plans.filter((row) => tableCellLabel(row, 4).toLowerCase() !== 'clean')} title="Install conflicts" />
      ) : activeTab === 'Exports' ? (
        <Panel title="Export packages" tag={`${viewModel.installs.exportPackages.length} packages`} rows={viewModel.installs.exportPackages} />
      ) : activeTab === 'Uninstalls' ? (
        <InstallLifecycleActions
          lastInstallationId={lastInstallationId}
          onRollback={onRollback}
          onRollbackVersionIdChange={onRollbackVersionIdChange}
          onUninstall={onUninstall}
          operationMessage={operationMessage}
          rollbackVersionId={rollbackVersionId}
        />
      ) : (
        <>
          <InstallPlansTable rows={viewModel.installs.plans} title="Pending install plans" />
          <div className="split-two panel-spaced">
            <Panel title="Install result stream" tag={`${viewModel.installs.resultStream.length} events`} rows={viewModel.installs.resultStream} />
            <Panel title="Export packages" tag={`${viewModel.installs.exportPackages.length} packages`} rows={viewModel.installs.exportPackages} />
          </div>
        </>
      )}
    </>
  );
}

function InstallLifecycleActions({
  lastInstallationId,
  onRollback,
  onRollbackVersionIdChange,
  onUninstall,
  operationMessage,
  rollbackVersionId
}: {
  lastInstallationId: string;
  onRollback: () => void;
  onRollbackVersionIdChange: (value: string) => void;
  onUninstall: () => void;
  operationMessage: string;
  rollbackVersionId: string;
}): ReactElement {
  return (
    <section className="panel" aria-label="Install lifecycle actions">
      <PanelHeader tag={operationMessage || 'app-owned'} title="Install lifecycle" />
      <div className="flow-actions">
        <label htmlFor="rollback-version-id">
          Rollback version ID
          <input
            aria-label="Rollback version ID"
            id="rollback-version-id"
            name="rollbackVersionId"
            onChange={(event) => onRollbackVersionIdChange(event.target.value)}
            placeholder="target version id"
            value={rollbackVersionId}
          />
        </label>
        <button disabled={lastInstallationId.length === 0 || rollbackVersionId.trim().length === 0} onClick={onRollback} type="button">
          Roll back install
        </button>
        <button disabled={lastInstallationId.length === 0} onClick={onUninstall} type="button">
          Uninstall app-owned files
        </button>
      </div>
    </section>
  );
}

function UsagePage({
  activeTab,
  viewModel
}: {
  activeTab: string;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  return (
    <>
      <PageTitle
        action={<button className="filter blue" type="button">Download CSV</button>}
        description="Local usage signals from installs, launches, scans, and exports."
        title="Usage"
      />
      {activeTab === 'Agents' ? (
        <Panel title="Agent split" tag={`${viewModel.usage.agentSplit.length} rows`} rows={viewModel.usage.agentSplit} />
      ) : activeTab === 'Skills' ? (
        <Panel title="Top skills" tag={`${viewModel.usage.topSkills.length} rows`} rows={viewModel.usage.topSkills} />
      ) : activeTab === 'Sources' ? (
        <EmptyPanel title="Source usage" text="No source usage records have been stored locally yet." />
      ) : activeTab === 'Exports' ? (
        <Panel title="Export activity" rows={[viewModel.usage.metrics.find((metricItem) => metricItem.label === 'Exports') ?? { label: 'Exports', value: '0', detail: 'hash verified' }].map((metricItem) => ({ label: metricItem.label, value: `${metricItem.value} ${metricItem.detail}` }))} />
      ) : (
        <>
          <MetricGrid metrics={viewModel.usage.metrics} />
          <section className="panel" aria-label="Daily activity">
            <PanelHeader tag="No telemetry" title="Daily activity" />
            <BarChart values={viewModel.usage.dailyBars} />
          </section>
          <div className="split-two panel-spaced">
            <Panel title="Top skills" tag={`${viewModel.usage.topSkills.length} rows`} rows={viewModel.usage.topSkills} />
            <Panel title="Agent split" tag={`${viewModel.usage.agentSplit.length} rows`} rows={viewModel.usage.agentSplit} />
          </div>
        </>
      )}
    </>
  );
}

function ReviewsPage({
  activeTab,
  viewModel
}: {
  activeTab: string;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  const reviewRows =
    activeTab === 'Approved'
      ? viewModel.reviews.queue.filter((row) => tableCellLabel(row, 5).toLowerCase() === 'approved')
      : activeTab === 'Rejected'
        ? viewModel.reviews.queue.filter((row) => tableCellLabel(row, 5).toLowerCase() === 'rejected')
        : viewModel.reviews.queue;

  return (
    <>
      <PageTitle
        action={<span className="tag">{openReviewCount(viewModel)} open</span>}
        description="Review imported skills, package changes, and source trust decisions."
        title="Reviews"
      />
      {activeTab === 'My queue' ? (
        <Panel title="Review notes" tag={`${viewModel.reviews.notes.length} notes`} rows={viewModel.reviews.notes} />
      ) : activeTab === 'Community' ? (
        <Panel title="Community signal" tag={`${viewModel.reviews.communitySignal.length} rows`} rows={viewModel.reviews.communitySignal} />
      ) : (
        <>
          <ReviewQueueTable rows={reviewRows} title={activeTab === 'Approved' || activeTab === 'Rejected' ? `${activeTab} reviews` : 'Review queue'} />
          <div className="split-two panel-spaced">
            <Panel title="Review notes" tag={`${viewModel.reviews.notes.length} notes`} rows={viewModel.reviews.notes} />
            <Panel title="Community signal" tag={`${viewModel.reviews.communitySignal.length} rows`} rows={viewModel.reviews.communitySignal} />
          </div>
        </>
      )}
    </>
  );
}

function SecurityPage({
  activeTab,
  exemptionReason,
  hasSecurityBridge,
  onCreateExemption,
  onExemptionReasonChange,
  onRevokeExemption,
  onSecurityRescanAll,
  onSecurityScan,
  operationMessage,
  viewModel,
  workspaceState
}: {
  activeTab: string;
  exemptionReason: string;
  hasSecurityBridge: boolean;
  onCreateExemption: () => void;
  onExemptionReasonChange: (value: string) => void;
  onRevokeExemption: () => void;
  onSecurityRescanAll: () => void;
  onSecurityScan: () => void;
  operationMessage: string;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
  workspaceState: DesktopWorkspaceState;
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
      {activeTab === 'Scan queue' ? (
        <>
          <button className="filter blue" disabled={!hasSecurityBridge} onClick={onSecurityRescanAll} type="button">
            Rescan all indexed skills
          </button>
          <SecurityCenterTable rows={viewModel.security.queue} title="Security scan queue" />
        </>
      ) : activeTab === 'Rules' ? (
        <Panel title="Rule details" tag={`${viewModel.security.ruleDetails.length} findings`} rows={viewModel.security.ruleDetails} />
      ) : activeTab === 'Exemptions' ? (
        <div className="split-two">
          <SecurityExemptionActions
            exemptionReason={exemptionReason}
            onCreateExemption={onCreateExemption}
            onExemptionReasonChange={onExemptionReasonChange}
            onRevokeExemption={onRevokeExemption}
            operationMessage={operationMessage}
          />
          <Panel title="Exemption lifecycle" tag={`${viewModel.security.exemptions.length} active`} rows={viewModel.security.exemptions} />
        </div>
      ) : activeTab === 'History' ? (
        <Panel
          title="Security history"
          rows={workspaceState.securityCenter.history.map((item) => ({
            label: item.skillName,
            value: item.level
          }))}
        />
      ) : (
        <>
          <MetricGrid metrics={viewModel.security.metrics} />
          <SecurityCenterTable rows={viewModel.security.queue} title="Security Center" />
          <div className="split-two panel-spaced">
            <Panel title="Rule details" tag={`${viewModel.security.ruleDetails.length} findings`} rows={viewModel.security.ruleDetails} />
            <Panel title="Exemption lifecycle" tag={`${viewModel.security.exemptions.length} active`} rows={viewModel.security.exemptions} />
          </div>
          <div className="panel-spaced">
            <SecurityExemptionActions
              exemptionReason={exemptionReason}
              onCreateExemption={onCreateExemption}
              onExemptionReasonChange={onExemptionReasonChange}
              onRevokeExemption={onRevokeExemption}
              operationMessage={operationMessage}
            />
          </div>
        </>
      )}
    </>
  );
}

function SecurityExemptionActions({
  exemptionReason,
  onCreateExemption,
  onExemptionReasonChange,
  onRevokeExemption,
  operationMessage
}: {
  exemptionReason: string;
  onCreateExemption: () => void;
  onExemptionReasonChange: (value: string) => void;
  onRevokeExemption: () => void;
  operationMessage: string;
}): ReactElement {
  return (
    <section className="panel" aria-label="Security exemption actions">
      <PanelHeader tag={operationMessage || 'scoped'} title="Exemption actions" />
      <div className="flow-actions">
        <label htmlFor="exemption-reason">
          Exemption reason
          <input
            aria-label="Exemption reason"
            id="exemption-reason"
            name="exemptionReason"
            onChange={(event) => onExemptionReasonChange(event.target.value)}
            placeholder="Reviewed by maintainer"
            value={exemptionReason}
          />
        </label>
        <button disabled={exemptionReason.trim().length === 0} onClick={onCreateExemption} type="button">
          Create exemption
        </button>
        <button onClick={onRevokeExemption} type="button">
          Revoke exemption
        </button>
      </div>
    </section>
  );
}

function SettingsPage({
  activeTab,
  onAuthorizePlugin,
  onCreateSyncProfile,
  onDisablePlugin,
  onEnablePlugin,
  onInstallPlugin,
  onPluginRootPathChange,
  onSyncModeChange,
  onSyncPushPull,
  onSyncRemoteUrlChange,
  operationMessage,
  pluginRegistry,
  pluginRootPath,
  syncMode,
  syncProfile,
  syncRemoteUrl,
  viewModel
}: {
  activeTab: string;
  onAuthorizePlugin: () => void;
  onCreateSyncProfile: () => void;
  onDisablePlugin: () => void;
  onEnablePlugin: () => void;
  onInstallPlugin: () => void;
  onPluginRootPathChange: (value: string) => void;
  onSyncModeChange: (value: 'shared-folder' | 'git' | 'rest' | 'mock-rest') => void;
  onSyncPushPull: () => void;
  onSyncRemoteUrlChange: (value: string) => void;
  operationMessage: string;
  pluginRegistry: PluginRegistry | null;
  pluginRootPath: string;
  syncMode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
  syncProfile: SyncProfile | null;
  syncRemoteUrl: string;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
}): ReactElement {
  return (
    <>
      <PageTitle
        action={<button className="filter blue" type="button">Save changes</button>}
        description="Configure local roots, storage, disabled sync, and plugin permissions."
        title="Settings"
      />
      {activeTab === 'Database' ? (
        <DatabasePrivacyTable rows={viewModel.settings.databaseRows} />
      ) : activeTab === 'Sync' ? (
        <div className="split-two">
          <SyncActions
            onCreateSyncProfile={onCreateSyncProfile}
            onSyncModeChange={onSyncModeChange}
            onSyncPushPull={onSyncPushPull}
            onSyncRemoteUrlChange={onSyncRemoteUrlChange}
            operationMessage={operationMessage}
            syncMode={syncMode}
            syncProfile={syncProfile}
            syncRemoteUrl={syncRemoteUrl}
          />
          <Panel title="Offline-first sync" tag="Disabled" rows={viewModel.settings.syncRows} />
          <Panel title="Sync preview" rows={viewModel.settings.syncPreview} />
        </div>
      ) : activeTab === 'Plugins' ? (
        <div className="split-two">
          <PluginActions
            onAuthorizePlugin={onAuthorizePlugin}
            onDisablePlugin={onDisablePlugin}
            onEnablePlugin={onEnablePlugin}
            onInstallPlugin={onInstallPlugin}
            onPluginRootPathChange={onPluginRootPathChange}
            operationMessage={operationMessage}
            pluginRegistry={pluginRegistry}
            pluginRootPath={pluginRootPath}
          />
          <Panel title="Plugin runtime" tag="Opt-in" rows={viewModel.settings.pluginRows} />
          <Panel title="Plugin summary" rows={viewModel.settings.pluginRows} />
        </div>
      ) : activeTab === 'Privacy' ? (
        <div className="split-two">
          <Panel title="Current defaults" rows={viewModel.settings.defaults} />
          <DatabasePrivacyTable rows={viewModel.settings.databaseRows} />
        </div>
      ) : (
        <section className="panel" aria-label="Detected agent roots">
          <PanelHeader tag={`${viewModel.settings.agentRoots.length} indexed`} title="Detected agent roots" />
          <AgentRootList roots={viewModel.settings.agentRoots} />
        </section>
      )}
    </>
  );
}

function SyncActions({
  onCreateSyncProfile,
  onSyncModeChange,
  onSyncPushPull,
  onSyncRemoteUrlChange,
  operationMessage,
  syncMode,
  syncProfile,
  syncRemoteUrl
}: {
  onCreateSyncProfile: () => void;
  onSyncModeChange: (value: 'shared-folder' | 'git' | 'rest' | 'mock-rest') => void;
  onSyncPushPull: () => void;
  onSyncRemoteUrlChange: (value: string) => void;
  operationMessage: string;
  syncMode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
  syncProfile: SyncProfile | null;
  syncRemoteUrl: string;
}): ReactElement {
  return (
    <section className="panel" aria-label="Sync actions">
      <PanelHeader tag={operationMessage || 'manual'} title="Sync actions" />
      <div className="flow-actions">
        <label htmlFor="sync-mode">
          Sync mode
          <select
            aria-label="Sync mode"
            id="sync-mode"
            name="syncMode"
            onChange={(event) =>
              onSyncModeChange(event.target.value as 'shared-folder' | 'git' | 'rest' | 'mock-rest')
            }
            value={syncMode}
          >
            <option value="shared-folder">Shared folder</option>
            <option value="git">Git</option>
            <option value="rest">REST</option>
            <option value="mock-rest">Mock REST</option>
          </select>
        </label>
        <label htmlFor="sync-remote-url">
          Sync remote path
          <input
            aria-label="Sync remote path"
            id="sync-remote-url"
            name="syncRemoteUrl"
            onChange={(event) => onSyncRemoteUrlChange(event.target.value)}
            placeholder="/path/to/shared"
            value={syncRemoteUrl}
          />
        </label>
        <button disabled={syncRemoteUrl.trim().length === 0} onClick={onCreateSyncProfile} type="button">
          Create sync profile
        </button>
        <button disabled={!syncProfile} onClick={onSyncPushPull} type="button">
          Push and pull
        </button>
      </div>
    </section>
  );
}

function PluginActions({
  onAuthorizePlugin,
  onDisablePlugin,
  onEnablePlugin,
  onInstallPlugin,
  onPluginRootPathChange,
  operationMessage,
  pluginRegistry,
  pluginRootPath
}: {
  onAuthorizePlugin: () => void;
  onDisablePlugin: () => void;
  onEnablePlugin: () => void;
  onInstallPlugin: () => void;
  onPluginRootPathChange: (value: string) => void;
  operationMessage: string;
  pluginRegistry: PluginRegistry | null;
  pluginRootPath: string;
}): ReactElement {
  return (
    <section className="panel" aria-label="Plugin actions">
      <PanelHeader tag={operationMessage || 'disabled'} title="Plugin actions" />
      <div className="flow-actions">
        <label htmlFor="plugin-root-path">
          Plugin folder
          <input
            aria-label="Plugin folder"
            id="plugin-root-path"
            name="pluginRootPath"
            onChange={(event) => onPluginRootPathChange(event.target.value)}
            placeholder="/path/to/plugin"
            value={pluginRootPath}
          />
        </label>
        <button disabled={pluginRootPath.trim().length === 0} onClick={onInstallPlugin} type="button">
          Install plugin
        </button>
        <button onClick={onAuthorizePlugin} type="button">
          Authorize permission
        </button>
        <button onClick={onEnablePlugin} type="button">
          Enable plugin
        </button>
        <button onClick={onDisablePlugin} type="button">
          Disable plugin
        </button>
      </div>
      <KeyValueList
        rows={[
          { label: 'Agent adapters', value: String(pluginRegistry?.agentAdapters.length ?? 0) },
          { label: 'Importers', value: String(pluginRegistry?.importers.length ?? 0) },
          { label: 'Security rules', value: String(pluginRegistry?.securityRules.length ?? 0) },
          { label: 'Sync drivers', value: String(pluginRegistry?.syncDrivers.length ?? 0) }
        ]}
      />
    </section>
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
  title: string;
  subtitle: string;
  panels: PanelModel[];
} {
  const firstInstallPlan = viewModel.installs.plans[0];
  const firstReview = viewModel.reviews.queue[0];
  const firstSecurityRow = viewModel.security.queue[0];

  if (activePage === 'library') {
    return {
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
      title: 'Discover sources',
      subtitle: `${viewModel.discover.sources.length} configured`,
      panels: [
        {
          title: 'Source summary',
          rows: [
            { label: 'Configured sources', value: String(viewModel.discover.sources.length) },
            { label: 'Source updates', value: String(viewModel.discover.sourceUpdates.length) },
            { label: 'Default install', value: 'Manual review' }
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
      title: firstInstallPlan ? tableCellLabel(firstInstallPlan, 0) : 'Install planning',
      subtitle: firstInstallPlan ? tableCellLabel(firstInstallPlan, 5) : 'No pending install plan',
      panels: [
        {
          title: 'Plan summary',
          rows: firstInstallPlan
            ? [
                { label: 'Target agent', value: tableCellLabel(firstInstallPlan, 1) },
                { label: 'Target root', value: tableCellLabel(firstInstallPlan, 2) },
                { label: 'Planned writes', value: tableCellLabel(firstInstallPlan, 3) },
                { label: 'Conflict', value: tableCellLabel(firstInstallPlan, 4) },
                { label: 'Status', value: tableCellLabel(firstInstallPlan, 5) }
              ]
            : []
        },
        {
          title: 'Install results',
          rows: viewModel.installs.resultStream
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
      title: 'Usage insight',
      subtitle: 'Local events only',
      panels: [
        {
          title: 'Privacy boundary',
          text: 'Usage is derived from local SQLite records. No cloud analytics.'
        },
        {
          title: 'Activity heatmap',
          text:
            viewModel.usage.dailyBars.length > 0
              ? 'Daily activity is rendered from local usage records.'
              : 'No local usage activity has been recorded yet.'
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
      title: 'Review decisions',
      subtitle: firstReview ? tableCellLabel(firstReview, 5) : 'No open review item',
      panels: [
        {
          title: 'Decision checklist',
          rows: firstReview
            ? [
                { label: 'Reason', value: tableCellLabel(firstReview, 1) },
                { label: 'Source', value: tableCellLabel(firstReview, 2) },
                { label: 'Reviewer', value: tableCellLabel(firstReview, 3) },
                { label: 'Risk', value: tableCellLabel(firstReview, 4) },
                { label: 'Status', value: tableCellLabel(firstReview, 5) }
              ]
            : []
        },
        {
          title: 'Review notes',
          rows: viewModel.reviews.notes
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
      title: 'Current posture',
      subtitle: `${viewModel.security.queue.length} queued scans`,
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
          title: 'Current finding',
          rows: firstSecurityRow
            ? [
                { label: 'Skill', value: tableCellLabel(firstSecurityRow, 0) },
                { label: 'Rule', value: tableCellLabel(firstSecurityRow, 1) },
                { label: 'Category', value: tableCellLabel(firstSecurityRow, 2) },
                { label: 'Severity', value: tableCellLabel(firstSecurityRow, 3) },
                { label: 'Policy', value: tableCellLabel(firstSecurityRow, 4) }
              ]
            : []
        },
        {
          title: 'Recommended action',
          text:
            viewModel.security.queue.length > 0
              ? 'Review queued findings and record an exemption only when the skill is acceptable for the selected scope.'
              : 'Run a security scan after importing a skill to populate this queue.'
        }
      ]
    };
  }

  if (activePage === 'settings') {
    return {
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
          title: 'Plugin summary',
          rows: viewModel.settings.pluginRows
        }
      ]
    };
  }

  return {
    title: 'Workspace health',
    subtitle: 'Phase 10 maintainer operations',
    panels: [
      {
        title: "Today's focus",
        rows: viewModel.dashboard.metrics.map((metricItem) => ({ label: metricItem.label, value: metricItem.value }))
      },
      {
        title: 'Agent roots',
        rows: viewModel.dashboard.agentRoots.map((root) => ({ label: root.agent, value: root.status }))
      },
      {
        title: 'Next recommended action',
        text:
          viewModel.dashboard.activity.length > 0
            ? 'Review the latest local activity before applying install plans.'
            : 'Run an agent scan or import a local folder to populate the workspace.'
      }
    ]
  };
}

function tableCellLabel(row: TableRow, index: number): string {
  return row.cells[index]?.label ?? '';
}

function openReviewCount(viewModel: ReturnType<typeof createWorkspaceViewModel>): number {
  return viewModel.reviews.queue.filter((row) => tableCellLabel(row, 5).toLowerCase() === 'open').length;
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
      {!text && rows.length === 0 ? <p>No records yet.</p> : null}
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

function LibrarySearchPanel({
  exportDirectory,
  librarySearchQuery,
  librarySearchResults,
  onExportDirectoryChange,
  onExportSkill,
  onLibrarySearch,
  onLibrarySearchQueryChange,
  onSelectSkill,
  operationMessage,
  selectedSkillDetail
}: {
  exportDirectory: string;
  librarySearchQuery: string;
  librarySearchResults: SkillSummary[];
  onExportDirectoryChange: (value: string) => void;
  onExportSkill: () => void;
  onLibrarySearch: () => void;
  onLibrarySearchQueryChange: (value: string) => void;
  onSelectSkill: (skillId: string) => void;
  operationMessage: string;
  selectedSkillDetail: SkillDetail | null;
}): ReactElement {
  return (
    <section className="management-flow" aria-label="Library search and detail">
      <article className="flow-panel">
        <header>
          <h2>Library Search</h2>
          <span>{librarySearchResults.length}</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="library-search-query">
            Search query
            <input
              aria-label="Library search query"
              id="library-search-query"
              name="librarySearchQuery"
              onChange={(event) => onLibrarySearchQueryChange(event.target.value)}
              placeholder="name, tag, description, or file path"
              value={librarySearchQuery}
            />
          </label>
          <button disabled={librarySearchQuery.trim().length === 0} onClick={onLibrarySearch} type="button">
            Search library
          </button>
        </div>
        <KeyValueList
          rows={librarySearchResults.map((skill) => ({
            label: skill.name,
            value: `v${skill.versionNo}`
          }))}
        />
        <div className="flow-actions">
          {librarySearchResults.map((skill) => (
            <button key={skill.id} onClick={() => onSelectSkill(skill.id)} type="button">
              View {skill.name}
            </button>
          ))}
        </div>
      </article>

      <article className="flow-panel">
        <header>
          <h2>Skill Detail</h2>
          <span>{selectedSkillDetail?.riskStatus ?? 'none'}</span>
        </header>
        {selectedSkillDetail ? (
          <>
            <dl className="flow-details">
              <div>
                <dt>Source</dt>
                <dd>{selectedSkillDetail.source.type}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>v{selectedSkillDetail.skill.versionNo}</dd>
              </div>
              <div>
                <dt>Files</dt>
                <dd>{selectedSkillDetail.files.length}</dd>
              </div>
            </dl>
            <pre className="skill-preview">{selectedSkillDetail.skillMarkdown.slice(0, 600)}</pre>
            <KeyValueList
              rows={selectedSkillDetail.files.map((file) => ({
                label: file.relativePath,
                value: file.kind
              }))}
            />
          </>
        ) : (
          <p>Select a skill to inspect files, source, versions, install status, and risk state.</p>
        )}
      </article>

      <article className="flow-panel">
        <header>
          <h2>Skill Export</h2>
          <span>{operationMessage || 'idle'}</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="skill-export-directory">
            Export directory
            <input
              aria-label="Skill export directory"
              id="skill-export-directory"
              name="skillExportDirectory"
              onChange={(event) => onExportDirectoryChange(event.target.value)}
              placeholder="/path/to/export"
              value={exportDirectory}
            />
          </label>
          <button disabled={exportDirectory.trim().length === 0} onClick={onExportSkill} type="button">
            Export skill
          </button>
        </div>
      </article>
    </section>
  );
}

function CollectionActions({
  collectionDirectory,
  collectionName,
  collectionPackageDirectory,
  hasSkills,
  onCollectionDirectoryChange,
  onCollectionNameChange,
  onCollectionPackageDirectoryChange,
  onCreateCollection,
  onExportCollection,
  onImportCollection,
  operationMessage
}: {
  collectionDirectory: string;
  collectionName: string;
  collectionPackageDirectory: string;
  hasSkills: boolean;
  onCollectionDirectoryChange: (value: string) => void;
  onCollectionNameChange: (value: string) => void;
  onCollectionPackageDirectoryChange: (value: string) => void;
  onCreateCollection: () => void;
  onExportCollection: () => void;
  onImportCollection: () => void;
  operationMessage: string;
}): ReactElement {
  return (
    <section className="panel" aria-label="Collection actions">
      <PanelHeader tag={operationMessage || 'local'} title="Collection actions" />
      <div className="flow-actions">
        <label htmlFor="collection-name">
          Collection name
          <input
            aria-label="Collection name"
            id="collection-name"
            name="collectionName"
            onChange={(event) => onCollectionNameChange(event.target.value)}
            placeholder="Starter Pack"
            value={collectionName}
          />
        </label>
        <button disabled={!hasSkills || collectionName.trim().length === 0} onClick={onCreateCollection} type="button">
          Create collection
        </button>
        <label htmlFor="collection-export-directory">
          Collection export directory
          <input
            aria-label="Collection export directory"
            id="collection-export-directory"
            name="collectionExportDirectory"
            onChange={(event) => onCollectionDirectoryChange(event.target.value)}
            placeholder="/path/to/collection"
            value={collectionDirectory}
          />
        </label>
        <button disabled={collectionDirectory.trim().length === 0} onClick={onExportCollection} type="button">
          Export collection
        </button>
        <label htmlFor="collection-package-directory">
          Collection package directory
          <input
            aria-label="Collection package directory"
            id="collection-package-directory"
            name="collectionPackageDirectory"
            onChange={(event) => onCollectionPackageDirectoryChange(event.target.value)}
            placeholder="/path/to/package"
            value={collectionPackageDirectory}
          />
        </label>
        <button disabled={collectionPackageDirectory.trim().length === 0} onClick={onImportCollection} type="button">
          Import collection
        </button>
      </div>
    </section>
  );
}

function LibrarySkillList({
  onSelectSkill,
  skills
}: {
  onSelectSkill: (skillId: string) => void;
  skills: LibrarySkillSummary[];
}): ReactElement {
  if (skills.length === 0) {
    return (
      <section className="empty-state" aria-label="Library empty state">
        <Box aria-hidden="true" className="empty-icon" />
        <div className="empty-copy">
          <h2>No skills indexed yet</h2>
          <p>The desktop shell is ready for local library indexing and typed agent adapters.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Indexed skills" className="library-list">
      {skills.map((skill) => (
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
          <button className="filter" onClick={() => onSelectSkill(skill.id)} type="button">
            Details
          </button>
        </article>
      ))}
    </section>
  );
}

function SourceCards({ sources }: { sources: SourceCard[] }): ReactElement {
  if (sources.length === 0) {
    return (
      <section className="empty-state" aria-label="Discover empty state">
        <Box aria-hidden="true" className="empty-icon" />
        <div className="empty-copy">
          <h2>No sources configured</h2>
          <p>Configure or import a trusted source before catalog rows appear here.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="card-grid">
      {sources.map((source) => (
        <SourceCardView key={source.name} source={source} />
      ))}
    </div>
  );
}

function DiscoverActions({
  discoverPreviewSkills,
  discoverSource,
  discoverSourceName,
  discoverSourceUrl,
  migrationSourcePath,
  onAddDiscoverSource,
  onDiscoverSourceNameChange,
  onDiscoverSourceUrlChange,
  onMigrationSourcePathChange,
  onPreviewDiscoverSource,
  onPreviewMigration,
  operationMessage
}: {
  discoverPreviewSkills: DiscoverSkillPreview[];
  discoverSource: DiscoverSource | null;
  discoverSourceName: string;
  discoverSourceUrl: string;
  migrationSourcePath: string;
  onAddDiscoverSource: () => void;
  onDiscoverSourceNameChange: (value: string) => void;
  onDiscoverSourceUrlChange: (value: string) => void;
  onMigrationSourcePathChange: (value: string) => void;
  onPreviewDiscoverSource: () => void;
  onPreviewMigration: () => void;
  operationMessage: string;
}): ReactElement {
  return (
    <section className="management-flow" aria-label="Discover source actions">
      <article className="flow-panel">
        <header>
          <h2>Configured sources</h2>
          <span>{discoverSource?.status ?? 'none'}</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="discover-source-name">
            Source name
            <input
              aria-label="Discover source name"
              id="discover-source-name"
              name="discoverSourceName"
              onChange={(event) => onDiscoverSourceNameChange(event.target.value)}
              placeholder="Local curated"
              value={discoverSourceName}
            />
          </label>
          <label htmlFor="discover-source-url">
            Source path or Git URL
            <input
              aria-label="Discover source URL"
              id="discover-source-url"
              name="discoverSourceUrl"
              onChange={(event) => onDiscoverSourceUrlChange(event.target.value)}
              placeholder="/path/to/source"
              value={discoverSourceUrl}
            />
          </label>
          <button
            disabled={discoverSourceName.trim().length === 0 || discoverSourceUrl.trim().length === 0}
            onClick={onAddDiscoverSource}
            type="button"
          >
            Add source
          </button>
          <button disabled={!discoverSource} onClick={onPreviewDiscoverSource} type="button">
            Preview source
          </button>
        </div>
      </article>

      <article className="flow-panel">
        <header>
          <h2>Migration preview</h2>
          <span>writes blocked</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="migration-source-path">
            Migration source path
            <input
              aria-label="Migration source path"
              id="migration-source-path"
              name="migrationSourcePath"
              onChange={(event) => onMigrationSourcePathChange(event.target.value)}
              placeholder="/path/to/agent/skills"
              value={migrationSourcePath}
            />
          </label>
          <button disabled={migrationSourcePath.trim().length === 0} onClick={onPreviewMigration} type="button">
            Preview migration
          </button>
        </div>
      </article>

      <article className="flow-panel">
        <header>
          <h2>Import preview</h2>
          <span>{operationMessage || `${discoverPreviewSkills.length} skills`}</span>
        </header>
        <KeyValueList
          rows={discoverPreviewSkills.map((skill) => ({
            label: skill.name,
            value: skill.riskStatus
          }))}
        />
      </article>
    </section>
  );
}

function EmptyPanel({ text, title }: { text: string; title: string }): ReactElement {
  return <Panel title={title} text={text} />;
}

function ReadinessTable({
  className = 'panel',
  rows,
  title
}: {
  className?: string;
  rows: TableRow[];
  title: string;
}): ReactElement {
  return (
    <section className={className} aria-label={title}>
      <PanelHeader tag={`${rows.length} actions`} title={title} />
      <DataTable
        columns={[
          { key: 'item', label: 'Item', width: '28%' },
          { key: 'owner', label: 'Owner', width: '20%' },
          { key: 'signal', label: 'Signal', width: '18%' },
          { key: 'lastCheck', label: 'Last check', width: '18%' },
          { key: 'status', label: 'Status', width: '16%' }
        ]}
        rows={rows}
      />
    </section>
  );
}

function SourceUpdatesTable({
  className = 'panel',
  rows,
  title
}: {
  className?: string;
  rows: TableRow[];
  title: string;
}): ReactElement {
  return (
    <section className={className} aria-label={title}>
      <PanelHeader tag={`${rows.length} updates`} title={title} />
      <DataTable
        columns={[
          { key: 'source', label: 'Source', width: '28%' },
          { key: 'trust', label: 'Trust', width: '22%' },
          { key: 'newSkills', label: 'New skills', width: '18%' },
          { key: 'lastChecked', label: 'Last checked', width: '17%' },
          { key: 'status', label: 'Status', width: '15%' }
        ]}
        rows={rows}
      />
    </section>
  );
}

function InstallPlansTable({ rows, title }: { rows: TableRow[]; title: string }): ReactElement {
  return (
    <section className="panel" aria-label={title}>
      <PanelHeader tag={`${rows.length} plans`} title={title} />
      <DataTable
        columns={[
          { key: 'skill', label: 'Skill', width: '26%' },
          { key: 'agent', label: 'Agent', width: '18%' },
          { key: 'targetRoot', label: 'Target root', width: '24%' },
          { key: 'writes', label: 'Writes', width: '12%' },
          { key: 'conflict', label: 'Conflict', width: '11%' },
          { key: 'status', label: 'Status', width: '9%' }
        ]}
        rows={rows}
      />
    </section>
  );
}

function ReviewQueueTable({ rows, title }: { rows: TableRow[]; title: string }): ReactElement {
  return (
    <section className="panel" aria-label={title}>
      <PanelHeader tag={`${rows.length} items`} title={title} />
      <DataTable
        columns={[
          { key: 'reviewItem', label: 'Review item', width: '28%' },
          { key: 'reason', label: 'Reason', width: '20%' },
          { key: 'source', label: 'Source', width: '15%' },
          { key: 'reviewer', label: 'Reviewer', width: '15%' },
          { key: 'risk', label: 'Risk', width: '12%' },
          { key: 'status', label: 'Status', width: '10%' }
        ]}
        rows={rows}
      />
    </section>
  );
}

function SecurityCenterTable({ rows, title }: { rows: TableRow[]; title: string }): ReactElement {
  return (
    <section className="panel" aria-label={title}>
      <PanelHeader tag={`${rows.length} queued`} title={title} />
      <DataTable
        columns={[
          { key: 'skill', label: 'Skill', width: '28%' },
          { key: 'finding', label: 'Rule finding', width: '20%' },
          { key: 'category', label: 'Category', width: '20%' },
          { key: 'severity', label: 'Severity', width: '16%' },
          { key: 'policy', label: 'Policy', width: '16%' }
        ]}
        rows={rows}
      />
    </section>
  );
}

function DatabasePrivacyTable({ rows }: { rows: TableRow[] }): ReactElement {
  return (
    <section className="panel" aria-label="Database and privacy">
      <PanelHeader tag="Local only" title="Database and privacy" />
      <DataTable
        columns={[
          { key: 'setting', label: 'Setting', width: '32%' },
          { key: 'value', label: 'Value', width: '34%' },
          { key: 'status', label: 'Status', width: '34%' }
        ]}
        rows={rows}
      />
    </section>
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
        {rows.length > 0 ? (
          rows.map((row) => (
            <tr className={row.selected ? 'selected' : ''} key={row.id}>
              {row.cells.map((cell, index) => (
                <td key={`${row.id}:${index}`}>
                  <TableCellView cell={cell} />
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td className="empty-cell" colSpan={columns.length}>
              No records yet.
            </td>
          </tr>
        )}
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
  gitImportUrl,
  installTargets,
  installProjectionMode,
  importPath,
  installTargetRoot,
  onApplyInstallPlan,
  onCreateInstallPlan,
  onGitImportUrlChange,
  onImportGit,
  onImportLocalFolder,
  onImportPathChange,
  onImportZip,
  onInstallProjectionModeChange,
  onInstallTargetRootChange,
  onScanAgentRoots,
  onZipImportPathChange,
  zipImportPath
}: {
  activeInstallPlan: InstallPlan | null;
  flow: ManagementFlowState;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  hasSkills: boolean;
  gitImportUrl: string;
  installTargets: InstallTarget[];
  installProjectionMode: InstallPlan['projectionMode'];
  importPath: string;
  installTargetRoot: string;
  onApplyInstallPlan: () => void;
  onCreateInstallPlan: () => void;
  onGitImportUrlChange: (value: string) => void;
  onImportGit: () => void;
  onImportLocalFolder: () => void;
  onImportPathChange: (value: string) => void;
  onImportZip: () => void;
  onInstallProjectionModeChange: (value: InstallPlan['projectionMode']) => void;
  onInstallTargetRootChange: (value: string) => void;
  onScanAgentRoots: () => void;
  onZipImportPathChange: (value: string) => void;
  zipImportPath: string;
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
          <label htmlFor="import-git-url">
            Git URL
            <input
              aria-label="Git import URL"
              id="import-git-url"
              name="gitImportUrl"
              onChange={(event) => onGitImportUrlChange(event.target.value)}
              placeholder="file:///path/to/repo"
              value={gitImportUrl}
            />
          </label>
          <button disabled={!window.theOpenHub?.importGit || gitImportUrl.trim().length === 0} onClick={onImportGit} type="button">
            Import Git
          </button>
          <label htmlFor="import-zip-path">
            ZIP path
            <input
              aria-label="ZIP import path"
              id="import-zip-path"
              name="zipImportPath"
              onChange={(event) => onZipImportPathChange(event.target.value)}
              placeholder="/path/to/skill.zip"
              value={zipImportPath}
            />
          </label>
          <button disabled={!window.theOpenHub?.importZip || zipImportPath.trim().length === 0} onClick={onImportZip} type="button">
            Import ZIP
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
          {installTargets.length > 0 ? (
            <label htmlFor="detected-install-target">
              Detected install target
              <select
                aria-label="Detected install target"
                id="detected-install-target"
                name="detectedInstallTarget"
                onChange={(event) => onInstallTargetRootChange(event.target.value)}
                value={installTargetRoot}
              >
                {installTargets.map((target) => (
                  <option key={`${target.agentCode}:${target.rootPath}`} value={target.rootPath}>
                    {target.agentDisplayName} {target.scope}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
          <label htmlFor="install-projection-mode">
            Projection mode
            <select
              aria-label="Projection mode"
              id="install-projection-mode"
              name="installProjectionMode"
              onChange={(event) => onInstallProjectionModeChange(event.target.value as InstallPlan['projectionMode'])}
              value={installProjectionMode}
            >
              <option value="copy">Copy</option>
              <option value="symlink">Symlink</option>
              <option value="hardlink">Hardlink</option>
              <option value="mirror-export">Mirror export</option>
            </select>
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
      {roots.length > 0 ? (
        roots.map((root) => (
          <div className="path-row" key={`${root.agent}:${root.path}`}>
            <span className={`agent-dot ${agentTone(root.agent)}`}>{root.agent.slice(0, 1)}</span>
            <span>
              <strong>{root.agent} indexed skills</strong>
              <small>{root.path}</small>
            </span>
            <span className={`status ${root.tone}`}>{root.status}</span>
          </div>
        ))
      ) : (
        <p className="empty-inline">No indexed agent roots yet.</p>
      )}
    </div>
  );
}

function BarChart({ values }: { values: number[] }): ReactElement {
  if (values.length === 0) {
    return <p className="empty-inline">No activity recorded yet.</p>;
  }

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

function firstTabForPage(page: PageKey): string {
  const firstTab = pageTabs[page][0];
  if (!firstTab) {
    throw new Error(`Missing tab configuration for ${page}`);
  }
  return firstTab;
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
