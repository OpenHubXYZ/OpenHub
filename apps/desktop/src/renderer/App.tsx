import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  DesktopWorkspaceState,
  InstallPlan,
  LibrarySkillSummary,
  SkillSummary
} from '@theopenhub/shared';

import './app.css';

const principles = [
  'SQLite source of truth',
  'Agent directories as projections',
  'Offline by default'
] as const;

const plannedSurfaces = [
  'Library',
  'Import',
  'Install Plan',
  'Security Center',
  'Sync Center',
  'Plugins',
  'Settings'
] as const;

export interface AppProps {
  initialLibrarySkills?: LibrarySkillSummary[];
  initialSkills?: SkillSummary[];
  initialManagementFlow?: ManagementFlowState | null;
  initialSecurityCenter?: SecurityCenterState | null;
  initialGovernance?: GovernanceState | null;
  initialSyncCenter?: SyncCenterState | null;
  initialPlugins?: PluginsState | null;
}

export interface ManagementFlowState {
  importItems: Array<{
    label: string;
    status: string;
  }>;
  installPlan: {
    skillName: string;
    targetRoot: string;
    conflictState: string;
    writeCount: number;
  } | null;
  installResult: {
    status: string;
    message: string;
  } | null;
}

export interface SecurityCenterState {
  queue: Array<{
    skillName: string;
    status: string;
  }>;
  riskScore: number;
  level: string;
  findings: Array<{
    ruleName: string;
    severity: string;
  }>;
  history: Array<{
    skillName: string;
    level: string;
  }>;
  exemptions: Array<{
    skillName: string;
    scope: string;
    reason: string;
  }>;
}

export interface GovernanceState {
  history: Array<{
    versionNo: number;
    summary: string;
  }>;
  diff: Array<{
    relativePath: string;
    changeType: string;
  }>;
  collections: Array<{
    name: string;
    skillCount: number;
  }>;
}

export interface SyncCenterState {
  profiles: Array<{
    mode: string;
    status: string;
  }>;
  outbox: Array<{
    entityType: string;
    status: string;
  }>;
  inbox: Array<{
    entityType: string;
    status: string;
  }>;
  conflicts: Array<{
    entityType: string;
    status: string;
  }>;
}

export interface PluginsState {
  plugins: Array<{
    name: string;
    status: string;
    capabilities: string[];
    permissions: Array<{
      name: string;
      status: string;
    }>;
    errors: Array<{
      message: string;
    }>;
  }>;
}

