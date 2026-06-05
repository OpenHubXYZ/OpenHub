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
  ImportedSkillResult,
  InstallPlan,
  InstallTarget,
  LibraryFacets,
  LibrarySearchFilters,
  LibrarySkillSummary,
  OnboardingState,
  BaselinePreview,
  PolicyEvaluation,
  PolicyPack,
  PluginRegistry,
  PluginsState,
  ReviewCenterState,
  SecurityCenterState,
  SkillDetail,
  SkillSummary,
  SyncConflictRecord,
  SyncProfile,
  SyncCenterState,
  UsageCenterState,
  VersionComparisonReport
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

const emptyLibraryFacets: LibraryFacets = {
  sources: [],
  risks: [],
  agents: [],
  tags: [],
  favorites: { value: 'favorites', count: 0 }
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
  const [tarImportPath, setTarImportPath] = useState('');
  const [sparseGitUrl, setSparseGitUrl] = useState('');
  const [sparseGitSubpath, setSparseGitSubpath] = useState('');
  const [mirrorImportDirectory, setMirrorImportDirectory] = useState('');
  const [mirrorSignatureStatus, setMirrorSignatureStatus] =
    useState<'unsigned' | 'signed' | 'untrusted' | ''>('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [librarySearchResults, setLibrarySearchResults] = useState<SkillSummary[]>([]);
  const [libraryFavoritesOnly, setLibraryFavoritesOnly] = useState(false);
  const [librarySearchMode, setLibrarySearchMode] = useState<'fts' | 'semantic' | 'hybrid'>('fts');
  const [librarySourceFilter, setLibrarySourceFilter] = useState('');
  const [libraryRiskFilter, setLibraryRiskFilter] = useState('');
  const [libraryAgentFilter, setLibraryAgentFilter] = useState('');
  const [libraryTagFilter, setLibraryTagFilter] = useState('');
  const [libraryFacets, setLibraryFacets] = useState<LibraryFacets>(emptyLibraryFacets);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<SkillDetail | null>(null);
  const [exportDirectory, setExportDirectory] = useState('');
  const [signedExportSigner, setSignedExportSigner] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [lastCollectionId, setLastCollectionId] = useState('');
  const [collectionDirectory, setCollectionDirectory] = useState('');
  const [collectionPackageDirectory, setCollectionPackageDirectory] = useState('');
  const [installTargetRoot, setInstallTargetRoot] = useState('');
  const [installProjectionMode, setInstallProjectionMode] = useState<InstallPlan['projectionMode']>('copy');
  const [installTargets, setInstallTargets] = useState<InstallTarget[]>([]);
  const [activeInstallPlan, setActiveInstallPlan] = useState<InstallPlan | null>(null);
  const [activeMultiTargetPlans, setActiveMultiTargetPlans] = useState<InstallPlan[]>([]);
  const [lastInstallationId, setLastInstallationId] = useState('');
  const [relinkTargetRoot, setRelinkTargetRoot] = useState('');
  const [rollbackVersionId, setRollbackVersionId] = useState('');
  const [draftChangeSummary, setDraftChangeSummary] = useState('');
  const [draftSkillMarkdown, setDraftSkillMarkdown] = useState('');
  const [promoteVersionId, setPromoteVersionId] = useState('');
  const [promoteReleaseChannel, setPromoteReleaseChannel] = useState<'beta' | 'stable'>('beta');
  const [compareFromVersionId, setCompareFromVersionId] = useState('');
  const [compareToVersionId, setCompareToVersionId] = useState('');
  const [versionComparison, setVersionComparison] = useState<VersionComparisonReport | null>(null);
  const [exemptionReason, setExemptionReason] = useState('');
  const [lastExemptionId, setLastExemptionId] = useState('');
  const [policyName, setPolicyName] = useState('');
  const [policyAllowedSources, setPolicyAllowedSources] = useState('');
  const [policyBlockedRules, setPolicyBlockedRules] = useState('');
  const [policyApprovedPlugins, setPolicyApprovedPlugins] = useState('');
  const [policyRequiredScanLevel, setPolicyRequiredScanLevel] =
    useState<'safe' | 'warning' | 'critical'>('safe');
  const [activePolicyPack, setActivePolicyPack] = useState<PolicyPack | null>(null);
  const [policyEvaluation, setPolicyEvaluation] = useState<PolicyEvaluation | null>(null);
  const [baselineOutputDirectory, setBaselineOutputDirectory] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [baselinePackageDirectory, setBaselinePackageDirectory] = useState('');
  const [baselinePreview, setBaselinePreview] = useState<BaselinePreview | null>(null);
  const [syncRemoteUrl, setSyncRemoteUrl] = useState('');
  const [syncMode, setSyncMode] = useState<'shared-folder' | 'git' | 'rest' | 'mock-rest'>('shared-folder');
  const [syncProfile, setSyncProfile] = useState<SyncProfile | null>(null);
  const [syncCredentialLabel, setSyncCredentialLabel] = useState('');
  const [syncCredentialToken, setSyncCredentialToken] = useState('');
  const [inspectedSyncCredential, setInspectedSyncCredential] = useState<{
    authRef: string;
    label: string;
    masked: string;
  } | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictRecord[]>([]);
  const [pluginRootPath, setPluginRootPath] = useState('');
  const [pluginDirectoryPath, setPluginDirectoryPath] = useState('');
  const [activePluginDirectoryId, setActivePluginDirectoryId] = useState('');
  const [pluginId, setPluginId] = useState('');
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry | null>(null);
  const [discoverSourceName, setDiscoverSourceName] = useState('');
  const [discoverSourceUrl, setDiscoverSourceUrl] = useState('');
  const [discoverSource, setDiscoverSource] = useState<DiscoverSource | null>(null);
  const [discoverPreviewSkills, setDiscoverPreviewSkills] = useState<DiscoverSkillPreview[]>([]);
  const [migrationSourcePath, setMigrationSourcePath] = useState('');
  const [migrationAdapter, setMigrationAdapter] =
    useState<'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client'>('openskills');
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(() => !window.theOpenHub?.getOnboardingState);
  const [projectRootAgentCode, setProjectRootAgentCode] =
    useState<'codex' | 'claude' | 'gemini' | 'opencode'>('codex');
  const [projectRootPath, setProjectRootPath] = useState('');
  const [operationMessage, setOperationMessage] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const viewModel = useMemo(() => createWorkspaceViewModel(workspaceState), [workspaceState]);

  const applyWorkspaceState = useCallback((state: DesktopWorkspaceState) => {
    setWorkspaceState({
      ...state,
      plugins: normalizePluginsState(state.plugins)
    });
  }, []);

  const refreshLibraryFacets = useCallback(async () => {
    if (!window.theOpenHub?.getLibraryFacets) {
      return;
    }

    setLibraryFacets(await window.theOpenHub.getLibraryFacets());
  }, []);

  useEffect(() => {
    void refreshLibraryFacets();
  }, [refreshLibraryFacets]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateOnboardingState(): Promise<void> {
      if (!window.theOpenHub?.getOnboardingState) {
        setOnboardingChecked(true);
        return;
      }

      const state = await window.theOpenHub.getOnboardingState();
      if (!cancelled) {
        setOnboardingState(state);
        setOnboardingChecked(true);
        if (state.detectedRoots.length > 0) {
          setInstallTargets(state.detectedRoots);
          setInstallTargetRoot((current) => current || state.detectedRoots[0]?.rootPath || '');
        }
      }
    }

    void hydrateOnboardingState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspaceState(): Promise<void> {
      if (!onboardingChecked || onboardingState?.completed === false) {
        return;
      }

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
          if (!scan) {
            if (!cancelled) {
              applyWorkspaceState(runtimeState);
            }
            return;
          }
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
  }, [applyWorkspaceState, initialLibrarySkills.length, onboardingChecked, onboardingState?.completed]);

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

  function recordImportedSkill(imported: ImportedSkillResult, status: string): void {
    setSelectedSkillDetail(null);
    setWorkspaceState((current) => ({
      ...current,
      skills: [imported.skill, ...current.skills.filter((skill) => skill.id !== imported.skill.id)],
      managementFlow: {
        ...current.managementFlow,
        importItems: [{ label: imported.skill.name, status }, ...current.managementFlow.importItems].slice(0, 8)
      }
    }));
  }

  async function handleImportTar(): Promise<void> {
    if (!window.theOpenHub?.importTar || tarImportPath.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importTar(tarImportPath.trim());
    recordImportedSkill(imported, 'tar imported');
    setOperationMessage(`TAR import ${imported.skill.name}`);
  }

  async function handleImportGitSparse(): Promise<void> {
    if (!window.theOpenHub?.importGitSparse || sparseGitUrl.trim().length === 0 || sparseGitSubpath.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importGitSparse({
      gitUrl: sparseGitUrl.trim(),
      subpath: sparseGitSubpath.trim()
    });
    recordImportedSkill(imported, 'sparse imported');
    setOperationMessage(`Sparse Git import ${imported.skill.name}`);
  }

  async function handleImportMirror(): Promise<void> {
    if (!window.theOpenHub?.importMirror || mirrorImportDirectory.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importMirror(mirrorImportDirectory.trim());
    recordImportedSkill(imported, 'mirror imported');
    setMirrorSignatureStatus(imported.signatureStatus ?? 'unsigned');
    setOperationMessage(`Mirror import ${imported.skill.name}`);
  }

  async function handleSearchLibrary(): Promise<void> {
    if (!window.theOpenHub?.searchLibrary || librarySearchQuery.trim().length === 0) {
      setLibrarySearchResults([]);
      return;
    }

    const filters = librarySearchFilters({
      sourceType: librarySourceFilter,
      riskStatus: libraryRiskFilter,
      agentCode: libraryAgentFilter,
      tag: libraryTagFilter
    });
    setLibrarySearchResults(
      await window.theOpenHub.searchLibrary(librarySearchQuery.trim(), {
        favoritesOnly: libraryFavoritesOnly,
        ...(librarySearchMode === 'fts' ? {} : { mode: librarySearchMode }),
        ...(hasLibrarySearchFilters(filters) ? { filters } : {})
      })
    );
  }

  function handleResetLibraryFilters(): void {
    setLibraryFavoritesOnly(false);
    setLibrarySearchMode('fts');
    setLibrarySourceFilter('');
    setLibraryRiskFilter('');
    setLibraryAgentFilter('');
    setLibraryTagFilter('');
  }

  async function handleSetFavorite(skill: SkillSummary): Promise<void> {
    if (!window.theOpenHub?.setFavorite) {
      return;
    }

    const favorite = !skill.favorite;
    const updated = await window.theOpenHub.setFavorite(skill.id, favorite);
    setLibrarySearchResults((current) =>
      current.map((candidate) => (candidate.id === updated.id ? { ...candidate, favorite: updated.favorite } : candidate))
    );
    setWorkspaceState((current) => ({
      ...current,
      skills: current.skills.map((candidate) =>
        candidate.id === updated.id ? { ...candidate, favorite: updated.favorite } : candidate
      ),
      librarySkills: current.librarySkills.map((candidate) =>
        candidate.id === updated.id ? { ...candidate, favorite: updated.favorite } : candidate
      )
    }));
    if (selectedSkillDetail?.skill.id === updated.id) {
      setSelectedSkillDetail({
        ...selectedSkillDetail,
        skill: { ...selectedSkillDetail.skill, favorite: updated.favorite }
      });
    }
    await refreshLibraryFacets();
  }

  async function handleSelectSkill(skillId: string): Promise<void> {
    if (!window.theOpenHub?.getSkillDetail) {
      return;
    }

    const detail = await window.theOpenHub.getSkillDetail(skillId);
    setSelectedSkillDetail(detail);
    setRollbackVersionId(detail.versions.at(-1)?.versionId ?? '');
    setLastInstallationId(detail.installations[0]?.installationId ?? lastInstallationId);
    setRelinkTargetRoot(detail.installations[0]?.rootPath ?? '');
    setDraftSkillMarkdown(detail.skillMarkdown);
    setDraftChangeSummary('');
    setPromoteVersionId(detail.versions[0]?.versionId ?? '');
    setCompareFromVersionId(detail.versions.at(-1)?.versionId ?? '');
    setCompareToVersionId(detail.versions[0]?.versionId ?? '');
    setVersionComparison(null);
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

  async function handleExportSignedSkill(): Promise<void> {
    const skill = selectedSkillDetail?.skill ?? workspaceState.skills[0];
    if (
      !skill ||
      !window.theOpenHub?.exportSignedSkill ||
      exportDirectory.trim().length === 0 ||
      signedExportSigner.trim().length === 0
    ) {
      return;
    }

    const exported = await window.theOpenHub.exportSignedSkill({
      skillId: skill.id,
      outputDirectory: exportDirectory.trim(),
      signer: signedExportSigner.trim()
    });
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        importItems: [
          { label: skill.name, status: `signed export ${exported.outputDirectory}` },
          ...current.managementFlow.importItems
        ].slice(0, 8)
      }
    }));
    setOperationMessage(`Signed export ${skill.name}`);
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

  async function handleCreateMultiTargetPlans(): Promise<void> {
    const skill = selectedSkillDetail?.skill ?? workspaceState.skills[0];
    if (!skill || !window.theOpenHub?.createMultiTargetInstallPlan || installTargets.length === 0) {
      return;
    }

    const plans = await window.theOpenHub.createMultiTargetInstallPlan({
      skillId: skill.id,
      projectionMode: installProjectionMode,
      targets: installTargets.map((target) => ({
        rootPath: target.rootPath,
        agentCode: target.agentCode,
        agentDisplayName: target.agentDisplayName,
        adapterVersion: target.adapterVersion,
        scope: target.scope,
        ...(target.rootKind ? { rootKind: target.rootKind } : {})
      }))
    });
    setActiveMultiTargetPlans(plans);
    setOperationMessage(`Planned ${plans.length} targets`);
  }

  async function handleApplyMultiTargetPlans(): Promise<void> {
    if (activeMultiTargetPlans.length === 0 || !window.theOpenHub?.applyMultiTargetInstallPlan) {
      return;
    }

    const result = await window.theOpenHub.applyMultiTargetInstallPlan(activeMultiTargetPlans);
    setLastInstallationId(result.installed[0]?.installationId ?? lastInstallationId);
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        installResult: {
          status: 'multi-target',
          message: `Installed ${result.installed.length} targets; blocked ${result.blocked.length}.`
        }
      }
    }));
    setOperationMessage(`Installed ${result.installed.length}; blocked ${result.blocked.length}`);
  }

  async function handleAddProjectRoot(): Promise<void> {
    if (!window.theOpenHub?.addProjectRoot || projectRootPath.trim().length === 0) {
      return;
    }

    const root = await window.theOpenHub.addProjectRoot({
      agentCode: projectRootAgentCode,
      rootPath: projectRootPath.trim()
    });
    setInstallTargets((current) => {
      const existing = current.filter(
        (target) => `${target.agentCode}:${target.rootPath}:${target.scope}` !== `${root.agentCode}:${root.rootPath}:${root.scope}`
      );
      return [...existing, root].sort((left, right) =>
        `${left.agentCode}:${left.rootPath}`.localeCompare(`${right.agentCode}:${right.rootPath}`)
      );
    });
    setInstallTargetRoot((current) => current || root.rootPath);
    setOperationMessage(`Added ${root.agentDisplayName} project root`);
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

  async function handleReinstall(): Promise<void> {
    if (!window.theOpenHub?.reinstall || lastInstallationId.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.reinstall(lastInstallationId.trim());
    setWorkspaceState((current) => ({
      ...current,
      managementFlow: {
        ...current.managementFlow,
        installResult: {
          status: result.status,
          message: `Reinstalled app-owned files for ${result.installationId}.`
        }
      }
    }));
    setOperationMessage(`Reinstalled ${result.installationId}`);
  }

  async function handleRelink(): Promise<void> {
    const installation = currentInstallation(selectedSkillDetail, lastInstallationId);
    if (!window.theOpenHub?.relink || !installation || relinkTargetRoot.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.relink({
      installationId: installation.installationId,
      targetRoot: relinkTargetRoot.trim(),
      agentCode: agentCodeForDisplay(installation.agent),
      agentDisplayName: installation.agent,
      adapterVersion: 'builtin',
      scope: installation.scope,
      projectionMode: installation.projectionMode ?? 'copy'
    });
    setSelectedSkillDetail((current) =>
      current
        ? {
            ...current,
            installations: current.installations.map((item) =>
              item.installationId === result.installationId
                ? {
                    ...item,
                    rootPath: result.targetRoot,
                    installPath: `${result.targetRoot}/${current.skill.name.toLowerCase().replace(/\s+/g, '-')}`,
                    projectionMode: result.projectionMode,
                    readOnlyLocked: false
                  }
                : item
            )
          }
        : current
    );
    setOperationMessage(`Relinked ${result.installationId}`);
  }

  async function handleSetReadOnlyLock(locked: boolean): Promise<void> {
    if (!window.theOpenHub?.setReadOnlyLock || lastInstallationId.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.setReadOnlyLock(lastInstallationId.trim(), locked);
    setSelectedSkillDetail((current) =>
      current
        ? {
            ...current,
            installations: current.installations.map((item) =>
              item.installationId === result.installationId
                ? { ...item, readOnlyLocked: result.readOnlyLocked }
                : item
            )
          }
        : current
    );
    setOperationMessage(`${result.status === 'locked' ? 'Locked' : 'Unlocked'} ${result.installationId}`);
  }

  async function handleRollback(): Promise<void> {
    if (!window.theOpenHub?.rollbackVersion || lastInstallationId.trim().length === 0 || rollbackVersionId.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.rollbackVersion(lastInstallationId.trim(), rollbackVersionId.trim());
    setOperationMessage(`Rolled back ${result.installationId}`);
  }

  async function handleCreateDraftVersion(): Promise<void> {
    const skill = selectedSkillDetail?.skill;
    if (!skill || !window.theOpenHub?.createDraftVersion || draftSkillMarkdown.trim().length === 0) {
      return;
    }

    const draft = await window.theOpenHub.createDraftVersion({
      skillId: skill.id,
      changeSummary: draftChangeSummary.trim(),
      files: [{ relativePath: 'SKILL.md', content: draftSkillMarkdown }]
    });
    setSelectedSkillDetail((current) =>
      current
        ? {
            ...current,
            versions: [draft, ...current.versions.filter((version) => version.versionId !== draft.versionId)]
          }
        : current
    );
    setPromoteVersionId(draft.versionId);
    setCompareToVersionId(draft.versionId);
    setOperationMessage(`Created draft v${draft.versionNo}`);
  }

  async function handlePromoteVersion(): Promise<void> {
    if (!window.theOpenHub?.promoteVersion || promoteVersionId.trim().length === 0) {
      return;
    }

    const promoted = await window.theOpenHub.promoteVersion(promoteVersionId.trim(), promoteReleaseChannel);
    setSelectedSkillDetail((current) =>
      current
        ? {
            ...current,
            versions: current.versions.map((version) =>
              version.versionId === promoted.versionId ? promoted : version
            )
          }
        : current
    );
    setOperationMessage(`Promoted v${promoted.versionNo} to ${promoted.releaseChannel}`);
  }

  async function handleCompareVersions(): Promise<void> {
    if (
      !window.theOpenHub?.compareVersions ||
      compareFromVersionId.trim().length === 0 ||
      compareToVersionId.trim().length === 0
    ) {
      return;
    }

    const comparison = await window.theOpenHub.compareVersions(
      compareFromVersionId.trim(),
      compareToVersionId.trim()
    );
    setVersionComparison(comparison);
    setOperationMessage(`Compared ${comparison.files.length} files`);
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
    await refreshLibraryFacets();
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
    await refreshLibraryFacets();
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

  async function handleCreatePolicyPack(): Promise<void> {
    if (!window.theOpenHub?.createPolicyPack || policyName.trim().length === 0) {
      return;
    }

    const policy = await window.theOpenHub.createPolicyPack({
      name: policyName.trim(),
      allowedSources: splitList(policyAllowedSources),
      blockedRules: splitList(policyBlockedRules),
      requiredScanLevel: policyRequiredScanLevel,
      approvedPlugins: splitList(policyApprovedPlugins)
    });
    setActivePolicyPack(policy);
    if (window.theOpenHub.setActivePolicyPack) {
      await window.theOpenHub.setActivePolicyPack(policy.id);
    }
    setOperationMessage(`Active policy ${policy.name}`);
  }

  async function handleEvaluatePolicy(): Promise<void> {
    if (!activePolicyPack || !window.theOpenHub?.evaluatePolicy) {
      return;
    }

    const evaluation = await window.theOpenHub.evaluatePolicy({
      policyPackId: activePolicyPack.id,
      sourceType: 'git',
      findingRuleIds: [],
      scanLevel: 'safe',
      pluginIds: splitList(policyApprovedPlugins)
    });
    setPolicyEvaluation(evaluation);
    setOperationMessage(evaluation.allowed ? 'Policy allows Git source' : 'Policy blocks Git source');
  }

  async function handleExportBaseline(): Promise<void> {
    if (!activePolicyPack || !window.theOpenHub?.exportBaseline || baselineOutputDirectory.trim().length === 0) {
      return;
    }

    const result = await window.theOpenHub.exportBaseline({
      outputDirectory: baselineOutputDirectory.trim(),
      name: baselineName.trim() || activePolicyPack.name,
      collectionIds: [],
      policyPackId: activePolicyPack.id,
      rootTemplates: [{ agentCode: 'codex', scope: 'project', rootPathTemplate: '.codex/skills' }]
    });
    setBaselinePackageDirectory((current) => current || result.outputDirectory);
    setOperationMessage(`Exported baseline ${result.outputDirectory}`);
  }

  async function handlePreviewBaseline(): Promise<void> {
    if (!window.theOpenHub?.previewBaseline || baselinePackageDirectory.trim().length === 0) {
      return;
    }

    const preview = await window.theOpenHub.previewBaseline(baselinePackageDirectory.trim());
    setBaselinePreview(preview);
    setOperationMessage(`Previewed baseline ${preview.name}`);
  }

  async function handleApplyBaseline(): Promise<void> {
    if (!window.theOpenHub?.applyBaseline || baselinePackageDirectory.trim().length === 0) {
      return;
    }

    const preview = await window.theOpenHub.applyBaseline(baselinePackageDirectory.trim(), true);
    setBaselinePreview(preview);
    setOperationMessage(`Applied baseline ${preview.name}`);
  }

  async function handleCreateSyncProfile(): Promise<void> {
    if (!window.theOpenHub?.createSyncProfile || syncRemoteUrl.trim().length === 0) {
      return;
    }

    const credential =
      syncMode === 'rest' && syncCredentialLabel.trim().length > 0 && syncCredentialToken.trim().length > 0
        ? {
            auth: {
              label: syncCredentialLabel.trim(),
              token: syncCredentialToken
            }
          }
        : {};
    const profile = await window.theOpenHub.createSyncProfile({
      mode: syncMode,
      remoteUrl: syncRemoteUrl.trim(),
      enabled: true,
      ...credential
    });
    setSyncProfile(profile);
    setSyncCredentialToken('');
    setInspectedSyncCredential(null);
    setWorkspaceState((current) => ({
      ...current,
      syncCenter: {
        ...current.syncCenter,
        profiles: [{ mode: profile.mode, status: profile.enabled ? 'enabled' : 'disabled' }, ...current.syncCenter.profiles]
      }
    }));
    setOperationMessage(`Created sync profile ${profile.mode}`);
  }

  async function handleInspectSyncCredential(): Promise<void> {
    if (!syncProfile?.authRef || !window.theOpenHub?.inspectSyncCredential) {
      return;
    }

    const credential = await window.theOpenHub.inspectSyncCredential(syncProfile.authRef);
    setInspectedSyncCredential(credential);
    setOperationMessage(credential ? 'Credential inspected' : 'Credential unavailable');
  }

  async function handleDeleteSyncCredential(): Promise<void> {
    if (!syncProfile?.authRef || !window.theOpenHub?.deleteSyncCredential) {
      return;
    }

    await window.theOpenHub.deleteSyncCredential(syncProfile.authRef);
    setSyncProfile({ ...syncProfile, authRef: null });
    setInspectedSyncCredential(null);
    setOperationMessage('Credential deleted');
  }

  async function handleLoadSyncConflicts(): Promise<void> {
    if (!window.theOpenHub?.listSyncConflicts) {
      return;
    }

    const conflicts = await window.theOpenHub.listSyncConflicts(syncProfile?.id);
    setSyncConflicts(conflicts);
    setWorkspaceState((current) => ({
      ...current,
      syncCenter: {
        ...current.syncCenter,
        conflicts: conflicts.map((conflict) => ({ entityType: conflict.entityType, status: conflict.status }))
      }
    }));
    setOperationMessage(`Loaded ${conflicts.length} conflicts`);
  }

  async function handleApplySyncConflict(
    conflictId: string,
    resolution:
      | {
          type: 'metadata';
          fields: Record<string, { source: 'base' | 'local' | 'remote' | 'manual'; value?: unknown }>;
        }
      | { type: 'file-drafts' }
      | { type: 'delete'; action: 'soft-delete' }
  ): Promise<void> {
    if (!window.theOpenHub?.applySyncConflict) {
      return;
    }

    const applied = await window.theOpenHub.applySyncConflict({
      conflictId,
      confirm: true,
      resolution
    });
    setSyncConflicts((current) => current.map((conflict) => (conflict.id === applied.id ? applied : conflict)));
    setOperationMessage(`Applied ${applied.id}`);
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
        ...current.plugins,
        plugins: [
          {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            rootPath: plugin.rootPath,
            status: plugin.status,
            signatureStatus: plugin.signatureStatus,
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

  async function handleAddPluginDirectory(): Promise<void> {
    if (!window.theOpenHub?.addPluginDirectory || pluginDirectoryPath.trim().length === 0) {
      return;
    }

    const directory = await window.theOpenHub.addPluginDirectory(pluginDirectoryPath.trim());
    setActivePluginDirectoryId(directory.id);
    setWorkspaceState((current) => ({
      ...current,
      plugins: {
        ...current.plugins,
        directories: [
          directory,
          ...current.plugins.directories.filter((item) => item.id !== directory.id)
        ]
      }
    }));
    setOperationMessage(`Added plugin directory ${directory.rootPath}`);
  }

  async function handleScanPluginDirectory(): Promise<void> {
    if (!window.theOpenHub?.scanPluginDirectory) {
      return;
    }

    const directoryId = activePluginDirectoryId || workspaceState.plugins.directories[0]?.id;
    if (!directoryId) {
      return;
    }

    const result = await window.theOpenHub.scanPluginDirectory(directoryId);
    setActivePluginDirectoryId(result.directory.id);
    setPluginRootPath(result.catalog.find((entry) => !entry.installed)?.rootPath ?? pluginRootPath);
    setWorkspaceState((current) => ({
      ...current,
      plugins: {
        ...current.plugins,
        directories: [
          result.directory,
          ...current.plugins.directories.filter((item) => item.id !== result.directory.id)
        ],
        catalog: [
          ...result.catalog,
          ...current.plugins.catalog.filter((item) => item.directoryId !== result.directory.id)
        ]
      }
    }));
    setOperationMessage(`Scanned ${result.catalog.length} plugin packages`);
  }

  async function handleInstallCatalogPlugin(): Promise<void> {
    const candidate = workspaceState.plugins.catalog.find((entry) => !entry.installed && entry.status === 'available');
    if (!candidate) {
      return;
    }

    setPluginRootPath(candidate.rootPath);
    const plugin = await window.theOpenHub?.installPlugin?.(candidate.rootPath);
    if (!plugin) {
      return;
    }

    setPluginId(plugin.id);
    setWorkspaceState((current) => ({
      ...current,
      plugins: {
        ...current.plugins,
        catalog: current.plugins.catalog.map((entry) =>
          entry.pluginId === plugin.id ? { ...entry, installed: true } : entry
        ),
        plugins: [
          {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            rootPath: plugin.rootPath,
            status: plugin.status,
            signatureStatus: plugin.signatureStatus,
            capabilities: [],
            permissions: [],
            errors: []
          },
          ...current.plugins.plugins.filter((item) => item.id !== plugin.id)
        ]
      }
    }));
    if (window.theOpenHub?.getPluginRegistry) {
      setPluginRegistry(await window.theOpenHub.getPluginRegistry());
    }
    setOperationMessage(`Installed catalog plugin ${plugin.name}`);
  }

  async function handleRemovePluginDirectory(): Promise<void> {
    if (!window.theOpenHub?.removePluginDirectory) {
      return;
    }

    const directoryId = activePluginDirectoryId || workspaceState.plugins.directories[0]?.id;
    if (!directoryId) {
      return;
    }

    await window.theOpenHub.removePluginDirectory(directoryId);
    setWorkspaceState((current) => ({
      ...current,
      plugins: {
        ...current.plugins,
        directories: current.plugins.directories.filter((item) => item.id !== directoryId),
        catalog: current.plugins.catalog.filter((item) => item.directoryId !== directoryId)
      }
    }));
    setActivePluginDirectoryId('');
    setOperationMessage('Removed plugin directory');
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
      adapter: migrationAdapter,
      sourcePath: migrationSourcePath.trim()
    });
    setDiscoverPreviewSkills(preview.skills);
    setOperationMessage(`Migration preview ${preview.skills.length} skills`);
  }

  function handleMigrationItemSelection(path: string, selected: boolean): void {
    setDiscoverPreviewSkills((current) =>
      current.map((skill) => (skill.path === path ? { ...skill, selected } : skill))
    );
  }

  function handleMigrationImportLabelChange(path: string, importLabel: string): void {
    setDiscoverPreviewSkills((current) =>
      current.map((skill) => (skill.path === path ? { ...skill, importLabel } : skill))
    );
  }

  function handleSelectAllMigrationItems(): void {
    setDiscoverPreviewSkills((current) => current.map((skill) => ({ ...skill, selected: true })));
  }

  function handleSelectNoMigrationItems(): void {
    setDiscoverPreviewSkills((current) => current.map((skill) => ({ ...skill, selected: false })));
  }

  async function handleImportMigration(): Promise<void> {
    if (!window.theOpenHub?.importMigration || migrationSourcePath.trim().length === 0 || discoverPreviewSkills.length === 0) {
      return;
    }

    const selectedSkills = discoverPreviewSkills.filter((skill) => skill.selected ?? true);
    if (selectedSkills.length === 0) {
      setOperationMessage('No migration imports selected');
      return;
    }

    const mapped = discoverPreviewSkills.some(
      (skill) => skill.selected === false || (skill.importLabel && skill.importLabel.trim().length > 0)
    );
    const importRequest = {
      adapter: migrationAdapter,
      sourcePath: migrationSourcePath.trim(),
      ...(mapped
        ? {
            items: discoverPreviewSkills.map((skill) => ({
              path: skill.path,
              selected: skill.selected ?? true,
              ...(skill.importLabel ? { importLabel: skill.importLabel } : {})
            }))
          }
        : { paths: selectedSkills.map((skill) => skill.path) })
    };
    const imported = await window.theOpenHub.importMigration(importRequest);
    setWorkspaceState((current) => ({
      ...current,
      skills: [...imported.map((item) => item.skill), ...current.skills],
      managementFlow: {
        ...current.managementFlow,
        importItems: [
          ...imported.map((item) => ({ label: item.skill.name, status: 'migration imported' })),
          ...current.managementFlow.importItems
        ].slice(0, 8)
      }
    }));
    setOperationMessage(imported[0] ? `Imported ${imported[0].skill.name}` : 'No migration imports selected');
  }

  async function handleCompleteOnboarding(): Promise<void> {
    if (!window.theOpenHub?.completeOnboarding) {
      setOnboardingState((current) => (current ? { ...current, completed: true } : current));
      return;
    }

    const state = await window.theOpenHub.completeOnboarding(true);
    setOnboardingState(state);
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

  if (!onboardingChecked) {
    return (
      <main className="screen">
        <section className="app-frame" aria-label="OpenHub workspace">
          <section className="content">
            <section className="panel" aria-label="Loading onboarding">
              <PanelHeader tag="Local" title="Preparing workspace" />
            </section>
          </section>
        </section>
      </main>
    );
  }

  if (onboardingState?.completed === false) {
    return (
      <FirstLaunchWizard
        detectedRoots={onboardingState.detectedRoots}
        discoverPreviewSkills={discoverPreviewSkills}
        migrationAdapter={migrationAdapter}
        migrationSourcePath={migrationSourcePath}
        onComplete={() => {
          void handleCompleteOnboarding();
        }}
        onImportMigration={() => {
          void handleImportMigration();
        }}
        onMigrationAdapterChange={setMigrationAdapter}
        onMigrationImportLabelChange={handleMigrationImportLabelChange}
        onMigrationItemSelection={handleMigrationItemSelection}
        onMigrationSourcePathChange={setMigrationSourcePath}
        onPreviewMigration={() => {
          void handlePreviewMigration();
        }}
        onSelectAllMigrationItems={handleSelectAllMigrationItems}
        onSelectNoMigrationItems={handleSelectNoMigrationItems}
        operationMessage={operationMessage}
      />
    );
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
                  draftChangeSummary={draftChangeSummary}
                  draftSkillMarkdown={draftSkillMarkdown}
                  exemptionReason={exemptionReason}
                  exportDirectory={exportDirectory}
                  gitImportUrl={gitImportUrl}
                  hasImportBridge={Boolean(window.theOpenHub?.importLocalFolder)}
                  hasInstallBridge={Boolean(window.theOpenHub?.createInstallPlan)}
                  hasScanBridge={Boolean(window.theOpenHub?.scanAgentRoots)}
                  hasSecurityBridge={Boolean(window.theOpenHub?.scanSkill)}
                  inspectedSyncCredential={inspectedSyncCredential}
                  activePolicyPack={activePolicyPack}
                  baselineName={baselineName}
                  baselineOutputDirectory={baselineOutputDirectory}
                  baselinePackageDirectory={baselinePackageDirectory}
                  baselinePreview={baselinePreview}
                  installTargets={installTargets}
                  installProjectionMode={installProjectionMode}
                  importPath={importPath}
                  installTargetRoot={installTargetRoot}
                  libraryAgentFilter={libraryAgentFilter}
                  libraryFacets={libraryFacets}
                  libraryFavoritesOnly={libraryFavoritesOnly}
                  libraryRiskFilter={libraryRiskFilter}
                  librarySearchMode={librarySearchMode}
                  lastInstallationId={lastInstallationId}
                  librarySearchQuery={librarySearchQuery}
                  librarySearchResults={librarySearchResults}
                  librarySourceFilter={librarySourceFilter}
                  libraryTagFilter={libraryTagFilter}
                  mirrorImportDirectory={mirrorImportDirectory}
                  mirrorSignatureStatus={mirrorSignatureStatus}
                  migrationSourcePath={migrationSourcePath}
                  policyAllowedSources={policyAllowedSources}
                  policyApprovedPlugins={policyApprovedPlugins}
                  policyBlockedRules={policyBlockedRules}
                  policyEvaluation={policyEvaluation}
                  policyName={policyName}
                  policyRequiredScanLevel={policyRequiredScanLevel}
                  compareFromVersionId={compareFromVersionId}
                  compareToVersionId={compareToVersionId}
                  promoteReleaseChannel={promoteReleaseChannel}
                  promoteVersionId={promoteVersionId}
                  syncConflicts={syncConflicts}
                  versionComparison={versionComparison}
                  onAddDiscoverSource={() => {
                    void handleAddDiscoverSource();
                  }}
                  onApplyInstallPlan={() => {
                    void handleApplyInstallPlan();
                  }}
                  onApplyMultiTargetPlans={() => {
                    void handleApplyMultiTargetPlans();
                  }}
                  onApplySyncConflict={(conflictId, resolution) => {
                    void handleApplySyncConflict(conflictId, resolution);
                  }}
                  onAuthorizePlugin={() => {
                    void handleAuthorizePlugin();
                  }}
                  onAddPluginDirectory={() => {
                    void handleAddPluginDirectory();
                  }}
                  onCollectionDirectoryChange={setCollectionDirectory}
                  onCollectionNameChange={setCollectionName}
                  onCollectionPackageDirectoryChange={setCollectionPackageDirectory}
                  onCreateInstallPlan={() => {
                    void handleCreateInstallPlan();
                  }}
                  onCreateMultiTargetPlans={() => {
                    void handleCreateMultiTargetPlans();
                  }}
                  onCreateCollection={() => {
                    void handleCreateCollection();
                  }}
                  onCreateDraftVersion={() => {
                    void handleCreateDraftVersion();
                  }}
                  onCreateExemption={() => {
                    void handleCreateExemption();
                  }}
                  onCreatePolicyPack={() => {
                    void handleCreatePolicyPack();
                  }}
                  onCreateSyncProfile={() => {
                    void handleCreateSyncProfile();
                  }}
                  onDeleteSyncCredential={() => {
                    void handleDeleteSyncCredential();
                  }}
                  onDisablePlugin={() => {
                    void handleDisablePlugin();
                  }}
                  onDiscoverSourceNameChange={setDiscoverSourceName}
                  onDiscoverSourceUrlChange={setDiscoverSourceUrl}
                  onDraftChangeSummaryChange={setDraftChangeSummary}
                  onDraftSkillMarkdownChange={setDraftSkillMarkdown}
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
                  onExportSignedSkill={() => {
                    void handleExportSignedSkill();
                  }}
                  onExportBaseline={() => {
                    void handleExportBaseline();
                  }}
                  onGitImportUrlChange={setGitImportUrl}
                  onInspectSyncCredential={() => {
                    void handleInspectSyncCredential();
                  }}
                  onImportCollection={() => {
                    void handleImportCollection();
                  }}
                  onImportGit={() => {
                    void handleImportGit();
                  }}
                  onImportGitSparse={() => {
                    void handleImportGitSparse();
                  }}
                  onImportLocalFolder={() => {
                    void handleImportLocalFolder();
                  }}
                  onImportMirror={() => {
                    void handleImportMirror();
                  }}
                  onImportPathChange={setImportPath}
                  onImportTar={() => {
                    void handleImportTar();
                  }}
                  onImportZip={() => {
                    void handleImportZip();
                  }}
                  onInstallPlugin={() => {
                    void handleInstallPlugin();
                  }}
                  onInstallCatalogPlugin={() => {
                    void handleInstallCatalogPlugin();
                  }}
                  onInstallProjectionModeChange={setInstallProjectionMode}
                  onInstallTargetRootChange={setInstallTargetRoot}
                  onLibraryFavoritesOnlyChange={setLibraryFavoritesOnly}
                  onLibraryAgentFilterChange={setLibraryAgentFilter}
                  onLibraryRiskFilterChange={setLibraryRiskFilter}
                  onLibrarySearchModeChange={setLibrarySearchMode}
                  onLibrarySearch={() => {
                    void handleSearchLibrary();
                  }}
                  onLibrarySearchQueryChange={setLibrarySearchQuery}
                  onLibrarySourceFilterChange={setLibrarySourceFilter}
                  onLibraryTagFilterChange={setLibraryTagFilter}
                  onResetLibraryFilters={handleResetLibraryFilters}
                  onSetFavorite={(skill) => {
                    void handleSetFavorite(skill);
                  }}
                  onMirrorImportDirectoryChange={setMirrorImportDirectory}
                  onMigrationSourcePathChange={setMigrationSourcePath}
                  onPluginRootPathChange={setPluginRootPath}
                  onPluginDirectoryPathChange={setPluginDirectoryPath}
                  onPreviewDiscoverSource={() => {
                    void handlePreviewDiscoverSource();
                  }}
                  onPreviewBaseline={() => {
                    void handlePreviewBaseline();
                  }}
                  onPreviewMigration={() => {
                    void handlePreviewMigration();
                  }}
                  onRemovePluginDirectory={() => {
                    void handleRemovePluginDirectory();
                  }}
                  onRevokeExemption={() => {
                    void handleRevokeExemption();
                  }}
                  onRelink={() => {
                    void handleRelink();
                  }}
                  onRelinkTargetRootChange={setRelinkTargetRoot}
                  onReinstall={() => {
                    void handleReinstall();
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
                  onScanPluginDirectory={() => {
                    void handleScanPluginDirectory();
                  }}
                  onSecurityRescanAll={() => {
                    void handleSecurityRescanAll();
                  }}
                  onSetReadOnlyLock={(locked) => {
                    void handleSetReadOnlyLock(locked);
                  }}
                  onSelectSkill={(skillId) => {
                    void handleSelectSkill(skillId);
                  }}
                  onApplyBaseline={() => {
                    void handleApplyBaseline();
                  }}
                  onBaselineNameChange={setBaselineName}
                  onBaselineOutputDirectoryChange={setBaselineOutputDirectory}
                  onBaselinePackageDirectoryChange={setBaselinePackageDirectory}
                  onEvaluatePolicy={() => {
                    void handleEvaluatePolicy();
                  }}
                  onPolicyAllowedSourcesChange={setPolicyAllowedSources}
                  onPolicyApprovedPluginsChange={setPolicyApprovedPlugins}
                  onPolicyBlockedRulesChange={setPolicyBlockedRules}
                  onPolicyNameChange={setPolicyName}
                  onPolicyRequiredScanLevelChange={setPolicyRequiredScanLevel}
                  onCompareFromVersionIdChange={setCompareFromVersionId}
                  onCompareToVersionIdChange={setCompareToVersionId}
                  onCompareVersions={() => {
                    void handleCompareVersions();
                  }}
                  onPromoteReleaseChannelChange={setPromoteReleaseChannel}
                  onPromoteVersion={() => {
                    void handlePromoteVersion();
                  }}
                  onPromoteVersionIdChange={setPromoteVersionId}
                  onSignedExportSignerChange={setSignedExportSigner}
                  onSparseGitSubpathChange={setSparseGitSubpath}
                  onSparseGitUrlChange={setSparseGitUrl}
                  onSyncCredentialLabelChange={setSyncCredentialLabel}
                  onSyncCredentialTokenChange={setSyncCredentialToken}
                  onLoadSyncConflicts={() => {
                    void handleLoadSyncConflicts();
                  }}
                  onSyncModeChange={setSyncMode}
                  onSyncPushPull={() => {
                    void handleSyncPushPull();
                  }}
                  onSyncRemoteUrlChange={setSyncRemoteUrl}
                  onUninstall={() => {
                    void handleUninstall();
                  }}
                  onAddProjectRoot={() => {
                    void handleAddProjectRoot();
                  }}
                  onProjectRootAgentCodeChange={setProjectRootAgentCode}
                  onProjectRootPathChange={setProjectRootPath}
                  onTarImportPathChange={setTarImportPath}
                  onZipImportPathChange={setZipImportPath}
                  operationMessage={operationMessage}
                  pluginRegistry={pluginRegistry}
                  pluginDirectoryPath={pluginDirectoryPath}
                  pluginRootPath={pluginRootPath}
                  projectRootAgentCode={projectRootAgentCode}
                  projectRootPath={projectRootPath}
                  rollbackVersionId={rollbackVersionId}
                  relinkTargetRoot={relinkTargetRoot}
                  selectedSkillDetail={selectedSkillDetail}
                  signedExportSigner={signedExportSigner}
                  sparseGitSubpath={sparseGitSubpath}
                  sparseGitUrl={sparseGitUrl}
                  syncCredentialLabel={syncCredentialLabel}
                  syncCredentialToken={syncCredentialToken}
                  syncMode={syncMode}
                  syncProfile={syncProfile}
                  syncRemoteUrl={syncRemoteUrl}
                  tarImportPath={tarImportPath}
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
    plugins: normalizePluginsState(initialPlugins ?? empty.plugins)
  };
}

function normalizePluginsState(plugins: PluginsState): PluginsState {
  return {
    directories: plugins.directories ?? [],
    catalog: plugins.catalog ?? [],
    plugins: plugins.plugins
  };
}

function FirstLaunchWizard({
  detectedRoots,
  discoverPreviewSkills,
  migrationAdapter,
  migrationSourcePath,
  onComplete,
  onImportMigration,
  onMigrationAdapterChange,
  onMigrationImportLabelChange,
  onMigrationItemSelection,
  onMigrationSourcePathChange,
  onPreviewMigration,
  onSelectAllMigrationItems,
  onSelectNoMigrationItems,
  operationMessage
}: {
  detectedRoots: InstallTarget[];
  discoverPreviewSkills: DiscoverSkillPreview[];
  migrationAdapter: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client';
  migrationSourcePath: string;
  onComplete: () => void;
  onImportMigration: () => void;
  onMigrationAdapterChange: (value: 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client') => void;
  onMigrationImportLabelChange: (path: string, value: string) => void;
  onMigrationItemSelection: (path: string, selected: boolean) => void;
  onMigrationSourcePathChange: (value: string) => void;
  onPreviewMigration: () => void;
  onSelectAllMigrationItems: () => void;
  onSelectNoMigrationItems: () => void;
  operationMessage: string;
}): ReactElement {
  const selectedCount = discoverPreviewSkills.filter((skill) => skill.selected ?? true).length;

  return (
    <main className="screen">
      <section className="app-frame" aria-label="OpenHub first launch">
        <section className="content">
          <div className="main-pad">
            <PageTitle
              action={
                <button className="filter" onClick={onComplete} type="button">
                  Skip setup
                </button>
              }
              description="Detect local agent roots, preview migrations, and import only selected skill folders."
              title="First launch setup"
            />
            <section className="management-flow" aria-label="First launch wizard">
              <article className="flow-panel">
                <header>
                  <h2>Detected roots</h2>
                  <span>{detectedRoots.length}</span>
                </header>
                <KeyValueList
                  rows={detectedRoots.map((root) => ({
                    label: `${root.agentDisplayName} ${root.scope}`,
                    value: root.rootPath
                  }))}
                />
              </article>
              <article className="flow-panel">
                <header>
                  <h2>Migration preview</h2>
                  <span>writes blocked</span>
                </header>
                <div className="flow-actions">
                  <label htmlFor="first-launch-migration-adapter">
                    Migration adapter
                    <select
                      aria-label="Migration adapter"
                      id="first-launch-migration-adapter"
                      name="firstLaunchMigrationAdapter"
                      onChange={(event) =>
                        onMigrationAdapterChange(
                          event.target.value as 'openskills' | 'skills-manager' | 'skillhub' | 'skills-manager-client'
                        )
                      }
                      value={migrationAdapter}
                    >
                      <option value="openskills">OpenSkills</option>
                      <option value="skills-manager">Skills Manager</option>
                      <option value="skillhub">SkillHub</option>
                      <option value="skills-manager-client">skills-manager-client</option>
                    </select>
                  </label>
                  <label htmlFor="first-launch-migration-source-path">
                    Migration source path
                    <input
                      aria-label="Migration source path"
                      id="first-launch-migration-source-path"
                      name="firstLaunchMigrationSourcePath"
                      onChange={(event) => onMigrationSourcePathChange(event.target.value)}
                      placeholder="/path/to/skills"
                      value={migrationSourcePath}
                    />
                  </label>
                  <button disabled={migrationSourcePath.trim().length === 0} onClick={onPreviewMigration} type="button">
                    Preview migration
                  </button>
                  <button disabled={selectedCount === 0} onClick={onImportMigration} type="button">
                    Import selected migration
                  </button>
                  <span className="button-pair">
                    <button disabled={discoverPreviewSkills.length === 0} onClick={onSelectAllMigrationItems} type="button">
                      Select all migration items
                    </button>
                    <button disabled={discoverPreviewSkills.length === 0} onClick={onSelectNoMigrationItems} type="button">
                      Select none migration items
                    </button>
                  </span>
                </div>
              </article>
              <article className="flow-panel">
                <header>
                  <h2>Preview results</h2>
                  <span>{operationMessage || `${discoverPreviewSkills.length} skills`}</span>
                </header>
                <div className="migration-items">
                  {discoverPreviewSkills.map((skill) => (
                    <section className="migration-item" key={skill.path}>
                      <label className="inline-check" htmlFor={`migration-select-${safeDomId(skill.path)}`}>
                        <input
                          aria-label={`Select ${skill.name}`}
                          checked={skill.selected ?? true}
                          id={`migration-select-${safeDomId(skill.path)}`}
                          onChange={(event) => onMigrationItemSelection(skill.path, event.target.checked)}
                          type="checkbox"
                        />
                        {skill.name}
                      </label>
                      <label htmlFor={`migration-label-${safeDomId(skill.path)}`}>
                        Import label
                        <input
                          aria-label={`Import label for ${skill.name}`}
                          id={`migration-label-${safeDomId(skill.path)}`}
                          onChange={(event) => onMigrationImportLabelChange(skill.path, event.target.value)}
                          value={skill.importLabel ?? ''}
                        />
                      </label>
                      <span className="path-label">{skill.path}</span>
                      {skill.warnings && skill.warnings.length > 0 ? (
                        <div className="tag-row">
                          {skill.warnings.map((warning) => (
                            <span className="tag" key={`${skill.path}:${warning}`}>
                              {warning}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              </article>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
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
  activePolicyPack: PolicyPack | null;
  baselineName: string;
  baselineOutputDirectory: string;
  baselinePackageDirectory: string;
  baselinePreview: BaselinePreview | null;
  collectionDirectory: string;
  collectionName: string;
  collectionPackageDirectory: string;
  compareFromVersionId: string;
  compareToVersionId: string;
  discoverPreviewSkills: DiscoverSkillPreview[];
  discoverSource: DiscoverSource | null;
  discoverSourceName: string;
  discoverSourceUrl: string;
  draftChangeSummary: string;
  draftSkillMarkdown: string;
  exemptionReason: string;
  exportDirectory: string;
  gitImportUrl: string;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  hasSecurityBridge: boolean;
  inspectedSyncCredential: { authRef: string; label: string; masked: string } | null;
  installTargets: InstallTarget[];
  installProjectionMode: InstallPlan['projectionMode'];
  importPath: string;
  installTargetRoot: string;
  libraryAgentFilter: string;
  libraryFacets: LibraryFacets;
  libraryFavoritesOnly: boolean;
  libraryRiskFilter: string;
  librarySearchMode: 'fts' | 'semantic' | 'hybrid';
  lastInstallationId: string;
  librarySearchQuery: string;
  librarySearchResults: SkillSummary[];
  librarySourceFilter: string;
  libraryTagFilter: string;
  mirrorImportDirectory: string;
  mirrorSignatureStatus: 'unsigned' | 'signed' | 'untrusted' | '';
  migrationSourcePath: string;
  policyAllowedSources: string;
  policyApprovedPlugins: string;
  policyBlockedRules: string;
  policyEvaluation: PolicyEvaluation | null;
  policyName: string;
  policyRequiredScanLevel: 'safe' | 'warning' | 'critical';
  promoteReleaseChannel: 'beta' | 'stable';
  promoteVersionId: string;
  onAddDiscoverSource: () => void;
  onApplyInstallPlan: () => void;
  onApplyMultiTargetPlans: () => void;
  onApplySyncConflict: (
    conflictId: string,
    resolution:
      | {
          type: 'metadata';
          fields: Record<string, { source: 'base' | 'local' | 'remote' | 'manual'; value?: unknown }>;
        }
      | { type: 'file-drafts' }
      | { type: 'delete'; action: 'soft-delete' }
  ) => void;
  onAuthorizePlugin: () => void;
  onAddPluginDirectory: () => void;
  onAddProjectRoot: () => void;
  onCollectionDirectoryChange: (value: string) => void;
  onCollectionNameChange: (value: string) => void;
  onCollectionPackageDirectoryChange: (value: string) => void;
  onCompareFromVersionIdChange: (value: string) => void;
  onCompareToVersionIdChange: (value: string) => void;
  onCompareVersions: () => void;
  onCreateCollection: () => void;
  onCreateDraftVersion: () => void;
  onCreateExemption: () => void;
  onCreateInstallPlan: () => void;
  onCreateMultiTargetPlans: () => void;
  onCreatePolicyPack: () => void;
  onCreateSyncProfile: () => void;
  onDeleteSyncCredential: () => void;
  onDisablePlugin: () => void;
  onDiscoverSourceNameChange: (value: string) => void;
  onDiscoverSourceUrlChange: (value: string) => void;
  onDraftChangeSummaryChange: (value: string) => void;
  onDraftSkillMarkdownChange: (value: string) => void;
  onEnablePlugin: () => void;
  onExemptionReasonChange: (value: string) => void;
  onExportCollection: () => void;
  onExportBaseline: () => void;
  onExportDirectoryChange: (value: string) => void;
  onExportSkill: () => void;
  onExportSignedSkill: () => void;
  onGitImportUrlChange: (value: string) => void;
  onInspectSyncCredential: () => void;
  onImportCollection: () => void;
  onImportGit: () => void;
  onImportGitSparse: () => void;
  onImportLocalFolder: () => void;
  onImportMirror: () => void;
  onImportPathChange: (value: string) => void;
  onImportTar: () => void;
  onImportZip: () => void;
  onInstallPlugin: () => void;
  onInstallCatalogPlugin: () => void;
  onInstallProjectionModeChange: (value: InstallPlan['projectionMode']) => void;
  onInstallTargetRootChange: (value: string) => void;
  onLibraryAgentFilterChange: (value: string) => void;
  onLibraryFavoritesOnlyChange: (value: boolean) => void;
  onLibraryRiskFilterChange: (value: string) => void;
  onLibrarySearch: () => void;
  onLibrarySearchModeChange: (value: 'fts' | 'semantic' | 'hybrid') => void;
  onLibrarySearchQueryChange: (value: string) => void;
  onLibrarySourceFilterChange: (value: string) => void;
  onLibraryTagFilterChange: (value: string) => void;
  onLoadSyncConflicts: () => void;
  onMirrorImportDirectoryChange: (value: string) => void;
  onMigrationSourcePathChange: (value: string) => void;
  onPluginRootPathChange: (value: string) => void;
  onPluginDirectoryPathChange: (value: string) => void;
  onPreviewDiscoverSource: () => void;
  onPreviewBaseline: () => void;
  onPreviewMigration: () => void;
  onRemovePluginDirectory: () => void;
  onRelink: () => void;
  onRelinkTargetRootChange: (value: string) => void;
  onReinstall: () => void;
  onRevokeExemption: () => void;
  onResetLibraryFilters: () => void;
  onRollback: () => void;
  onRollbackVersionIdChange: (value: string) => void;
  onScanAgentRoots: () => void;
  onSecurityRescanAll: () => void;
  onSecurityScan: () => void;
  onScanPluginDirectory: () => void;
  onSetReadOnlyLock: (locked: boolean) => void;
  onSelectSkill: (skillId: string) => void;
  onApplyBaseline: () => void;
  onBaselineNameChange: (value: string) => void;
  onBaselineOutputDirectoryChange: (value: string) => void;
  onBaselinePackageDirectoryChange: (value: string) => void;
  onEvaluatePolicy: () => void;
  onPolicyAllowedSourcesChange: (value: string) => void;
  onPolicyApprovedPluginsChange: (value: string) => void;
  onPolicyBlockedRulesChange: (value: string) => void;
  onPolicyNameChange: (value: string) => void;
  onPolicyRequiredScanLevelChange: (value: 'safe' | 'warning' | 'critical') => void;
  onPromoteReleaseChannelChange: (value: 'beta' | 'stable') => void;
  onPromoteVersion: () => void;
  onPromoteVersionIdChange: (value: string) => void;
  onSetFavorite: (skill: SkillSummary) => void;
  onSignedExportSignerChange: (value: string) => void;
  onSparseGitSubpathChange: (value: string) => void;
  onSparseGitUrlChange: (value: string) => void;
  onSyncCredentialLabelChange: (value: string) => void;
  onSyncCredentialTokenChange: (value: string) => void;
  onProjectRootAgentCodeChange: (value: 'codex' | 'claude' | 'gemini' | 'opencode') => void;
  onProjectRootPathChange: (value: string) => void;
  onTarImportPathChange: (value: string) => void;
  onSyncModeChange: (value: 'shared-folder' | 'git' | 'rest' | 'mock-rest') => void;
  onSyncPushPull: () => void;
  onSyncRemoteUrlChange: (value: string) => void;
  onUninstall: () => void;
  onZipImportPathChange: (value: string) => void;
  operationMessage: string;
  pluginRegistry: PluginRegistry | null;
  pluginDirectoryPath: string;
  pluginRootPath: string;
  projectRootAgentCode: 'codex' | 'claude' | 'gemini' | 'opencode';
  projectRootPath: string;
  rollbackVersionId: string;
  relinkTargetRoot: string;
  selectedSkillDetail: SkillDetail | null;
  signedExportSigner: string;
  sparseGitSubpath: string;
  sparseGitUrl: string;
  syncConflicts: SyncConflictRecord[];
  syncCredentialLabel: string;
  syncCredentialToken: string;
  syncMode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
  syncProfile: SyncProfile | null;
  syncRemoteUrl: string;
  versionComparison: VersionComparisonReport | null;
  viewModel: ReturnType<typeof createWorkspaceViewModel>;
  workspaceState: DesktopWorkspaceState;
  tarImportPath: string;
  zipImportPath: string;
};

function PageContent(props: PageContentProps): ReactElement {
  const {
    activePage,
    activeTab,
    activeInstallPlan,
    activePolicyPack,
    baselineName,
    baselineOutputDirectory,
    baselinePackageDirectory,
    baselinePreview,
    collectionDirectory,
    collectionName,
    collectionPackageDirectory,
    compareFromVersionId,
    compareToVersionId,
    discoverPreviewSkills,
    discoverSource,
    discoverSourceName,
    discoverSourceUrl,
    draftChangeSummary,
    draftSkillMarkdown,
    exemptionReason,
    exportDirectory,
    gitImportUrl,
    hasImportBridge,
    hasInstallBridge,
    hasScanBridge,
    hasSecurityBridge,
    inspectedSyncCredential,
    installTargets,
    installProjectionMode,
    importPath,
    installTargetRoot,
    libraryAgentFilter,
    libraryFacets,
    libraryFavoritesOnly,
    libraryRiskFilter,
    librarySearchMode,
    lastInstallationId,
    librarySearchQuery,
    librarySearchResults,
    librarySourceFilter,
    libraryTagFilter,
    mirrorImportDirectory,
    mirrorSignatureStatus,
    migrationSourcePath,
    policyAllowedSources,
    policyApprovedPlugins,
    policyBlockedRules,
    policyEvaluation,
    policyName,
    policyRequiredScanLevel,
    promoteReleaseChannel,
    promoteVersionId,
    onAddDiscoverSource,
    onApplyInstallPlan,
    onApplyMultiTargetPlans,
    onApplySyncConflict,
    onAuthorizePlugin,
    onAddPluginDirectory,
    onAddProjectRoot,
    onCollectionDirectoryChange,
    onCollectionNameChange,
    onCollectionPackageDirectoryChange,
    onCompareFromVersionIdChange,
    onCompareToVersionIdChange,
    onCompareVersions,
    onCreateCollection,
    onCreateDraftVersion,
    onCreateExemption,
    onCreateInstallPlan,
    onCreateMultiTargetPlans,
    onCreatePolicyPack,
    onCreateSyncProfile,
    onDeleteSyncCredential,
    onDisablePlugin,
    onDiscoverSourceNameChange,
    onDiscoverSourceUrlChange,
    onDraftChangeSummaryChange,
    onDraftSkillMarkdownChange,
    onEnablePlugin,
    onExemptionReasonChange,
    onExportCollection,
    onExportBaseline,
    onExportDirectoryChange,
    onExportSkill,
    onExportSignedSkill,
    onGitImportUrlChange,
    onInspectSyncCredential,
    onImportCollection,
    onImportGit,
    onImportGitSparse,
    onImportLocalFolder,
    onImportMirror,
    onImportPathChange,
    onImportTar,
    onImportZip,
    onInstallPlugin,
    onInstallCatalogPlugin,
    onInstallProjectionModeChange,
    onInstallTargetRootChange,
    onLibraryAgentFilterChange,
    onLibraryFavoritesOnlyChange,
    onLibraryRiskFilterChange,
    onLibrarySearch,
    onLibrarySearchModeChange,
    onLibrarySearchQueryChange,
    onLibrarySourceFilterChange,
    onLibraryTagFilterChange,
    onLoadSyncConflicts,
    onMirrorImportDirectoryChange,
    onMigrationSourcePathChange,
    onPluginDirectoryPathChange,
    onPluginRootPathChange,
    onPreviewDiscoverSource,
    onPreviewBaseline,
    onPreviewMigration,
    onRemovePluginDirectory,
    onRelink,
    onRelinkTargetRootChange,
    onReinstall,
    onRevokeExemption,
    onResetLibraryFilters,
    onRollback,
    onRollbackVersionIdChange,
    onScanAgentRoots,
    onSecurityRescanAll,
    onSecurityScan,
    onScanPluginDirectory,
    onSetReadOnlyLock,
    onSelectSkill,
    onApplyBaseline,
    onBaselineNameChange,
    onBaselineOutputDirectoryChange,
    onBaselinePackageDirectoryChange,
    onEvaluatePolicy,
    onPolicyAllowedSourcesChange,
    onPolicyApprovedPluginsChange,
    onPolicyBlockedRulesChange,
    onPolicyNameChange,
    onPolicyRequiredScanLevelChange,
    onPromoteReleaseChannelChange,
    onPromoteVersion,
    onPromoteVersionIdChange,
    onSetFavorite,
    onSignedExportSignerChange,
    onSparseGitSubpathChange,
    onSparseGitUrlChange,
    onSyncCredentialLabelChange,
    onSyncCredentialTokenChange,
    onProjectRootAgentCodeChange,
    onProjectRootPathChange,
    onTarImportPathChange,
    onSyncModeChange,
    onSyncPushPull,
    onSyncRemoteUrlChange,
    onUninstall,
    onZipImportPathChange,
    operationMessage,
    pluginRegistry,
    pluginDirectoryPath,
    pluginRootPath,
    projectRootAgentCode,
    projectRootPath,
    rollbackVersionId,
    relinkTargetRoot,
    selectedSkillDetail,
    signedExportSigner,
    sparseGitSubpath,
    sparseGitUrl,
    syncConflicts,
    syncCredentialLabel,
    syncCredentialToken,
    syncMode,
    syncProfile,
    syncRemoteUrl,
    versionComparison,
    viewModel,
    workspaceState,
    tarImportPath,
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
        compareFromVersionId={compareFromVersionId}
        compareToVersionId={compareToVersionId}
        draftChangeSummary={draftChangeSummary}
        draftSkillMarkdown={draftSkillMarkdown}
        exportDirectory={exportDirectory}
        gitImportUrl={gitImportUrl}
        hasImportBridge={hasImportBridge}
        hasInstallBridge={hasInstallBridge}
        hasScanBridge={hasScanBridge}
        installTargets={installTargets}
        installProjectionMode={installProjectionMode}
        importPath={importPath}
        installTargetRoot={installTargetRoot}
        libraryAgentFilter={libraryAgentFilter}
        libraryFacets={libraryFacets}
        libraryFavoritesOnly={libraryFavoritesOnly}
        libraryRiskFilter={libraryRiskFilter}
        librarySearchMode={librarySearchMode}
        librarySearchQuery={librarySearchQuery}
        librarySearchResults={librarySearchResults}
        librarySourceFilter={librarySourceFilter}
        libraryTagFilter={libraryTagFilter}
        mirrorImportDirectory={mirrorImportDirectory}
        mirrorSignatureStatus={mirrorSignatureStatus}
        onApplyInstallPlan={onApplyInstallPlan}
        onApplyMultiTargetPlans={onApplyMultiTargetPlans}
        onCollectionDirectoryChange={onCollectionDirectoryChange}
        onCollectionNameChange={onCollectionNameChange}
        onCollectionPackageDirectoryChange={onCollectionPackageDirectoryChange}
        onCompareFromVersionIdChange={onCompareFromVersionIdChange}
        onCompareToVersionIdChange={onCompareToVersionIdChange}
        onCompareVersions={onCompareVersions}
        onCreateCollection={onCreateCollection}
        onCreateDraftVersion={onCreateDraftVersion}
        onCreateInstallPlan={onCreateInstallPlan}
        onCreateMultiTargetPlans={onCreateMultiTargetPlans}
        onExportCollection={onExportCollection}
        onExportDirectoryChange={onExportDirectoryChange}
        onExportSkill={onExportSkill}
        onExportSignedSkill={onExportSignedSkill}
        onGitImportUrlChange={onGitImportUrlChange}
        onDraftChangeSummaryChange={onDraftChangeSummaryChange}
        onDraftSkillMarkdownChange={onDraftSkillMarkdownChange}
        onImportCollection={onImportCollection}
        onImportGit={onImportGit}
        onImportGitSparse={onImportGitSparse}
        onImportLocalFolder={onImportLocalFolder}
        onImportMirror={onImportMirror}
        onImportPathChange={onImportPathChange}
        onImportTar={onImportTar}
        onImportZip={onImportZip}
        onInstallProjectionModeChange={onInstallProjectionModeChange}
        onInstallTargetRootChange={onInstallTargetRootChange}
        onLibraryAgentFilterChange={onLibraryAgentFilterChange}
        onLibraryFavoritesOnlyChange={onLibraryFavoritesOnlyChange}
        onLibraryRiskFilterChange={onLibraryRiskFilterChange}
        onLibrarySearch={onLibrarySearch}
        onLibrarySearchModeChange={onLibrarySearchModeChange}
        onLibrarySearchQueryChange={onLibrarySearchQueryChange}
        onLibrarySourceFilterChange={onLibrarySourceFilterChange}
        onLibraryTagFilterChange={onLibraryTagFilterChange}
        onMirrorImportDirectoryChange={onMirrorImportDirectoryChange}
        onPromoteReleaseChannelChange={onPromoteReleaseChannelChange}
        onPromoteVersion={onPromoteVersion}
        onPromoteVersionIdChange={onPromoteVersionIdChange}
        onScanAgentRoots={onScanAgentRoots}
        onSelectSkill={onSelectSkill}
        onSetFavorite={onSetFavorite}
        onResetLibraryFilters={onResetLibraryFilters}
        onSignedExportSignerChange={onSignedExportSignerChange}
        onSparseGitSubpathChange={onSparseGitSubpathChange}
        onSparseGitUrlChange={onSparseGitUrlChange}
        onTarImportPathChange={onTarImportPathChange}
        onZipImportPathChange={onZipImportPathChange}
        operationMessage={operationMessage}
        promoteReleaseChannel={promoteReleaseChannel}
        promoteVersionId={promoteVersionId}
        selectedSkillDetail={selectedSkillDetail}
        signedExportSigner={signedExportSigner}
        sparseGitSubpath={sparseGitSubpath}
        sparseGitUrl={sparseGitUrl}
        tarImportPath={tarImportPath}
        versionComparison={versionComparison}
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
        onRelink={onRelink}
        onRelinkTargetRootChange={onRelinkTargetRootChange}
        onReinstall={onReinstall}
        onRollback={onRollback}
        onRollbackVersionIdChange={onRollbackVersionIdChange}
        onSetReadOnlyLock={onSetReadOnlyLock}
        onUninstall={onUninstall}
        operationMessage={operationMessage}
        rollbackVersionId={rollbackVersionId}
        relinkTargetRoot={relinkTargetRoot}
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
        activePolicyPack={activePolicyPack}
        baselineName={baselineName}
        baselineOutputDirectory={baselineOutputDirectory}
        baselinePackageDirectory={baselinePackageDirectory}
        baselinePreview={baselinePreview}
        exemptionReason={exemptionReason}
        hasSecurityBridge={hasSecurityBridge}
        onApplyBaseline={onApplyBaseline}
        onBaselineNameChange={onBaselineNameChange}
        onBaselineOutputDirectoryChange={onBaselineOutputDirectoryChange}
        onBaselinePackageDirectoryChange={onBaselinePackageDirectoryChange}
        onCreateExemption={onCreateExemption}
        onCreatePolicyPack={onCreatePolicyPack}
        onEvaluatePolicy={onEvaluatePolicy}
        onExemptionReasonChange={onExemptionReasonChange}
        onExportBaseline={onExportBaseline}
        onPolicyAllowedSourcesChange={onPolicyAllowedSourcesChange}
        onPolicyApprovedPluginsChange={onPolicyApprovedPluginsChange}
        onPolicyBlockedRulesChange={onPolicyBlockedRulesChange}
        onPolicyNameChange={onPolicyNameChange}
        onPolicyRequiredScanLevelChange={onPolicyRequiredScanLevelChange}
        onPreviewBaseline={onPreviewBaseline}
        onRevokeExemption={onRevokeExemption}
        onSecurityRescanAll={onSecurityRescanAll}
        onSecurityScan={onSecurityScan}
        operationMessage={operationMessage}
        policyAllowedSources={policyAllowedSources}
        policyApprovedPlugins={policyApprovedPlugins}
        policyBlockedRules={policyBlockedRules}
        policyEvaluation={policyEvaluation}
        policyName={policyName}
        policyRequiredScanLevel={policyRequiredScanLevel}
        viewModel={viewModel}
        workspaceState={workspaceState}
      />
    );
  }

  if (activePage === 'settings') {
    return (
      <SettingsPage
        activeTab={activeTab}
        inspectedSyncCredential={inspectedSyncCredential}
        installTargets={installTargets}
        syncConflicts={syncConflicts}
        onApplySyncConflict={onApplySyncConflict}
        onAddPluginDirectory={onAddPluginDirectory}
        onAuthorizePlugin={onAuthorizePlugin}
        onCreateSyncProfile={onCreateSyncProfile}
        onDeleteSyncCredential={onDeleteSyncCredential}
        onDisablePlugin={onDisablePlugin}
        onEnablePlugin={onEnablePlugin}
        onInstallCatalogPlugin={onInstallCatalogPlugin}
        onInstallPlugin={onInstallPlugin}
        onInspectSyncCredential={onInspectSyncCredential}
        onLoadSyncConflicts={onLoadSyncConflicts}
        onAddProjectRoot={onAddProjectRoot}
        onPluginDirectoryPathChange={onPluginDirectoryPathChange}
        onPluginRootPathChange={onPluginRootPathChange}
        onProjectRootAgentCodeChange={onProjectRootAgentCodeChange}
        onProjectRootPathChange={onProjectRootPathChange}
        onSyncCredentialLabelChange={onSyncCredentialLabelChange}
        onSyncCredentialTokenChange={onSyncCredentialTokenChange}
        onSyncModeChange={onSyncModeChange}
        onSyncPushPull={onSyncPushPull}
        onSyncRemoteUrlChange={onSyncRemoteUrlChange}
        onRemovePluginDirectory={onRemovePluginDirectory}
        onScanPluginDirectory={onScanPluginDirectory}
        operationMessage={operationMessage}
        pluginRegistry={pluginRegistry}
        pluginDirectoryPath={pluginDirectoryPath}
        pluginRootPath={pluginRootPath}
        projectRootAgentCode={projectRootAgentCode}
        projectRootPath={projectRootPath}
        syncCredentialLabel={syncCredentialLabel}
        syncCredentialToken={syncCredentialToken}
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
  | 'compareFromVersionId'
  | 'compareToVersionId'
  | 'draftChangeSummary'
  | 'draftSkillMarkdown'
  | 'exportDirectory'
  | 'gitImportUrl'
  | 'hasImportBridge'
  | 'hasInstallBridge'
  | 'hasScanBridge'
  | 'installTargets'
  | 'installProjectionMode'
  | 'importPath'
  | 'installTargetRoot'
  | 'libraryAgentFilter'
  | 'libraryFacets'
  | 'libraryFavoritesOnly'
  | 'libraryRiskFilter'
  | 'librarySearchMode'
  | 'librarySearchQuery'
  | 'librarySearchResults'
  | 'librarySourceFilter'
  | 'libraryTagFilter'
  | 'mirrorImportDirectory'
  | 'mirrorSignatureStatus'
  | 'onApplyInstallPlan'
  | 'onApplyMultiTargetPlans'
  | 'onCollectionDirectoryChange'
  | 'onCollectionNameChange'
  | 'onCollectionPackageDirectoryChange'
  | 'onCompareFromVersionIdChange'
  | 'onCompareToVersionIdChange'
  | 'onCompareVersions'
  | 'onCreateCollection'
  | 'onCreateDraftVersion'
  | 'onCreateInstallPlan'
  | 'onCreateMultiTargetPlans'
  | 'onExportCollection'
  | 'onExportDirectoryChange'
  | 'onExportSkill'
  | 'onExportSignedSkill'
  | 'onGitImportUrlChange'
  | 'onDraftChangeSummaryChange'
  | 'onDraftSkillMarkdownChange'
  | 'onImportCollection'
  | 'onImportGit'
  | 'onImportGitSparse'
  | 'onImportLocalFolder'
  | 'onImportMirror'
  | 'onImportPathChange'
  | 'onImportTar'
  | 'onImportZip'
  | 'onInstallProjectionModeChange'
  | 'onInstallTargetRootChange'
  | 'onLibraryAgentFilterChange'
  | 'onLibraryFavoritesOnlyChange'
  | 'onLibraryRiskFilterChange'
  | 'onLibrarySearch'
  | 'onLibrarySearchModeChange'
  | 'onLibrarySearchQueryChange'
  | 'onLibrarySourceFilterChange'
  | 'onLibraryTagFilterChange'
  | 'onMirrorImportDirectoryChange'
  | 'onPromoteReleaseChannelChange'
  | 'onPromoteVersion'
  | 'onPromoteVersionIdChange'
  | 'onScanAgentRoots'
  | 'onSelectSkill'
  | 'onSetFavorite'
  | 'onResetLibraryFilters'
  | 'onSignedExportSignerChange'
  | 'onSparseGitSubpathChange'
  | 'onSparseGitUrlChange'
  | 'onTarImportPathChange'
  | 'onZipImportPathChange'
  | 'operationMessage'
  | 'promoteReleaseChannel'
  | 'promoteVersionId'
  | 'selectedSkillDetail'
  | 'signedExportSigner'
  | 'sparseGitSubpath'
  | 'sparseGitUrl'
  | 'tarImportPath'
  | 'versionComparison'
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
  compareFromVersionId,
  compareToVersionId,
  draftChangeSummary,
  draftSkillMarkdown,
  exportDirectory,
  gitImportUrl,
  hasImportBridge,
  hasInstallBridge,
  hasScanBridge,
  installTargets,
  installProjectionMode,
  importPath,
  installTargetRoot,
  libraryAgentFilter,
  libraryFacets,
  libraryFavoritesOnly,
  libraryRiskFilter,
  librarySearchMode,
  librarySearchQuery,
  librarySearchResults,
  librarySourceFilter,
  libraryTagFilter,
  mirrorImportDirectory,
  mirrorSignatureStatus,
  onApplyInstallPlan,
  onApplyMultiTargetPlans,
  onCollectionDirectoryChange,
  onCollectionNameChange,
  onCollectionPackageDirectoryChange,
  onCompareFromVersionIdChange,
  onCompareToVersionIdChange,
  onCompareVersions,
  onCreateCollection,
  onCreateDraftVersion,
  onCreateInstallPlan,
  onCreateMultiTargetPlans,
  onExportCollection,
  onExportDirectoryChange,
  onExportSkill,
  onExportSignedSkill,
  onGitImportUrlChange,
  onDraftChangeSummaryChange,
  onDraftSkillMarkdownChange,
  onImportCollection,
  onImportGit,
  onImportGitSparse,
  onImportLocalFolder,
  onImportMirror,
  onImportPathChange,
  onImportTar,
  onImportZip,
  onInstallProjectionModeChange,
  onInstallTargetRootChange,
  onLibraryAgentFilterChange,
  onLibraryFavoritesOnlyChange,
  onLibraryRiskFilterChange,
  onLibrarySearch,
  onLibrarySearchModeChange,
  onLibrarySearchQueryChange,
  onLibrarySourceFilterChange,
  onLibraryTagFilterChange,
  onMirrorImportDirectoryChange,
  onPromoteReleaseChannelChange,
  onPromoteVersion,
  onPromoteVersionIdChange,
  onScanAgentRoots,
  onSelectSkill,
  onSetFavorite,
  onResetLibraryFilters,
  onSignedExportSignerChange,
  onSparseGitSubpathChange,
  onSparseGitUrlChange,
  onTarImportPathChange,
  onZipImportPathChange,
  operationMessage,
  promoteReleaseChannel,
  promoteVersionId,
  selectedSkillDetail,
  signedExportSigner,
  sparseGitSubpath,
  sparseGitUrl,
  tarImportPath,
  versionComparison,
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
          mirrorImportDirectory={mirrorImportDirectory}
          mirrorSignatureStatus={mirrorSignatureStatus}
          onApplyInstallPlan={onApplyInstallPlan}
          onApplyMultiTargetPlans={onApplyMultiTargetPlans}
          onCreateInstallPlan={onCreateInstallPlan}
          onCreateMultiTargetPlans={onCreateMultiTargetPlans}
          onGitImportUrlChange={onGitImportUrlChange}
          onImportGit={onImportGit}
          onImportGitSparse={onImportGitSparse}
          onImportLocalFolder={onImportLocalFolder}
          onImportMirror={onImportMirror}
          onImportPathChange={onImportPathChange}
          onImportTar={onImportTar}
          onImportZip={onImportZip}
          onInstallProjectionModeChange={onInstallProjectionModeChange}
          onInstallTargetRootChange={onInstallTargetRootChange}
          onMirrorImportDirectoryChange={onMirrorImportDirectoryChange}
          onScanAgentRoots={onScanAgentRoots}
          onSparseGitSubpathChange={onSparseGitSubpathChange}
          onSparseGitUrlChange={onSparseGitUrlChange}
          onTarImportPathChange={onTarImportPathChange}
          sparseGitSubpath={sparseGitSubpath}
          sparseGitUrl={sparseGitUrl}
          tarImportPath={tarImportPath}
          onZipImportPathChange={onZipImportPathChange}
          zipImportPath={zipImportPath}
        />
      ) : activeTab === 'Governance' ? (
        <>
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
          <VersionAuthorWorkflow
            compareFromVersionId={compareFromVersionId}
            compareToVersionId={compareToVersionId}
            draftChangeSummary={draftChangeSummary}
            draftSkillMarkdown={draftSkillMarkdown}
            onCompareFromVersionIdChange={onCompareFromVersionIdChange}
            onCompareToVersionIdChange={onCompareToVersionIdChange}
            onCompareVersions={onCompareVersions}
            onCreateDraftVersion={onCreateDraftVersion}
            onDraftChangeSummaryChange={onDraftChangeSummaryChange}
            onDraftSkillMarkdownChange={onDraftSkillMarkdownChange}
            onPromoteReleaseChannelChange={onPromoteReleaseChannelChange}
            onPromoteVersion={onPromoteVersion}
            onPromoteVersionIdChange={onPromoteVersionIdChange}
            promoteReleaseChannel={promoteReleaseChannel}
            promoteVersionId={promoteVersionId}
            selectedSkillDetail={selectedSkillDetail}
            versionComparison={versionComparison}
          />
        </>
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
            libraryAgentFilter={libraryAgentFilter}
            libraryFacets={libraryFacets}
            librarySearchQuery={librarySearchQuery}
            librarySearchResults={librarySearchResults}
            libraryFavoritesOnly={libraryFavoritesOnly}
            libraryRiskFilter={libraryRiskFilter}
            librarySearchMode={librarySearchMode}
            librarySourceFilter={librarySourceFilter}
            libraryTagFilter={libraryTagFilter}
            onExportDirectoryChange={onExportDirectoryChange}
            onExportSkill={onExportSkill}
            onExportSignedSkill={onExportSignedSkill}
            onLibraryAgentFilterChange={onLibraryAgentFilterChange}
            onLibraryFavoritesOnlyChange={onLibraryFavoritesOnlyChange}
            onLibraryRiskFilterChange={onLibraryRiskFilterChange}
            onLibrarySearch={onLibrarySearch}
            onLibrarySearchModeChange={onLibrarySearchModeChange}
            onLibrarySearchQueryChange={onLibrarySearchQueryChange}
            onLibrarySourceFilterChange={onLibrarySourceFilterChange}
            onLibraryTagFilterChange={onLibraryTagFilterChange}
            onSelectSkill={onSelectSkill}
            onSetFavorite={onSetFavorite}
            onResetLibraryFilters={onResetLibraryFilters}
            onSignedExportSignerChange={onSignedExportSignerChange}
            operationMessage={operationMessage}
            selectedSkillDetail={selectedSkillDetail}
            signedExportSigner={signedExportSigner}
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
  onRelink,
  onRelinkTargetRootChange,
  onReinstall,
  onRollback,
  onRollbackVersionIdChange,
  onSetReadOnlyLock,
  onUninstall,
  operationMessage,
  rollbackVersionId,
  relinkTargetRoot,
  selectedSkillDetail,
  viewModel
}: {
  activeTab: string;
  lastInstallationId: string;
  onRelink: () => void;
  onRelinkTargetRootChange: (value: string) => void;
  onReinstall: () => void;
  onRollback: () => void;
  onRollbackVersionIdChange: (value: string) => void;
  onSetReadOnlyLock: (locked: boolean) => void;
  onUninstall: () => void;
  operationMessage: string;
  rollbackVersionId: string;
  relinkTargetRoot: string;
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
          onRelink={onRelink}
          onRelinkTargetRootChange={onRelinkTargetRootChange}
          onReinstall={onReinstall}
          onRollback={onRollback}
          onRollbackVersionIdChange={onRollbackVersionIdChange}
          onSetReadOnlyLock={onSetReadOnlyLock}
          onUninstall={onUninstall}
          operationMessage={operationMessage}
          rollbackVersionId={rollbackVersionId}
          relinkTargetRoot={relinkTargetRoot}
          selectedSkillDetail={selectedSkillDetail}
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
  onRelink,
  onRelinkTargetRootChange,
  onReinstall,
  onRollback,
  onRollbackVersionIdChange,
  onSetReadOnlyLock,
  onUninstall,
  operationMessage,
  rollbackVersionId,
  relinkTargetRoot,
  selectedSkillDetail
}: {
  lastInstallationId: string;
  onRelink: () => void;
  onRelinkTargetRootChange: (value: string) => void;
  onReinstall: () => void;
  onRollback: () => void;
  onRollbackVersionIdChange: (value: string) => void;
  onSetReadOnlyLock: (locked: boolean) => void;
  onUninstall: () => void;
  operationMessage: string;
  rollbackVersionId: string;
  relinkTargetRoot: string;
  selectedSkillDetail: SkillDetail | null;
}): ReactElement {
  const installation = currentInstallation(selectedSkillDetail, lastInstallationId);
  const locked = installation?.readOnlyLocked ?? false;

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
        <button disabled={lastInstallationId.length === 0 || locked} onClick={onReinstall} type="button">
          Reinstall app-owned files
        </button>
        <label htmlFor="relink-target-root">
          Relink target root
          <input
            aria-label="Relink target root"
            id="relink-target-root"
            name="relinkTargetRoot"
            onChange={(event) => onRelinkTargetRootChange(event.target.value)}
            placeholder="/path/to/agent/skills"
            value={relinkTargetRoot}
          />
        </label>
        <button disabled={lastInstallationId.length === 0 || relinkTargetRoot.trim().length === 0 || locked} onClick={onRelink} type="button">
          Relink install
        </button>
        <button disabled={lastInstallationId.length === 0 || locked} onClick={() => onSetReadOnlyLock(true)} type="button">
          Lock read-only
        </button>
        <button disabled={lastInstallationId.length === 0 || !locked} onClick={() => onSetReadOnlyLock(false)} type="button">
          Unlock read-only
        </button>
        <button disabled={lastInstallationId.length === 0 || locked} onClick={onUninstall} type="button">
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
  activePolicyPack,
  baselineName,
  baselineOutputDirectory,
  baselinePackageDirectory,
  baselinePreview,
  exemptionReason,
  hasSecurityBridge,
  onApplyBaseline,
  onBaselineNameChange,
  onBaselineOutputDirectoryChange,
  onBaselinePackageDirectoryChange,
  onCreateExemption,
  onCreatePolicyPack,
  onEvaluatePolicy,
  onExemptionReasonChange,
  onExportBaseline,
  onPolicyAllowedSourcesChange,
  onPolicyApprovedPluginsChange,
  onPolicyBlockedRulesChange,
  onPolicyNameChange,
  onPolicyRequiredScanLevelChange,
  onPreviewBaseline,
  onRevokeExemption,
  onSecurityRescanAll,
  onSecurityScan,
  operationMessage,
  policyAllowedSources,
  policyApprovedPlugins,
  policyBlockedRules,
  policyEvaluation,
  policyName,
  policyRequiredScanLevel,
  viewModel,
  workspaceState
}: {
  activeTab: string;
  activePolicyPack: PolicyPack | null;
  baselineName: string;
  baselineOutputDirectory: string;
  baselinePackageDirectory: string;
  baselinePreview: BaselinePreview | null;
  exemptionReason: string;
  hasSecurityBridge: boolean;
  onApplyBaseline: () => void;
  onBaselineNameChange: (value: string) => void;
  onBaselineOutputDirectoryChange: (value: string) => void;
  onBaselinePackageDirectoryChange: (value: string) => void;
  onCreateExemption: () => void;
  onCreatePolicyPack: () => void;
  onEvaluatePolicy: () => void;
  onExemptionReasonChange: (value: string) => void;
  onExportBaseline: () => void;
  onPolicyAllowedSourcesChange: (value: string) => void;
  onPolicyApprovedPluginsChange: (value: string) => void;
  onPolicyBlockedRulesChange: (value: string) => void;
  onPolicyNameChange: (value: string) => void;
  onPolicyRequiredScanLevelChange: (value: 'safe' | 'warning' | 'critical') => void;
  onPreviewBaseline: () => void;
  onRevokeExemption: () => void;
  onSecurityRescanAll: () => void;
  onSecurityScan: () => void;
  operationMessage: string;
  policyAllowedSources: string;
  policyApprovedPlugins: string;
  policyBlockedRules: string;
  policyEvaluation: PolicyEvaluation | null;
  policyName: string;
  policyRequiredScanLevel: 'safe' | 'warning' | 'critical';
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
        <div className="split-two">
          <PolicyActions
            activePolicyPack={activePolicyPack}
            baselineName={baselineName}
            baselineOutputDirectory={baselineOutputDirectory}
            baselinePackageDirectory={baselinePackageDirectory}
            baselinePreview={baselinePreview}
            onApplyBaseline={onApplyBaseline}
            onBaselineNameChange={onBaselineNameChange}
            onBaselineOutputDirectoryChange={onBaselineOutputDirectoryChange}
            onBaselinePackageDirectoryChange={onBaselinePackageDirectoryChange}
            onCreatePolicyPack={onCreatePolicyPack}
            onEvaluatePolicy={onEvaluatePolicy}
            onExportBaseline={onExportBaseline}
            onPolicyAllowedSourcesChange={onPolicyAllowedSourcesChange}
            onPolicyApprovedPluginsChange={onPolicyApprovedPluginsChange}
            onPolicyBlockedRulesChange={onPolicyBlockedRulesChange}
            onPolicyNameChange={onPolicyNameChange}
            onPolicyRequiredScanLevelChange={onPolicyRequiredScanLevelChange}
            onPreviewBaseline={onPreviewBaseline}
            operationMessage={operationMessage}
            policyAllowedSources={policyAllowedSources}
            policyApprovedPlugins={policyApprovedPlugins}
            policyBlockedRules={policyBlockedRules}
            policyEvaluation={policyEvaluation}
            policyName={policyName}
            policyRequiredScanLevel={policyRequiredScanLevel}
          />
          <Panel title="Rule details" tag={`${viewModel.security.ruleDetails.length} findings`} rows={viewModel.security.ruleDetails} />
        </div>
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

function PolicyActions({
  activePolicyPack,
  baselineName,
  baselineOutputDirectory,
  baselinePackageDirectory,
  baselinePreview,
  onApplyBaseline,
  onBaselineNameChange,
  onBaselineOutputDirectoryChange,
  onBaselinePackageDirectoryChange,
  onCreatePolicyPack,
  onEvaluatePolicy,
  onExportBaseline,
  onPolicyAllowedSourcesChange,
  onPolicyApprovedPluginsChange,
  onPolicyBlockedRulesChange,
  onPolicyNameChange,
  onPolicyRequiredScanLevelChange,
  onPreviewBaseline,
  operationMessage,
  policyAllowedSources,
  policyApprovedPlugins,
  policyBlockedRules,
  policyEvaluation,
  policyName,
  policyRequiredScanLevel
}: {
  activePolicyPack: PolicyPack | null;
  baselineName: string;
  baselineOutputDirectory: string;
  baselinePackageDirectory: string;
  baselinePreview: BaselinePreview | null;
  onApplyBaseline: () => void;
  onBaselineNameChange: (value: string) => void;
  onBaselineOutputDirectoryChange: (value: string) => void;
  onBaselinePackageDirectoryChange: (value: string) => void;
  onCreatePolicyPack: () => void;
  onEvaluatePolicy: () => void;
  onExportBaseline: () => void;
  onPolicyAllowedSourcesChange: (value: string) => void;
  onPolicyApprovedPluginsChange: (value: string) => void;
  onPolicyBlockedRulesChange: (value: string) => void;
  onPolicyNameChange: (value: string) => void;
  onPolicyRequiredScanLevelChange: (value: 'safe' | 'warning' | 'critical') => void;
  onPreviewBaseline: () => void;
  operationMessage: string;
  policyAllowedSources: string;
  policyApprovedPlugins: string;
  policyBlockedRules: string;
  policyEvaluation: PolicyEvaluation | null;
  policyName: string;
  policyRequiredScanLevel: 'safe' | 'warning' | 'critical';
}): ReactElement {
  return (
    <section className="panel" aria-label="Policy actions">
      <PanelHeader tag={operationMessage || activePolicyPack?.name || 'policy'} title="Policy packs" />
      <div className="flow-actions">
        <label htmlFor="policy-pack-name">
          Policy pack name
          <input
            aria-label="Policy pack name"
            id="policy-pack-name"
            name="policyPackName"
            onChange={(event) => onPolicyNameChange(event.target.value)}
            placeholder="Safe Local Policy"
            value={policyName}
          />
        </label>
        <label htmlFor="policy-allowed-sources">
          Allowed sources
          <input
            aria-label="Allowed sources"
            id="policy-allowed-sources"
            name="policyAllowedSources"
            onChange={(event) => onPolicyAllowedSourcesChange(event.target.value)}
            placeholder="local, mirror"
            value={policyAllowedSources}
          />
        </label>
        <label htmlFor="policy-blocked-rules">
          Blocked rule IDs
          <input
            aria-label="Blocked rule IDs"
            id="policy-blocked-rules"
            name="policyBlockedRules"
            onChange={(event) => onPolicyBlockedRulesChange(event.target.value)}
            placeholder="dangerous-shell-command"
            value={policyBlockedRules}
          />
        </label>
        <label htmlFor="policy-required-scan-level">
          Required scan level
          <select
            aria-label="Required scan level"
            id="policy-required-scan-level"
            name="policyRequiredScanLevel"
            onChange={(event) =>
              onPolicyRequiredScanLevelChange(event.target.value as 'safe' | 'warning' | 'critical')
            }
            value={policyRequiredScanLevel}
          >
            <option value="safe">Safe</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label htmlFor="policy-approved-plugins">
          Approved plugin IDs
          <input
            aria-label="Approved plugin IDs"
            id="policy-approved-plugins"
            name="policyApprovedPlugins"
            onChange={(event) => onPolicyApprovedPluginsChange(event.target.value)}
            placeholder="approved-plugin"
            value={policyApprovedPlugins}
          />
        </label>
        <button disabled={policyName.trim().length === 0} onClick={onCreatePolicyPack} type="button">
          Create policy pack
        </button>
        <button disabled={!activePolicyPack} onClick={onEvaluatePolicy} type="button">
          Evaluate Git source
        </button>
        <label htmlFor="baseline-output-directory">
          Baseline output directory
          <input
            aria-label="Baseline output directory"
            id="baseline-output-directory"
            name="baselineOutputDirectory"
            onChange={(event) => onBaselineOutputDirectoryChange(event.target.value)}
            placeholder="/path/to/baseline"
            value={baselineOutputDirectory}
          />
        </label>
        <label htmlFor="baseline-name">
          Baseline name
          <input
            aria-label="Baseline name"
            id="baseline-name"
            name="baselineName"
            onChange={(event) => onBaselineNameChange(event.target.value)}
            placeholder="Frontend Team"
            value={baselineName}
          />
        </label>
        <button disabled={!activePolicyPack || baselineOutputDirectory.trim().length === 0} onClick={onExportBaseline} type="button">
          Export baseline
        </button>
        <label htmlFor="baseline-package-directory">
          Baseline package directory
          <input
            aria-label="Baseline package directory"
            id="baseline-package-directory"
            name="baselinePackageDirectory"
            onChange={(event) => onBaselinePackageDirectoryChange(event.target.value)}
            placeholder="/path/to/baseline"
            value={baselinePackageDirectory}
          />
        </label>
        <button disabled={baselinePackageDirectory.trim().length === 0} onClick={onPreviewBaseline} type="button">
          Preview baseline
        </button>
        <button disabled={baselinePackageDirectory.trim().length === 0} onClick={onApplyBaseline} type="button">
          Apply baseline
        </button>
      </div>
      <KeyValueList
        rows={[
          ...(activePolicyPack ? [{ label: 'Active policy', value: activePolicyPack.name }] : []),
          ...(policyEvaluation
            ? [
                { label: 'Policy allowed', value: String(policyEvaluation.allowed) },
                ...policyEvaluation.reasons.map((reason) => ({ label: reason, value: 'blocked' }))
              ]
            : []),
          ...(baselinePreview
            ? [
                { label: baselinePreview.name, value: `writesAgentRoots:${String(baselinePreview.writesAgentRoots)}` },
                ...baselinePreview.changes.map((change) => ({ label: change, value: 'preview' }))
              ]
            : [])
        ]}
      />
    </section>
  );
}

function SettingsPage({
  activeTab,
  inspectedSyncCredential,
  installTargets,
  syncConflicts,
  onAddProjectRoot,
  onAddPluginDirectory,
  onApplySyncConflict,
  onAuthorizePlugin,
  onCreateSyncProfile,
  onDeleteSyncCredential,
  onDisablePlugin,
  onEnablePlugin,
  onInstallCatalogPlugin,
  onInstallPlugin,
  onInspectSyncCredential,
  onLoadSyncConflicts,
  onPluginDirectoryPathChange,
  onPluginRootPathChange,
  onProjectRootAgentCodeChange,
  onProjectRootPathChange,
  onSyncCredentialLabelChange,
  onSyncCredentialTokenChange,
  onSyncModeChange,
  onSyncPushPull,
  onSyncRemoteUrlChange,
  onRemovePluginDirectory,
  onScanPluginDirectory,
  operationMessage,
  pluginRegistry,
  pluginDirectoryPath,
  pluginRootPath,
  projectRootAgentCode,
  projectRootPath,
  syncCredentialLabel,
  syncCredentialToken,
  syncMode,
  syncProfile,
  syncRemoteUrl,
  viewModel
}: {
  activeTab: string;
  inspectedSyncCredential: { authRef: string; label: string; masked: string } | null;
  installTargets: InstallTarget[];
  syncConflicts: SyncConflictRecord[];
  onAddProjectRoot: () => void;
  onAddPluginDirectory: () => void;
  onApplySyncConflict: PageContentProps['onApplySyncConflict'];
  onAuthorizePlugin: () => void;
  onCreateSyncProfile: () => void;
  onDeleteSyncCredential: () => void;
  onDisablePlugin: () => void;
  onEnablePlugin: () => void;
  onInstallCatalogPlugin: () => void;
  onInstallPlugin: () => void;
  onInspectSyncCredential: () => void;
  onLoadSyncConflicts: () => void;
  onPluginDirectoryPathChange: (value: string) => void;
  onPluginRootPathChange: (value: string) => void;
  onProjectRootAgentCodeChange: (value: 'codex' | 'claude' | 'gemini' | 'opencode') => void;
  onProjectRootPathChange: (value: string) => void;
  onSyncCredentialLabelChange: (value: string) => void;
  onSyncCredentialTokenChange: (value: string) => void;
  onSyncModeChange: (value: 'shared-folder' | 'git' | 'rest' | 'mock-rest') => void;
  onSyncPushPull: () => void;
  onSyncRemoteUrlChange: (value: string) => void;
  onRemovePluginDirectory: () => void;
  onScanPluginDirectory: () => void;
  operationMessage: string;
  pluginRegistry: PluginRegistry | null;
  pluginDirectoryPath: string;
  pluginRootPath: string;
  projectRootAgentCode: 'codex' | 'claude' | 'gemini' | 'opencode';
  projectRootPath: string;
  syncCredentialLabel: string;
  syncCredentialToken: string;
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
            inspectedSyncCredential={inspectedSyncCredential}
            pluginRegistry={pluginRegistry}
            syncConflicts={syncConflicts}
            onApplySyncConflict={onApplySyncConflict}
            onCreateSyncProfile={onCreateSyncProfile}
            onDeleteSyncCredential={onDeleteSyncCredential}
            onInspectSyncCredential={onInspectSyncCredential}
            onLoadSyncConflicts={onLoadSyncConflicts}
            onSyncCredentialLabelChange={onSyncCredentialLabelChange}
            onSyncCredentialTokenChange={onSyncCredentialTokenChange}
            onSyncModeChange={onSyncModeChange}
            onSyncPushPull={onSyncPushPull}
            onSyncRemoteUrlChange={onSyncRemoteUrlChange}
            operationMessage={operationMessage}
            syncCredentialLabel={syncCredentialLabel}
            syncCredentialToken={syncCredentialToken}
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
            onAddPluginDirectory={onAddPluginDirectory}
            onAuthorizePlugin={onAuthorizePlugin}
            onDisablePlugin={onDisablePlugin}
            onEnablePlugin={onEnablePlugin}
            onInstallCatalogPlugin={onInstallCatalogPlugin}
            onInstallPlugin={onInstallPlugin}
            onPluginDirectoryPathChange={onPluginDirectoryPathChange}
            onPluginRootPathChange={onPluginRootPathChange}
            onRemovePluginDirectory={onRemovePluginDirectory}
            onScanPluginDirectory={onScanPluginDirectory}
            operationMessage={operationMessage}
            pluginDirectoryPath={pluginDirectoryPath}
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
        <div className="split-two">
          <ProjectRootActions
            installTargets={installTargets}
            onAddProjectRoot={onAddProjectRoot}
            onProjectRootAgentCodeChange={onProjectRootAgentCodeChange}
            onProjectRootPathChange={onProjectRootPathChange}
            operationMessage={operationMessage}
            projectRootAgentCode={projectRootAgentCode}
            projectRootPath={projectRootPath}
          />
          <section className="panel" aria-label="Detected agent roots">
            <PanelHeader tag={`${viewModel.settings.agentRoots.length} indexed`} title="Detected agent roots" />
            <AgentRootList roots={viewModel.settings.agentRoots} />
          </section>
        </div>
      )}
    </>
  );
}

function ProjectRootActions({
  installTargets,
  onAddProjectRoot,
  onProjectRootAgentCodeChange,
  onProjectRootPathChange,
  operationMessage,
  projectRootAgentCode,
  projectRootPath
}: {
  installTargets: InstallTarget[];
  onAddProjectRoot: () => void;
  onProjectRootAgentCodeChange: (value: 'codex' | 'claude' | 'gemini' | 'opencode') => void;
  onProjectRootPathChange: (value: string) => void;
  operationMessage: string;
  projectRootAgentCode: 'codex' | 'claude' | 'gemini' | 'opencode';
  projectRootPath: string;
}): ReactElement {
  const projectTargets = installTargets.filter((target) => target.rootKind === 'project' || target.scope === 'project');
  return (
    <section className="panel" aria-label="Project root actions">
      <PanelHeader tag={operationMessage || 'project'} title="Project roots" />
      <div className="flow-actions">
        <label htmlFor="project-root-agent">
          Agent
          <select
            aria-label="Project root agent"
            id="project-root-agent"
            name="projectRootAgent"
            onChange={(event) =>
              onProjectRootAgentCodeChange(event.target.value as 'codex' | 'claude' | 'gemini' | 'opencode')
            }
            value={projectRootAgentCode}
          >
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="opencode">OpenCode</option>
          </select>
        </label>
        <label htmlFor="project-root-path">
          Project root path
          <input
            aria-label="Project root path"
            id="project-root-path"
            name="projectRootPath"
            onChange={(event) => onProjectRootPathChange(event.target.value)}
            placeholder="/path/to/project/.codex/skills"
            value={projectRootPath}
          />
        </label>
        <button disabled={projectRootPath.trim().length === 0} onClick={onAddProjectRoot} type="button">
          Add project root
        </button>
      </div>
      <KeyValueList
        rows={projectTargets.map((target) => ({
          label: `${target.agentDisplayName} ${target.scope}`,
          value: target.rootPath
        }))}
      />
    </section>
  );
}

function SyncActions({
  inspectedSyncCredential,
  pluginRegistry,
  syncConflicts,
  onApplySyncConflict,
  onCreateSyncProfile,
  onDeleteSyncCredential,
  onInspectSyncCredential,
  onLoadSyncConflicts,
  onSyncCredentialLabelChange,
  onSyncCredentialTokenChange,
  onSyncModeChange,
  onSyncPushPull,
  onSyncRemoteUrlChange,
  operationMessage,
  syncCredentialLabel,
  syncCredentialToken,
  syncMode,
  syncProfile,
  syncRemoteUrl
}: {
  inspectedSyncCredential: { authRef: string; label: string; masked: string } | null;
  pluginRegistry: PluginRegistry | null;
  syncConflicts: SyncConflictRecord[];
  onApplySyncConflict: PageContentProps['onApplySyncConflict'];
  onCreateSyncProfile: () => void;
  onDeleteSyncCredential: () => void;
  onInspectSyncCredential: () => void;
  onLoadSyncConflicts: () => void;
  onSyncCredentialLabelChange: (value: string) => void;
  onSyncCredentialTokenChange: (value: string) => void;
  onSyncModeChange: (value: 'shared-folder' | 'git' | 'rest' | 'mock-rest') => void;
  onSyncPushPull: () => void;
  onSyncRemoteUrlChange: (value: string) => void;
  operationMessage: string;
  syncCredentialLabel: string;
  syncCredentialToken: string;
  syncMode: 'shared-folder' | 'git' | 'rest' | 'mock-rest';
  syncProfile: SyncProfile | null;
  syncRemoteUrl: string;
}): ReactElement {
  const pluginSyncDrivers = pluginRegistry?.syncDrivers ?? [];

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
        <label htmlFor="plugin-sync-driver">
          Plugin sync driver
          <select
            aria-label="Plugin sync driver"
            disabled={pluginSyncDrivers.length === 0}
            id="plugin-sync-driver"
            name="pluginSyncDriver"
          >
            <option value="">No plugin driver</option>
            {pluginSyncDrivers.map((driver) => (
              <option key={`${driver.pluginId}:${driver.id}`} value={`${driver.pluginId}:${driver.id}`}>
                {driver.name}
              </option>
            ))}
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
        <label htmlFor="sync-credential-label">
          Credential label
          <input
            aria-label="Credential label"
            id="sync-credential-label"
            name="syncCredentialLabel"
            onChange={(event) => onSyncCredentialLabelChange(event.target.value)}
            placeholder="Production sync token"
            value={syncCredentialLabel}
          />
        </label>
        <label htmlFor="sync-credential-token">
          Credential token
          <input
            aria-label="Credential token"
            id="sync-credential-token"
            name="syncCredentialToken"
            onChange={(event) => onSyncCredentialTokenChange(event.target.value)}
            placeholder="REST token"
            type="password"
            value={syncCredentialToken}
          />
        </label>
        <button disabled={syncRemoteUrl.trim().length === 0} onClick={onCreateSyncProfile} type="button">
          Create sync profile
        </button>
        <button disabled={!syncProfile} onClick={onSyncPushPull} type="button">
          Push and pull
        </button>
        <button disabled={!syncProfile?.authRef} onClick={onInspectSyncCredential} type="button">
          Inspect credential
        </button>
        <button disabled={!syncProfile?.authRef} onClick={onDeleteSyncCredential} type="button">
          Delete credential
        </button>
        <button onClick={onLoadSyncConflicts} type="button">
          Load sync conflicts
        </button>
      </div>
      {inspectedSyncCredential ? (
        <KeyValueList
          rows={[
            { label: inspectedSyncCredential.label, value: inspectedSyncCredential.masked },
            { label: 'Credential ref', value: inspectedSyncCredential.authRef }
          ]}
        />
      ) : null}
      {syncConflicts.length > 0 ? (
        <div className="flow-actions">
          {syncConflicts.map((conflict) => (
            <article className="mini-card" key={conflict.id}>
              <header>
                <h3>{conflict.entityType}</h3>
                <span className="tag">{conflict.status}</span>
              </header>
              <KeyValueList
                rows={[
                  { label: 'Conflict', value: conflict.id },
                  { label: 'Base', value: summarizeConflictValue(conflict.base) },
                  { label: 'Local', value: summarizeConflictValue(conflict.local) },
                  { label: 'Remote', value: summarizeConflictValue(conflict.remote) }
                ]}
              />
              <div className="button-pair">
                <button
                  aria-label={`Apply local metadata for ${conflict.id}`}
                  onClick={() =>
                    onApplySyncConflict(conflict.id, {
                      type: 'metadata',
                      fields: {
                        name: { source: 'local' },
                        description: { source: 'local' }
                      }
                    })
                  }
                  type="button"
                >
                  Apply local metadata
                </button>
                <button
                  aria-label={`Create file drafts for ${conflict.id}`}
                  onClick={() => onApplySyncConflict(conflict.id, { type: 'file-drafts' })}
                  type="button"
                >
                  Create file drafts
                </button>
                <button
                  aria-label={`Soft-delete skill for ${conflict.id}`}
                  onClick={() => onApplySyncConflict(conflict.id, { type: 'delete', action: 'soft-delete' })}
                  type="button"
                >
                  Soft-delete skill
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function summarizeConflictValue(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return String(value ?? 'none');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.name === 'string') {
    return record.name;
  }
  if (typeof record.description === 'string') {
    return record.description;
  }
  if (typeof record.status === 'string') {
    return record.status;
  }
  if (Array.isArray(record.files)) {
    return `${record.files.length} files`;
  }

  return JSON.stringify(value).slice(0, 80);
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function PluginActions({
  onAddPluginDirectory,
  onAuthorizePlugin,
  onDisablePlugin,
  onEnablePlugin,
  onInstallCatalogPlugin,
  onInstallPlugin,
  onPluginDirectoryPathChange,
  onPluginRootPathChange,
  onRemovePluginDirectory,
  onScanPluginDirectory,
  operationMessage,
  pluginDirectoryPath,
  pluginRegistry,
  pluginRootPath
}: {
  onAddPluginDirectory: () => void;
  onAuthorizePlugin: () => void;
  onDisablePlugin: () => void;
  onEnablePlugin: () => void;
  onInstallCatalogPlugin: () => void;
  onInstallPlugin: () => void;
  onPluginDirectoryPathChange: (value: string) => void;
  onPluginRootPathChange: (value: string) => void;
  onRemovePluginDirectory: () => void;
  onScanPluginDirectory: () => void;
  operationMessage: string;
  pluginDirectoryPath: string;
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
        <label htmlFor="plugin-directory-path">
          Plugin directory
          <input
            aria-label="Plugin directory"
            id="plugin-directory-path"
            name="pluginDirectoryPath"
            onChange={(event) => onPluginDirectoryPathChange(event.target.value)}
            placeholder="/path/to/plugin-directory"
            value={pluginDirectoryPath}
          />
        </label>
        <button disabled={pluginDirectoryPath.trim().length === 0} onClick={onAddPluginDirectory} type="button">
          Add plugin directory
        </button>
        <button onClick={onScanPluginDirectory} type="button">
          Scan plugin directory
        </button>
        <button onClick={onInstallCatalogPlugin} type="button">
          Install catalog plugin
        </button>
        <button onClick={onRemovePluginDirectory} type="button">
          Remove plugin directory
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
          { label: 'Sync drivers', value: String(pluginRegistry?.syncDrivers.length ?? 0) },
          { label: 'Exporters', value: String(pluginRegistry?.exporters?.length ?? 0) },
          ...(pluginRegistry?.exporters?.map((exporter) => ({ label: exporter.name, value: exporter.id })) ?? [])
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
  libraryAgentFilter,
  libraryFacets,
  libraryFavoritesOnly,
  libraryRiskFilter,
  librarySearchMode,
  librarySearchQuery,
  librarySearchResults,
  librarySourceFilter,
  libraryTagFilter,
  onExportDirectoryChange,
  onExportSkill,
  onExportSignedSkill,
  onLibraryAgentFilterChange,
  onLibraryFavoritesOnlyChange,
  onLibraryRiskFilterChange,
  onLibrarySearch,
  onLibrarySearchModeChange,
  onLibrarySearchQueryChange,
  onLibrarySourceFilterChange,
  onLibraryTagFilterChange,
  onResetLibraryFilters,
  onSelectSkill,
  onSetFavorite,
  onSignedExportSignerChange,
  operationMessage,
  selectedSkillDetail,
  signedExportSigner
}: {
  exportDirectory: string;
  libraryAgentFilter: string;
  libraryFacets: LibraryFacets;
  libraryFavoritesOnly: boolean;
  libraryRiskFilter: string;
  librarySearchMode: 'fts' | 'semantic' | 'hybrid';
  librarySearchQuery: string;
  librarySearchResults: SkillSummary[];
  librarySourceFilter: string;
  libraryTagFilter: string;
  onExportDirectoryChange: (value: string) => void;
  onExportSkill: () => void;
  onExportSignedSkill: () => void;
  onLibraryAgentFilterChange: (value: string) => void;
  onLibraryFavoritesOnlyChange: (value: boolean) => void;
  onLibraryRiskFilterChange: (value: string) => void;
  onLibrarySearch: () => void;
  onLibrarySearchModeChange: (value: 'fts' | 'semantic' | 'hybrid') => void;
  onLibrarySearchQueryChange: (value: string) => void;
  onLibrarySourceFilterChange: (value: string) => void;
  onLibraryTagFilterChange: (value: string) => void;
  onResetLibraryFilters: () => void;
  onSelectSkill: (skillId: string) => void;
  onSetFavorite: (skill: SkillSummary) => void;
  onSignedExportSignerChange: (value: string) => void;
  operationMessage: string;
  selectedSkillDetail: SkillDetail | null;
  signedExportSigner: string;
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
          <label htmlFor="library-search-mode">
            Search mode
            <select
              aria-label="Library search mode"
              id="library-search-mode"
              name="librarySearchMode"
              onChange={(event) =>
                onLibrarySearchModeChange(event.target.value as 'fts' | 'semantic' | 'hybrid')
              }
              value={librarySearchMode}
            >
              <option value="fts">fts</option>
              <option value="semantic">semantic</option>
              <option value="hybrid">hybrid</option>
            </select>
          </label>
          <button disabled={librarySearchQuery.trim().length === 0} onClick={onLibrarySearch} type="button">
            Search library
          </button>
          <button onClick={onResetLibraryFilters} type="button">
            Reset library filters
          </button>
          <label className="inline-check" htmlFor="favorites-only">
            <input
              aria-label="Favorites only"
              checked={libraryFavoritesOnly}
              id="favorites-only"
              name="favoritesOnly"
              onChange={(event) => onLibraryFavoritesOnlyChange(event.target.checked)}
              type="checkbox"
            />
            Favorites only
          </label>
        </div>
        <div className="flow-actions">
          <label htmlFor="library-source-filter">
            Source
            <input
              aria-label="Source type filter"
              id="library-source-filter"
              name="librarySourceFilter"
              onChange={(event) => onLibrarySourceFilterChange(event.target.value)}
              placeholder="local, git, zip"
              value={librarySourceFilter}
            />
          </label>
          <label htmlFor="library-risk-filter">
            Risk
            <input
              aria-label="Risk status filter"
              id="library-risk-filter"
              name="libraryRiskFilter"
              onChange={(event) => onLibraryRiskFilterChange(event.target.value)}
              placeholder="unscanned, safe, blocked"
              value={libraryRiskFilter}
            />
          </label>
          <label htmlFor="library-agent-filter">
            Agent
            <input
              aria-label="Agent code filter"
              id="library-agent-filter"
              name="libraryAgentFilter"
              onChange={(event) => onLibraryAgentFilterChange(event.target.value)}
              placeholder="codex, claude"
              value={libraryAgentFilter}
            />
          </label>
          <label htmlFor="library-tag-filter">
            Tag
            <input
              aria-label="Tag filter"
              id="library-tag-filter"
              name="libraryTagFilter"
              onChange={(event) => onLibraryTagFilterChange(event.target.value)}
              placeholder="imports"
              value={libraryTagFilter}
            />
          </label>
        </div>
        <FacetChips facets={libraryFacets} />
        <KeyValueList
          rows={librarySearchResults.map((skill) => ({
            label: skill.name,
            value: `v${skill.versionNo}`
          }))}
        />
        <div className="flow-actions">
          {librarySearchResults.map((skill) => (
            <span className="button-pair" key={skill.id}>
              <button onClick={() => onSelectSkill(skill.id)} type="button">
                View {skill.name}
              </button>
              <button onClick={() => onSetFavorite(skill)} type="button">
                {skill.favorite ? 'Unfavorite' : 'Favorite'} {skill.name}
              </button>
            </span>
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
          <label htmlFor="signed-export-signer">
            Signed export signer
            <input
              aria-label="Signed export signer"
              id="signed-export-signer"
              name="signedExportSigner"
              onChange={(event) => onSignedExportSignerChange(event.target.value)}
              placeholder="maintainer@example.com"
              value={signedExportSigner}
            />
          </label>
          <button
            disabled={exportDirectory.trim().length === 0 || signedExportSigner.trim().length === 0}
            onClick={onExportSignedSkill}
            type="button"
          >
            Export signed skill
          </button>
        </div>
      </article>
    </section>
  );
}

function FacetChips({ facets }: { facets: LibraryFacets }): ReactElement {
  const visibleFacets = [
    ...facets.sources,
    ...facets.risks,
    ...facets.agents,
    ...facets.tags,
    { value: 'Favorites', count: facets.favorites.count }
  ];

  return (
    <div className="facet-chips" aria-label="Library facet counts">
      {visibleFacets.length === 0 ? (
        <span className="tag">Favorites 0</span>
      ) : (
        visibleFacets.map((facet) => (
          <span className="tag" key={`${facet.value}:${facet.count}`}>
            {facet.value} {facet.count}
          </span>
        ))
      )}
    </div>
  );
}

function librarySearchFilters(input: {
  sourceType: string;
  riskStatus: string;
  agentCode: string;
  tag: string;
}): LibrarySearchFilters {
  return {
    ...(filterValues(input.sourceType).length > 0 ? { sourceTypes: filterValues(input.sourceType) } : {}),
    ...(filterValues(input.riskStatus).length > 0 ? { riskStatuses: filterValues(input.riskStatus) } : {}),
    ...(filterValues(input.agentCode).length > 0 ? { agentCodes: filterValues(input.agentCode) } : {}),
    ...(filterValues(input.tag).length > 0 ? { tags: filterValues(input.tag) } : {})
  };
}

function hasLibrarySearchFilters(filters: LibrarySearchFilters): boolean {
  return Boolean(
    filters.sourceTypes?.length ||
      filters.riskStatuses?.length ||
      filters.agentCodes?.length ||
      filters.tags?.length ||
      filters.favoritesOnly
  );
}

function filterValues(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeDomId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function currentInstallation(
  detail: SkillDetail | null,
  installationId: string
): SkillDetail['installations'][number] | null {
  if (!detail || installationId.trim().length === 0) {
    return null;
  }
  return detail.installations.find((installation) => installation.installationId === installationId) ?? null;
}

function agentCodeForDisplay(agent: string): string {
  const normalized = agent.trim().toLowerCase();
  if (normalized === 'open code') {
    return 'opencode';
  }
  return normalized.replace(/\s+/g, '-');
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

function VersionAuthorWorkflow({
  compareFromVersionId,
  compareToVersionId,
  draftChangeSummary,
  draftSkillMarkdown,
  onCompareFromVersionIdChange,
  onCompareToVersionIdChange,
  onCompareVersions,
  onCreateDraftVersion,
  onDraftChangeSummaryChange,
  onDraftSkillMarkdownChange,
  onPromoteReleaseChannelChange,
  onPromoteVersion,
  onPromoteVersionIdChange,
  promoteReleaseChannel,
  promoteVersionId,
  selectedSkillDetail,
  versionComparison
}: {
  compareFromVersionId: string;
  compareToVersionId: string;
  draftChangeSummary: string;
  draftSkillMarkdown: string;
  onCompareFromVersionIdChange: (value: string) => void;
  onCompareToVersionIdChange: (value: string) => void;
  onCompareVersions: () => void;
  onCreateDraftVersion: () => void;
  onDraftChangeSummaryChange: (value: string) => void;
  onDraftSkillMarkdownChange: (value: string) => void;
  onPromoteReleaseChannelChange: (value: 'beta' | 'stable') => void;
  onPromoteVersion: () => void;
  onPromoteVersionIdChange: (value: string) => void;
  promoteReleaseChannel: 'beta' | 'stable';
  promoteVersionId: string;
  selectedSkillDetail: SkillDetail | null;
  versionComparison: VersionComparisonReport | null;
}): ReactElement {
  const hasSkill = Boolean(selectedSkillDetail);

  return (
    <section className="panel panel-spaced" aria-label="Version author workflow">
      <PanelHeader tag={selectedSkillDetail?.skill.name ?? 'no skill'} title="Version authoring" />
      <div className="flow-actions">
        <label htmlFor="draft-change-summary">
          Draft change summary
          <input
            aria-label="Draft change summary"
            id="draft-change-summary"
            onChange={(event) => onDraftChangeSummaryChange(event.target.value)}
            value={draftChangeSummary}
          />
        </label>
        <label htmlFor="draft-skill-markdown">
          Draft SKILL.md content
          <textarea
            aria-label="Draft SKILL.md content"
            id="draft-skill-markdown"
            onChange={(event) => onDraftSkillMarkdownChange(event.target.value)}
            rows={6}
            value={draftSkillMarkdown}
          />
        </label>
        <button disabled={!hasSkill || draftSkillMarkdown.trim().length === 0} onClick={onCreateDraftVersion} type="button">
          Create draft version
        </button>
        <label htmlFor="promote-version-id">
          Promote version ID
          <input
            aria-label="Promote version ID"
            id="promote-version-id"
            onChange={(event) => onPromoteVersionIdChange(event.target.value)}
            value={promoteVersionId}
          />
        </label>
        <label htmlFor="promote-release-channel">
          Release channel
          <select
            aria-label="Release channel"
            id="promote-release-channel"
            onChange={(event) => onPromoteReleaseChannelChange(event.target.value as 'beta' | 'stable')}
            value={promoteReleaseChannel}
          >
            <option value="beta">Beta</option>
            <option value="stable">Stable</option>
          </select>
        </label>
        <button disabled={promoteVersionId.trim().length === 0} onClick={onPromoteVersion} type="button">
          Promote version
        </button>
        <label htmlFor="compare-from-version-id">
          Compare from version ID
          <input
            aria-label="Compare from version ID"
            id="compare-from-version-id"
            onChange={(event) => onCompareFromVersionIdChange(event.target.value)}
            value={compareFromVersionId}
          />
        </label>
        <label htmlFor="compare-to-version-id">
          Compare to version ID
          <input
            aria-label="Compare to version ID"
            id="compare-to-version-id"
            onChange={(event) => onCompareToVersionIdChange(event.target.value)}
            value={compareToVersionId}
          />
        </label>
        <button
          disabled={compareFromVersionId.trim().length === 0 || compareToVersionId.trim().length === 0}
          onClick={onCompareVersions}
          type="button"
        >
          Compare versions
        </button>
      </div>
      {versionComparison ? (
        <KeyValueList
          rows={[
            {
              label: 'Manifest',
              value: versionComparison.manifestHashChanged ? 'manifest changed' : 'manifest unchanged'
            },
            ...versionComparison.files.map((file) => ({
              label: file.relativePath,
              value: file.changeType
            }))
          ]}
        />
      ) : null}
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
  mirrorImportDirectory,
  mirrorSignatureStatus,
  onApplyInstallPlan,
  onApplyMultiTargetPlans,
  onCreateInstallPlan,
  onCreateMultiTargetPlans,
  onGitImportUrlChange,
  onImportGit,
  onImportGitSparse,
  onImportLocalFolder,
  onImportMirror,
  onImportPathChange,
  onImportTar,
  onImportZip,
  onInstallProjectionModeChange,
  onInstallTargetRootChange,
  onMirrorImportDirectoryChange,
  onScanAgentRoots,
  onSparseGitSubpathChange,
  onSparseGitUrlChange,
  onTarImportPathChange,
  onZipImportPathChange,
  sparseGitSubpath,
  sparseGitUrl,
  tarImportPath,
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
  mirrorImportDirectory: string;
  mirrorSignatureStatus: 'unsigned' | 'signed' | 'untrusted' | '';
  onApplyInstallPlan: () => void;
  onApplyMultiTargetPlans: () => void;
  onCreateInstallPlan: () => void;
  onCreateMultiTargetPlans: () => void;
  onGitImportUrlChange: (value: string) => void;
  onImportGit: () => void;
  onImportGitSparse: () => void;
  onImportLocalFolder: () => void;
  onImportMirror: () => void;
  onImportPathChange: (value: string) => void;
  onImportTar: () => void;
  onImportZip: () => void;
  onInstallProjectionModeChange: (value: InstallPlan['projectionMode']) => void;
  onInstallTargetRootChange: (value: string) => void;
  onMirrorImportDirectoryChange: (value: string) => void;
  onScanAgentRoots: () => void;
  onSparseGitSubpathChange: (value: string) => void;
  onSparseGitUrlChange: (value: string) => void;
  onTarImportPathChange: (value: string) => void;
  onZipImportPathChange: (value: string) => void;
  sparseGitSubpath: string;
  sparseGitUrl: string;
  tarImportPath: string;
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
          <label htmlFor="import-tar-path">
            TAR path
            <input
              aria-label="TAR import path"
              id="import-tar-path"
              name="tarImportPath"
              onChange={(event) => onTarImportPathChange(event.target.value)}
              placeholder="/path/to/skill.tar"
              value={tarImportPath}
            />
          </label>
          <button disabled={!window.theOpenHub?.importTar || tarImportPath.trim().length === 0} onClick={onImportTar} type="button">
            Import TAR
          </button>
          <label htmlFor="import-sparse-git-url">
            Sparse Git URL
            <input
              aria-label="Sparse Git URL"
              id="import-sparse-git-url"
              name="sparseGitUrl"
              onChange={(event) => onSparseGitUrlChange(event.target.value)}
              placeholder="file:///path/to/repo"
              value={sparseGitUrl}
            />
          </label>
          <label htmlFor="import-sparse-git-subpath">
            Sparse subpath
            <input
              aria-label="Sparse Git subpath"
              id="import-sparse-git-subpath"
              name="sparseGitSubpath"
              onChange={(event) => onSparseGitSubpathChange(event.target.value)}
              placeholder="skills/my-skill"
              value={sparseGitSubpath}
            />
          </label>
          <button
            disabled={
              !window.theOpenHub?.importGitSparse ||
              sparseGitUrl.trim().length === 0 ||
              sparseGitSubpath.trim().length === 0
            }
            onClick={onImportGitSparse}
            type="button"
          >
            Import sparse Git
          </button>
          <label htmlFor="import-mirror-directory">
            Mirror directory
            <input
              aria-label="Mirror import directory"
              id="import-mirror-directory"
              name="mirrorImportDirectory"
              onChange={(event) => onMirrorImportDirectoryChange(event.target.value)}
              placeholder="/path/to/mirror"
              value={mirrorImportDirectory}
            />
          </label>
          <button
            disabled={!window.theOpenHub?.importMirror || mirrorImportDirectory.trim().length === 0}
            onClick={onImportMirror}
            type="button"
          >
            Import mirror
          </button>
          <button disabled={!hasScanBridge} onClick={onScanAgentRoots} type="button">
            Scan agent roots
          </button>
        </div>
        {mirrorSignatureStatus ? (
          <KeyValueList rows={[{ label: 'Mirror signature', value: mirrorSignatureStatus }]} />
        ) : null}
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
          <button disabled={!hasInstallBridge || !hasSkills || installTargets.length === 0} onClick={onCreateMultiTargetPlans} type="button">
            Create multi-target plan
          </button>
          <button disabled={!hasInstallBridge || installTargets.length === 0} onClick={onApplyMultiTargetPlans} type="button">
            Apply multi-target plan
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