export function App({
  initialLibrarySkills = [],
  initialSkills = [],
  initialManagementFlow = null,
  initialSecurityCenter = null,
  initialGovernance = null,
  initialSyncCenter = null,
  initialPlugins = null
}: AppProps): ReactElement {
  const [librarySkills, setLibrarySkills] = useState(initialLibrarySkills);
  const [skills, setSkills] = useState(initialSkills);
  const [managementFlow, setManagementFlow] = useState<ManagementFlowState>(
    initialManagementFlow ?? emptyManagementFlow()
  );
  const [securityCenter, setSecurityCenter] = useState(initialSecurityCenter);
  const [governance, setGovernance] = useState(initialGovernance);
  const [syncCenter, setSyncCenter] = useState(initialSyncCenter);
  const [plugins, setPlugins] = useState(initialPlugins);
  const [importPath, setImportPath] = useState('');
  const [installTargetRoot, setInstallTargetRoot] = useState('');
  const [activeInstallPlan, setActiveInstallPlan] = useState<InstallPlan | null>(null);
  const hasInitialLibrarySkills = initialLibrarySkills.length > 0;
  const applyWorkspaceState = useCallback((state: DesktopWorkspaceState) => {
    setLibrarySkills(state.librarySkills);
    setSkills(state.skills);
    setManagementFlow(state.managementFlow);
    setSecurityCenter(state.securityCenter);
    setGovernance(state.governance);
    setSyncCenter(state.syncCenter);
    setPlugins(state.plugins);
  }, []);

  useEffect(() => {
    if (window.theOpenHub?.getWorkspaceState) {
      void window.theOpenHub.getWorkspaceState().then(applyWorkspaceState);
      return;
    }

    if (hasInitialLibrarySkills || !window.theOpenHub?.listLibrarySkills) {
      return;
    }
    void window.theOpenHub.listLibrarySkills().then(setLibrarySkills);
  }, [applyWorkspaceState, hasInitialLibrarySkills]);

  async function handleImportLocalFolder(): Promise<void> {
    if (!window.theOpenHub?.importLocalFolder || importPath.trim().length === 0) {
      return;
    }

    const imported = await window.theOpenHub.importLocalFolder(importPath.trim());
    setSkills((current) => [imported.skill, ...current.filter((skill) => skill.id !== imported.skill.id)]);
    setManagementFlow((current) => ({
      ...current,
      importItems: [{ label: imported.skill.name, status: 'imported' }, ...current.importItems].slice(0, 5)
    }));
  }

  async function handleScanAgentRoots(): Promise<void> {
    if (!window.theOpenHub?.scanAgentRoots) {
      return;
    }

    const scan = await window.theOpenHub.scanAgentRoots();
    const scanItems = [
      ...scan.indexedSkills.map((skill) => ({ label: skill.name, status: 'indexed' })),
      ...scan.errors.map((error) => ({ label: error.skillPath, status: error.code }))
    ];
    setManagementFlow((current) => ({
      ...current,
      importItems: [...scanItems, ...current.importItems].slice(0, 8)
    }));
    if (window.theOpenHub.getWorkspaceState) {
      applyWorkspaceState(await window.theOpenHub.getWorkspaceState());
      setManagementFlow((current) => ({
        ...current,
        importItems: [...scanItems, ...current.importItems].slice(0, 8)
      }));
    }
  }

  async function handleCreateInstallPlan(): Promise<void> {
    const skill = skills[0];
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
    setManagementFlow((current) => ({
      ...current,
      installPlan: {
        skillName: plan.skillName,
        targetRoot: plan.targetRoot,
        conflictState: plan.conflictState,
        writeCount: plan.writes.length
      }
    }));
  }

  async function handleApplyInstallPlan(): Promise<void> {
    if (!activeInstallPlan || !window.theOpenHub?.applyInstallPlan) {
      return;
    }

    const result = await window.theOpenHub.applyInstallPlan(activeInstallPlan);
    setManagementFlow((current) => ({
      ...current,
      installResult: {
        status: result.status,
        message: `Installed ${activeInstallPlan.writes.length} files by copy projection.`
      }
    }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-mark" aria-hidden="true">
          OH
        </div>
        <nav className="nav-list" aria-label="Planned workspace">
          {plannedSurfaces.map((surface) => (
            <span className="nav-item" key={surface}>
              {surface}
            </span>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-labelledby="app-title">
        <header className="workspace-header">
          <div>
            <p className="phase-label">Phase 10 maintainer operations</p>
            <h1 id="app-title">TheOpenHub Skills Studio</h1>
          </div>
          <span className="status-chip">Local-first</span>
        </header>

        {librarySkills.length > 0 ? (
          <section className="library-list" aria-label="Indexed skills">
            {librarySkills.map((skill) => (
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
            <div className="empty-icon" aria-hidden="true">
              <span />
            </div>
            <div className="empty-copy">
              <h2>No skills indexed yet</h2>
              <p>The desktop shell is ready for local library indexing and typed agent adapters.</p>
            </div>
          </section>
        )}

        <ManagementFlow
          flow={managementFlow}
          importPath={importPath}
          installTargetRoot={installTargetRoot}
          hasImportBridge={Boolean(window.theOpenHub?.importLocalFolder)}
          hasInstallBridge={Boolean(window.theOpenHub?.createInstallPlan)}
          hasScanBridge={Boolean(window.theOpenHub?.scanAgentRoots)}
          hasActivePlan={Boolean(activeInstallPlan)}
          hasSkills={skills.length > 0}
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
        />
        {securityCenter ? <SecurityCenter state={securityCenter} /> : null}
        {governance ? <Governance state={governance} /> : null}
        {syncCenter ? <SyncCenter state={syncCenter} /> : null}
        {plugins ? <Plugins state={plugins} /> : null}

        <section className="principle-grid" aria-label="Product constraints">
          {principles.map((principle) => (
            <article className="principle" key={principle}>
              <span className="principle-dot" aria-hidden="true" />
              <p>{principle}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

function emptyManagementFlow(): ManagementFlowState {
  return {
    importItems: [],
    installPlan: null,
    installResult: null
  };
}

function Plugins({ state }: { state: PluginsState }): ReactElement {
  return (
    <section className="plugins-center" aria-labelledby="plugins-title">
      <header className="plugins-summary">
        <div>
          <h2 id="plugins-title">Plugins</h2>
          <p>Constrained extension runtime</p>
        </div>
        <span>Explicit permissions required</span>
      </header>

      <div className="plugins-grid">
        {state.plugins.map((plugin) => (
          <article className="plugin-panel" key={`${plugin.name}:${plugin.status}`}>
            <header>
              <h3>{plugin.name}</h3>
              <span>{plugin.status}</span>
            </header>

            <PluginList title="Capabilities" rows={plugin.capabilities.map((capability) => [capability, 'declared'])} />
            <PluginList
              title="Permissions"
              rows={plugin.permissions.map((permission) => [permission.name, permission.status])}
            />
            <PluginList title="Errors" rows={plugin.errors.map((error) => [error.message, 'logged'])} />
          </article>
        ))}
      </div>
    </section>
  );
}

function PluginList({ title, rows }: { title: string; rows: Array<[string, string]> }): ReactElement {
  return (
    <section className="plugin-list" aria-label={title}>
      <h4>{title}</h4>
      <ul>
        {rows.map(([label, value]) => (
          <li key={`${label}:${value}`}>
            <span>{label}</span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SyncCenter({ state }: { state: SyncCenterState }): ReactElement {
  return (
    <section className="sync-center" aria-labelledby="sync-center-title">
      <header className="sync-summary">
        <div>
          <h2 id="sync-center-title">Sync Center</h2>
          <p>Optional offline-first sync state</p>
        </div>
        <span>Disabled until a profile is enabled</span>
      </header>

      <div className="sync-grid">
        <SyncPanel
          title="Profiles"
          rows={state.profiles.map((profile) => ({ label: profile.mode, value: profile.status }))}
        />
        <SyncPanel
          title="Outbox"
          rows={state.outbox.map((record) => ({ label: record.entityType, value: record.status }))}
        />
        <SyncPanel
          title="Inbox"
          rows={state.inbox.map((record) => ({ label: record.entityType, value: record.status }))}
        />
        <SyncPanel
          title="Conflicts"
          rows={state.conflicts.map((conflict) => ({ label: conflict.entityType, value: conflict.status }))}
        />
      </div>
    </section>
  );
}

function SyncPanel({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}): ReactElement {
  return (
    <article className="sync-panel">
      <h3>{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={`${row.label}:${row.value}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Governance({ state }: { state: GovernanceState }): ReactElement {
  return (
    <section className="governance-grid" aria-label="History, Diff, and Collections">
      <article className="governance-panel">
        <h2>History</h2>
        <ul>
          {state.history.map((item) => (
            <li key={`${item.versionNo}:${item.summary}`}>
              <span>v{item.versionNo}</span>
              <strong>{item.summary}</strong>
            </li>
          ))}
        </ul>
      </article>

      <article className="governance-panel">
        <h2>Diff</h2>
        <ul>
          {state.diff.map((item) => (
            <li key={`${item.relativePath}:${item.changeType}`}>
              <span>{item.relativePath}</span>
              <strong>{item.changeType}</strong>
            </li>
          ))}
        </ul>
      </article>

      <article className="governance-panel">
        <h2>Collections</h2>
        <ul>
          {state.collections.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.skillCount}</strong>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function SecurityCenter({ state }: { state: SecurityCenterState }): ReactElement {
  return (
    <section className="security-center" aria-labelledby="security-center-title">
      <div className="security-summary">
        <div>
          <h2 id="security-center-title">Security Center</h2>
          <p>Risk Score</p>
        </div>
        <strong>{state.riskScore}</strong>
        <span>{state.level}</span>
      </div>

      <div className="security-grid">
        <article className="security-panel">
          <h3>Scan Queue</h3>
          <ul>
            {state.queue.map((item) => (
              <li key={`${item.skillName}:${item.status}`}>
                <span>{item.skillName}</span>
                <strong>{item.status}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="security-panel">
          <h3>Rule Details</h3>
          <ul>
            {state.findings.map((finding) => (
              <li key={`${finding.ruleName}:${finding.severity}`}>
                <span>{finding.ruleName}</span>
                <strong>{finding.severity}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="security-panel">
          <h3>History</h3>
          <ul>
            {state.history.map((item) => (
              <li key={`${item.skillName}:${item.level}`}>
                <span>{item.skillName}</span>
                <strong>{item.level}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="security-panel">
          <h3>Exemptions</h3>
          <ul>
            {state.exemptions.map((item) => (
              <li key={`${item.skillName}:${item.scope}:${item.reason}`}>
                <span>{item.reason}</span>
                <strong>{item.scope}</strong>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function ManagementFlow({
  flow,
  importPath,
  installTargetRoot,
  hasImportBridge,
  hasInstallBridge,
  hasScanBridge,
  hasActivePlan,
  hasSkills,
  onApplyInstallPlan,
  onCreateInstallPlan,
  onImportLocalFolder,
  onImportPathChange,
  onInstallTargetRootChange,
  onScanAgentRoots
}: {
  flow: ManagementFlowState;
  importPath: string;
  installTargetRoot: string;
  hasImportBridge: boolean;
  hasInstallBridge: boolean;
  hasScanBridge: boolean;
  hasActivePlan: boolean;
  hasSkills: boolean;
  onApplyInstallPlan: () => void;
  onCreateInstallPlan: () => void;
  onImportLocalFolder: () => void;
  onImportPathChange: (value: string) => void;
  onInstallTargetRootChange: (value: string) => void;
  onScanAgentRoots: () => void;
}): ReactElement {
  return (
    <section className="management-flow" aria-label="P0 management flow">
      <article className="flow-panel">
        <header>
          <h2>Import Queue</h2>
          <span>{flow.importItems.length}</span>
        </header>
        <div className="flow-actions">
          <label htmlFor="import-source-path">
            Import source path
            <input
              id="import-source-path"
              name="importSourcePath"
              aria-label="Import source path"
              value={importPath}
              onChange={(event) => onImportPathChange(event.target.value)}
              placeholder="/path/to/skill"
            />
          </label>
          <button
            type="button"
            disabled={!hasImportBridge || importPath.trim().length === 0}
            onClick={onImportLocalFolder}
          >
            Import local folder
          </button>
          <button type="button" disabled={!hasScanBridge} onClick={onScanAgentRoots}>
            Scan agent roots
          </button>
        </div>
        <ul>
          {flow.importItems.map((item) => (
            <li key={`${item.label}:${item.status}`}>
              <span>{item.label}</span>
              <strong>{item.status}</strong>
            </li>
          ))}
        </ul>
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
              id="install-target-root"
              name="installTargetRoot"
              aria-label="Install target root"
              value={installTargetRoot}
              onChange={(event) => onInstallTargetRootChange(event.target.value)}
              placeholder="/path/to/agent/skills"
            />
          </label>
          <button
            type="button"
            disabled={!hasInstallBridge || !hasSkills || installTargetRoot.trim().length === 0}
            onClick={onCreateInstallPlan}
          >
            Create install plan
          </button>
          <button type="button" disabled={!hasInstallBridge || !hasActivePlan} onClick={onApplyInstallPlan}>
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
