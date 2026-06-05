/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesktopWorkspaceState } from '@theopenhub/shared';

import { App } from './App';
import type { PageKey } from './workspace-view-model';

describe('desktop app shell', () => {
  afterEach(() => {
    cleanup();
    delete window.theOpenHub;
  });

  it('shows the shared desktop shell with command bar, right rail, and bottom status', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: 'Primary pages' })).toBeInTheDocument();
    expect(screen.getByText('OpenHub')).toBeInTheDocument();
    expect(screen.getByText('v0.9.0')).toBeInTheDocument();
    expect(screen.queryByText('Local skills')).not.toBeInTheDocument();
    expect(document.querySelector('.brand-cube')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search local skills, sources, reviews' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Dashboard details' })).toHaveTextContent('Workspace health');
    expect(document.querySelector('.rail-icon')).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('SQLite source of truth');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Offline by default');
  });

  it('navigates all primary pages without reloading the renderer', () => {
    render(<App />);
    const pages: Array<[PageKey, string, string]> = [
      ['dashboard', 'Dashboard', 'Workspace health'],
      ['library', 'Library', 'Library selection'],
      ['discover', 'Discover', 'Discover sources'],
      ['installs', 'Installs', 'Install planning'],
      ['usage', 'Usage', 'Usage insight'],
      ['reviews', 'Reviews', 'Review decisions'],
      ['security', 'Security', 'Current posture'],
      ['settings', 'Settings', 'Workspace settings']
    ];

    for (const [, label, railHeading] of pages) {
      fireEvent.click(screen.getByRole('button', { name: label }));

      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('complementary', { name: `${label} details` })).toHaveTextContent(railHeading);
    }
  });

  it('switches dashboard section tabs to runtime-backed content', () => {
    render(
      <App
        initialLibrarySkills={[
          {
            id: 'skill-1',
            name: 'Path Safety Scanner',
            sourceAgent: 'Codex',
            path: '/tmp/.codex/skills/path-safety',
            installStatus: 'installed'
          }
        ]}
        initialManagementFlow={{
          importItems: [{ label: 'Local folder import', status: 'indexed' }],
          installPlan: null,
          installResult: null
        }}
        initialSecurityCenter={{
          queue: [{ skillName: 'High Risk Helper', status: 'blocked' }],
          riskScore: 80,
          level: 'high',
          findings: [{ ruleName: 'Dangerous shell command', severity: 'high' }],
          history: [],
          exemptions: []
        }}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Agent roots' }));
    expect(screen.getByRole('tab', { name: 'Agent roots' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Agent root inventory' })).toBeInTheDocument();
    expect(screen.getByText('/tmp/.codex/skills')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Activity log' })).toBeInTheDocument();
    expect(screen.getByText('Local folder import')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Readiness' }));
    expect(screen.getByRole('tab', { name: 'Readiness' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Readiness actions' })).toBeInTheDocument();
    expect(screen.getByText('Security scan queue')).toBeInTheDocument();
  });

  it('does not reveal mock or fixture data when section tabs are clicked', () => {
    render(<App />);

    for (const label of ['Dashboard', 'Library', 'Discover', 'Installs', 'Usage', 'Reviews', 'Security', 'Settings']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      for (const tab of screen.getAllByRole('tab')) {
        fireEvent.click(tab);
        expect(tab).toHaveAttribute('aria-selected', 'true');
      }
    }

    const userVisibleText = document.body.textContent?.toLowerCase() ?? '';
    const blockedFragments = [
      'mock',
      'fixture',
      'openai-docs',
      'gh-fix-ci',
      'sui-move-contract',
      'browser-control',
      'terraform-helper',
      'alice.dev',
      'move-enthusiast',
      '312',
      '1482'
    ];

    for (const fragment of blockedFragments) {
      expect(userVisibleText).not.toContain(fragment);
    }
  });

  it('does not render mock or fixture-backed data across empty runtime pages', () => {
    render(<App />);

    for (const label of ['Dashboard', 'Library', 'Discover', 'Installs', 'Usage', 'Reviews', 'Security', 'Settings']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }

    const userVisibleText = document.body.textContent?.toLowerCase() ?? '';
    const blockedFragments = [
      'mock',
      'fixture',
      'openai-docs',
      'gh-fix-ci',
      'sui-move-contract',
      'browser-control',
      'terraform-helper',
      'alice.dev',
      'move-enthusiast',
      '312',
      '1482'
    ];

    for (const fragment of blockedFragments) {
      expect(userVisibleText).not.toContain(fragment);
    }
  });

  it('shows indexed library rows with source agent, path, and install status', () => {
    render(
      <App
        initialLibrarySkills={[
          {
            id: 'skill-1',
            name: 'Path Safety Scanner',
            sourceAgent: 'Codex',
            path: '/tmp/.codex/skills/path-safety',
            installStatus: 'installed'
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));

    expect(screen.getByRole('heading', { name: 'Path Safety Scanner' })).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('/tmp/.codex/skills/path-safety')).toBeInTheDocument();
    expect(screen.getByText('installed')).toBeInTheDocument();
  });

  it('shows the P0 import, install plan, and install result flow state', () => {
    render(
      <App
        initialManagementFlow={{
          importItems: [{ label: 'Local folder import', status: 'ready' }],
          installPlan: {
            skillName: 'Path Safety Scanner',
            targetRoot: '/tmp/.codex/skills',
            conflictState: 'clean',
            writeCount: 2
          },
          installResult: {
            status: 'installed',
            message: 'Installed 2 files by copy projection.'
          }
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Imports' }));

    expect(screen.getByRole('heading', { name: 'Import Queue' })).toBeInTheDocument();
    expect(screen.getByText('Local folder import')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Install Plan' })).toBeInTheDocument();
    expect(screen.getByText('/tmp/.codex/skills')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Install Result' })).toBeInTheDocument();
    expect(screen.getByText('Installed 2 files by copy projection.')).toBeInTheDocument();
  });

  it('shows the Security Center queue, score, findings, history, and exemptions', () => {
    render(
      <App
        initialSecurityCenter={{
          queue: [{ skillName: 'High Risk Helper', status: 'blocked' }],
          riskScore: 95,
          level: 'critical',
          findings: [{ ruleName: 'Dangerous shell command', severity: 'critical' }],
          history: [{ skillName: 'Medium Risk Helper', level: 'medium' }],
          exemptions: [{ skillName: 'High Risk Helper', scope: 'user', reason: 'Reviewed by maintainer' }]
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));

    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Security Center' })).toBeInTheDocument();
    expect(screen.getByText('Risk score')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getAllByText('Dangerous shell command').length).toBeGreaterThan(0);
    expect(screen.getAllByText('High Risk Helper').length).toBeGreaterThan(0);
    expect(screen.getByText('Reviewed by maintainer')).toBeInTheDocument();
  });

  it('shows History, Diff, and Collections state', () => {
    render(
      <App
        initialGovernance={{
          history: [{ versionNo: 2, summary: 'Change manifest and add guide' }],
          diff: [
            { relativePath: 'SKILL.md', changeType: 'modified' },
            { relativePath: 'references/new.txt', changeType: 'added' }
          ],
          collections: [{ name: 'Starter Pack', skillCount: 2 }]
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Governance' }));

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('Change manifest and add guide')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diff' })).toBeInTheDocument();
    expect(screen.getByText('references/new.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Collections' }));
    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.getByText('Starter Pack')).toBeInTheDocument();
  });

  it('lets the user create draft versions, promote them, and compare versions through IPC', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-1',
      name: 'Runtime Helper',
      description: 'Author workflow helper',
      versionNo: 1,
      favorite: false
    };
    const draftVersion = {
      versionId: 'version-2',
      skillId: runtimeSkill.id,
      versionNo: 2,
      changeSummary: 'Draft update',
      createdAt: '2026-06-05T00:00:00.000Z',
      lifecycle: 'draft',
      releaseChannel: 'local'
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(
        workspaceState({
          librarySkills: [
            {
              id: runtimeSkill.id,
              name: runtimeSkill.name,
              sourceAgent: 'Codex',
              path: '/tmp/runtime-helper',
              installStatus: 'available'
            }
          ],
          skills: [runtimeSkill]
        })
      ),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      getSkillDetail: vi.fn().mockResolvedValue(skillDetail(runtimeSkill)),
      createDraftVersion: vi.fn().mockResolvedValue(draftVersion),
      promoteVersion: vi.fn().mockResolvedValue({
        ...draftVersion,
        lifecycle: 'released',
        releaseChannel: 'beta'
      }),
      compareVersions: vi.fn().mockResolvedValue({
        fromVersionId: 'version-1',
        toVersionId: 'version-2',
        fromManifestHash: 'hash-1',
        toManifestHash: 'hash-2',
        manifestHashChanged: true,
        files: [{ relativePath: 'SKILL.md', changeType: 'modified', fromHash: 'hash-1', toHash: 'hash-2' }]
      }),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await waitFor(() => expect(api.getSkillDetail).toHaveBeenCalledWith(runtimeSkill.id));
    fireEvent.click(screen.getByRole('tab', { name: 'Governance' }));
    fireEvent.change(screen.getByLabelText('Draft change summary'), {
      target: { value: 'Draft update' }
    });
    fireEvent.change(screen.getByLabelText('Draft SKILL.md content'), {
      target: { value: '# Draft Runtime Helper' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft version' }));
    await waitFor(() =>
      expect(api.createDraftVersion).toHaveBeenCalledWith({
        skillId: runtimeSkill.id,
        changeSummary: 'Draft update',
        files: [{ relativePath: 'SKILL.md', content: '# Draft Runtime Helper' }]
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Promote version' }));
    await waitFor(() => expect(api.promoteVersion).toHaveBeenCalledWith('version-2', 'beta'));
    fireEvent.click(screen.getByRole('button', { name: 'Compare versions' }));
    await waitFor(() => expect(api.compareVersions).toHaveBeenCalledWith('version-1', 'version-2'));
    expect(screen.getByText('manifest changed')).toBeInTheDocument();
    expect(screen.getByText('SKILL.md')).toBeInTheDocument();
  });

  it('shows Sync Center profiles, outbox, inbox, and conflicts', () => {
    render(
      <App
        initialSyncCenter={{
          profiles: [{ mode: 'shared-folder', status: 'enabled' }],
          outbox: [{ entityType: 'skill_version', status: 'queued' }],
          inbox: [{ entityType: 'skill_version', status: 'received' }],
          conflicts: [{ entityType: 'skill_version', status: 'open' }]
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sync' }));
    const settingsWorkspace = screen.getByRole('region', { name: 'Settings workspace' });

    expect(within(settingsWorkspace).getByRole('heading', { name: 'Offline-first sync' })).toBeInTheDocument();
    expect(within(settingsWorkspace).getByRole('heading', { name: 'Sync preview' })).toBeInTheDocument();
    expect(within(settingsWorkspace).getByText('shared-folder')).toBeInTheDocument();
    expect(within(settingsWorkspace).getByText('1 queued')).toBeInTheDocument();
    expect(within(settingsWorkspace).getByText('1 pending')).toBeInTheDocument();
    expect(within(settingsWorkspace).getByText('1 open')).toBeInTheDocument();
  });

  it('shows Plugins install, enable, permission, capability, and error state', () => {
    render(
      <App
        initialPlugins={{
          directories: [],
          catalog: [],
          plugins: [
            {
              name: 'Local Agent Plugin',
              status: 'enabled',
              capabilities: ['agent-adapter:local-agent'],
              permissions: [{ name: 'network:fetch', status: 'authorized' }],
              errors: [{ message: 'Unsafe plugin entry blocked' }]
            }
          ]
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }));

    expect(screen.getAllByRole('heading', { name: 'Plugin runtime' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Local Agent Plugin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('enabled').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agent-adapter:local-agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('network:fetch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('authorized').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unsafe plugin entry blocked').length).toBeGreaterThan(0);
  });

  it('lets the user manage plugin directories, catalog scans, trust state, and exporter counts', async () => {
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState()),
      addPluginDirectory: vi.fn().mockResolvedValue({
        id: 'directory-1',
        rootPath: '/tmp/plugins',
        status: 'active',
        scannedAt: null
      }),
      scanPluginDirectory: vi.fn().mockResolvedValue({
        directory: {
          id: 'directory-1',
          rootPath: '/tmp/plugins',
          status: 'scanned',
          scannedAt: '2026-06-05T00:00:00.000Z'
        },
        catalog: [
          {
            id: 'catalog-1',
            directoryId: 'directory-1',
            pluginId: 'exporter-plugin',
            name: 'Exporter Plugin',
            version: '1.0.0',
            rootPath: '/tmp/plugins/exporter-plugin',
            signatureStatus: 'trusted',
            installed: false,
            status: 'available'
          }
        ]
      }),
      removePluginDirectory: vi.fn().mockResolvedValue({ status: 'removed' }),
      installPlugin: vi.fn().mockResolvedValue({
        id: 'exporter-plugin',
        name: 'Exporter Plugin',
        version: '1.0.0',
        rootPath: '/tmp/plugins/exporter-plugin',
        status: 'disabled',
        signatureStatus: 'trusted'
      }),
      getPluginRegistry: vi.fn().mockResolvedValue({
        agentAdapters: [],
        importers: [],
        securityRules: [],
        syncDrivers: [],
        exporters: [{ pluginId: 'exporter-plugin', id: 'bundle-exporter', name: 'Bundle Exporter' }]
      }),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }));
    fireEvent.change(screen.getByLabelText('Plugin directory'), {
      target: { value: '/tmp/plugins' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add plugin directory' }));
    await waitFor(() => expect(api.addPluginDirectory).toHaveBeenCalledWith('/tmp/plugins'));
    fireEvent.click(screen.getByRole('button', { name: 'Scan plugin directory' }));
    await waitFor(() => expect(api.scanPluginDirectory).toHaveBeenCalledWith('directory-1'));

    expect(screen.getAllByText('Exporter Plugin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('trusted').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Install catalog plugin' }));
    await waitFor(() => expect(api.installPlugin).toHaveBeenCalledWith('/tmp/plugins/exporter-plugin'));
    expect(await screen.findByText('Bundle Exporter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove plugin directory' }));
    await waitFor(() => expect(api.removePluginDirectory).toHaveBeenCalledWith('directory-1'));
  });

  it('lets the user run the local import and install management loop through IPC', async () => {
    const importedSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Imported through the renderer',
      versionNo: 1
    };
    const installPlan = {
      skillId: importedSkill.id,
      versionId: importedSkill.versionId,
      skillName: importedSkill.name,
      skillSlug: 'runtime-helper',
      targetRoot: '/tmp/.codex/skills',
      installPath: '/tmp/.codex/skills/runtime-helper',
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user',
      rootKind: 'user',
      projectionMode: 'symlink',
      conflictState: 'clean',
      writes: [
        {
          relativePath: 'SKILL.md',
          targetPath: '/tmp/.codex/skills/runtime-helper/SKILL.md',
          hash: 'hash-1',
          size: 120,
          conflict: 'none'
        }
      ]
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue({
        appInfo: {
          productName: 'OpenHub',
          phase: 'Phase 10',
          localFirst: true
        },
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
      }),
      importLocalFolder: vi.fn().mockResolvedValue({
        skill: importedSkill,
        files: [{ relativePath: 'SKILL.md', hash: 'hash-1', size: 120 }],
        stagedFrom: '/tmp/staging/import-1'
      }),
      createInstallPlan: vi.fn().mockResolvedValue(installPlan),
      applyInstallPlan: vi.fn().mockResolvedValue({
        status: 'installed',
        installationId: 'installation-runtime',
        security: {
          level: 'safe',
          warnings: []
        }
      }),
      scanSkill: vi.fn(),
      scanAgentRoots: vi.fn().mockResolvedValue({
        indexedSkills: [
          {
            id: 'skill-scanned',
            name: 'Scanned Helper',
            agentCode: 'codex',
            path: '/tmp/.codex/skills/scanned-helper',
            files: [{ relativePath: 'SKILL.md', size: 120 }]
          }
        ],
        errors: []
      }),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await screen.findByRole('heading', { name: 'Dashboard' });
    fireEvent.click(screen.getByRole('button', { name: 'Run scan' }));
    await waitFor(() => expect(api.scanAgentRoots).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getAllByText('Scanned Helper').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Imports' }));

    fireEvent.change(screen.getByLabelText('Import source path'), {
      target: { value: '/tmp/runtime-helper' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import local folder' }));

    await waitFor(() => expect(api.importLocalFolder).toHaveBeenCalledWith('/tmp/runtime-helper'));
    expect(screen.getByText('Runtime Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Install target root'), {
      target: { value: '/tmp/.codex/skills' }
    });
    fireEvent.change(screen.getByLabelText('Projection mode'), {
      target: { value: 'symlink' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create install plan' }));

    await waitFor(() =>
      expect(api.createInstallPlan).toHaveBeenCalledWith({
        skillId: importedSkill.id,
        targetRoot: '/tmp/.codex/skills',
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'builtin',
        scope: 'user',
        rootKind: 'user',
        projectionMode: 'symlink'
      })
    );
    expect(screen.getByText('1 planned writes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply install plan' }));
    await waitFor(() => expect(api.applyInstallPlan).toHaveBeenCalledWith(installPlan));
    expect(screen.getByText('Installed 1 files by symlink projection.')).toBeInTheDocument();
  });

  it('lets the user import Git and ZIP skills, inspect details, export skills, and manage collections through IPC', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Searchable runtime helper',
      versionNo: 1
    };
    const gitSkill = {
      id: 'skill-git',
      versionId: 'version-git',
      name: 'Git Helper',
      description: 'Imported from Git',
      versionNo: 1
    };
    const zipSkill = {
      id: 'skill-zip',
      versionId: 'version-zip',
      name: 'ZIP Helper',
      description: 'Imported from ZIP',
      versionNo: 1
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(
        workspaceState({
          librarySkills: [
            {
              id: runtimeSkill.id,
              name: runtimeSkill.name,
              sourceAgent: 'Codex',
              path: '/tmp/runtime-helper',
              installStatus: 'available'
            }
          ],
          skills: [runtimeSkill]
        })
      ),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      importLocalFolder: vi.fn(),
      importGit: vi.fn().mockResolvedValue({
        skill: gitSkill,
        files: [{ relativePath: 'SKILL.md', hash: 'hash-git', size: 120 }],
        stagedFrom: '/tmp/staging/git'
      }),
      importZip: vi.fn().mockResolvedValue({
        skill: zipSkill,
        files: [{ relativePath: 'SKILL.md', hash: 'hash-zip', size: 120 }],
        stagedFrom: '/tmp/staging/zip'
      }),
      searchLibrary: vi.fn().mockResolvedValue([runtimeSkill]),
      getSkillDetail: vi.fn().mockResolvedValue(skillDetail(runtimeSkill)),
      exportSkill: vi.fn().mockResolvedValue({
        outputDirectory: '/tmp/export/runtime-helper',
        manifestPath: '/tmp/export/runtime-helper/manifest.json',
        files: [{ relativePath: 'SKILL.md', hash: 'hash-runtime', size: 140 }]
      }),
      createCollection: vi.fn().mockResolvedValue({
        id: 'collection-runtime',
        name: 'Runtime Pack',
        description: '',
        skillIds: [runtimeSkill.id, gitSkill.id, zipSkill.id],
        createdAt: '2026-06-05T00:00:00.000Z'
      }),
      exportCollection: vi.fn().mockResolvedValue({
        outputDirectory: '/tmp/export/runtime-pack'
      }),
      importCollection: vi.fn().mockResolvedValue({
        collection: {
          id: 'collection-imported',
          name: 'Imported Pack',
          description: '',
          skillIds: [runtimeSkill.id],
          createdAt: '2026-06-05T00:00:00.000Z'
        },
        skills: [runtimeSkill]
      }),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn(),
      scanSkill: vi.fn(),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Imports' }));

    fireEvent.change(screen.getByLabelText('Git import URL'), {
      target: { value: 'file:///tmp/git-helper' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import Git' }));
    await waitFor(() => expect(api.importGit).toHaveBeenCalledWith('file:///tmp/git-helper'));
    expect(screen.getByText('Git Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('ZIP import path'), {
      target: { value: '/tmp/zip-helper.zip' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import ZIP' }));
    await waitFor(() => expect(api.importZip).toHaveBeenCalledWith('/tmp/zip-helper.zip'));
    expect(screen.getByText('ZIP Helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Indexed skills' }));
    fireEvent.change(screen.getByLabelText('Library search query'), {
      target: { value: 'runtime' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search library' }));
    await waitFor(() => expect(api.searchLibrary).toHaveBeenCalledWith('runtime', { favoritesOnly: false }));
    fireEvent.click(screen.getByRole('button', { name: 'View Runtime Helper' }));
    await waitFor(() => expect(api.getSkillDetail).toHaveBeenCalledWith(runtimeSkill.id));
    expect(screen.getByText('references/guide.md')).toBeInTheDocument();
    expect(screen.getByText(/Runtime helper instructions/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Skill export directory'), {
      target: { value: '/tmp/export' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export skill' }));
    await waitFor(() => expect(api.exportSkill).toHaveBeenCalledWith(runtimeSkill.id, '/tmp/export'));

    fireEvent.click(screen.getByRole('tab', { name: 'Collections' }));
    fireEvent.change(screen.getByLabelText('Collection name'), {
      target: { value: 'Runtime Pack' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));
    await waitFor(() =>
      expect(api.createCollection).toHaveBeenCalledWith({
        name: 'Runtime Pack',
        description: '',
        skillIds: expect.arrayContaining([runtimeSkill.id, gitSkill.id, zipSkill.id])
      })
    );

    fireEvent.change(screen.getByLabelText('Collection export directory'), {
      target: { value: '/tmp/export' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export collection' }));
    await waitFor(() => expect(api.exportCollection).toHaveBeenCalledWith('collection-runtime', '/tmp/export'));

    fireEvent.change(screen.getByLabelText('Collection package directory'), {
      target: { value: '/tmp/imported-pack' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import collection' }));
    await waitFor(() => expect(api.importCollection).toHaveBeenCalledWith('/tmp/imported-pack'));
    expect(screen.getByText('Imported Pack')).toBeInTheDocument();
  });

  it('lets the user combine library filters, reset them, and refresh facets after favorites change', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Searchable runtime helper',
      versionNo: 1,
      favorite: false
    };
    const api = {
      getWorkspaceState: vi.fn().mockResolvedValue(
        workspaceState({
          skills: [runtimeSkill]
        })
      ),
      getLibraryFacets: vi
        .fn()
        .mockResolvedValueOnce({
          sources: [{ value: 'local', count: 1 }],
          risks: [{ value: 'blocked', count: 1 }],
          agents: [{ value: 'codex', count: 1 }],
          tags: [{ value: 'imports', count: 1 }],
          favorites: { value: 'favorites', count: 0 }
        })
        .mockResolvedValueOnce({
          sources: [{ value: 'local', count: 1 }],
          risks: [{ value: 'blocked', count: 1 }],
          agents: [{ value: 'codex', count: 1 }],
          tags: [{ value: 'imports', count: 1 }],
          favorites: { value: 'favorites', count: 1 }
        }),
      searchLibrary: vi.fn().mockResolvedValue([runtimeSkill]),
      setFavorite: vi.fn().mockResolvedValue({ ...runtimeSkill, favorite: true }),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    await waitFor(() => expect(api.getLibraryFacets).toHaveBeenCalledTimes(1));
    expect(screen.getByText('local 1')).toBeInTheDocument();
    expect(screen.getByText('Favorites 0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Library search query'), {
      target: { value: 'imports' }
    });
    fireEvent.change(screen.getByLabelText('Library search mode'), {
      target: { value: 'hybrid' }
    });
    fireEvent.change(screen.getByLabelText('Source type filter'), {
      target: { value: 'local' }
    });
    fireEvent.change(screen.getByLabelText('Risk status filter'), {
      target: { value: 'blocked' }
    });
    fireEvent.change(screen.getByLabelText('Agent code filter'), {
      target: { value: 'codex' }
    });
    fireEvent.change(screen.getByLabelText('Tag filter'), {
      target: { value: 'imports' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search library' }));

    await waitFor(() =>
      expect(api.searchLibrary).toHaveBeenCalledWith('imports', {
        favoritesOnly: false,
        mode: 'hybrid',
        filters: {
          sourceTypes: ['local'],
          riskStatuses: ['blocked'],
          agentCodes: ['codex'],
          tags: ['imports']
        }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset library filters' }));
    expect(screen.getByLabelText('Source type filter')).toHaveValue('');
    expect(screen.getByLabelText('Risk status filter')).toHaveValue('');
    expect(screen.getByLabelText('Agent code filter')).toHaveValue('');
    expect(screen.getByLabelText('Tag filter')).toHaveValue('');
    expect(screen.getByLabelText('Library search mode')).toHaveValue('fts');

    fireEvent.click(screen.getByRole('button', { name: 'Favorite Runtime Helper' }));
    await waitFor(() => expect(api.setFavorite).toHaveBeenCalledWith(runtimeSkill.id, true));
    await waitFor(() => expect(api.getLibraryFacets).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Favorites 1')).toBeInTheDocument();
  });

  it('lets the user import TAR, sparse Git, signed mirrors, and export signed skills through IPC', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Advanced import helper',
      versionNo: 1
    };
    const tarSkill = {
      id: 'skill-tar',
      versionId: 'version-tar',
      name: 'TAR Helper',
      description: 'Imported from TAR',
      versionNo: 1
    };
    const sparseSkill = {
      id: 'skill-sparse',
      versionId: 'version-sparse',
      name: 'Sparse Helper',
      description: 'Imported from sparse Git',
      versionNo: 1
    };
    const mirrorSkill = {
      id: 'skill-mirror',
      versionId: 'version-mirror',
      name: 'Mirror Helper',
      description: 'Imported from mirror',
      versionNo: 1
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(
        workspaceState({
          librarySkills: [
            {
              id: runtimeSkill.id,
              name: runtimeSkill.name,
              sourceAgent: 'Codex',
              path: '/tmp/runtime-helper',
              installStatus: 'available'
            }
          ],
          skills: [runtimeSkill]
        })
      ),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      importTar: vi.fn().mockResolvedValue({
        skill: tarSkill,
        files: [{ relativePath: 'SKILL.md', hash: 'hash-tar', size: 120 }],
        stagedFrom: '/tmp/staging/tar'
      }),
      importGitSparse: vi.fn().mockResolvedValue({
        skill: sparseSkill,
        files: [{ relativePath: 'SKILL.md', hash: 'hash-sparse', size: 120 }],
        stagedFrom: '/tmp/staging/sparse'
      }),
      importMirror: vi.fn().mockResolvedValue({
        skill: mirrorSkill,
        files: [{ relativePath: 'SKILL.md', hash: 'hash-mirror', size: 120 }],
        stagedFrom: '/tmp/staging/mirror',
        signatureStatus: 'signed'
      }),
      getSkillDetail: vi.fn().mockResolvedValue(skillDetail(runtimeSkill)),
      exportSignedSkill: vi.fn().mockResolvedValue({
        outputDirectory: '/tmp/export/runtime-helper-signed'
      }),
      importLocalFolder: vi.fn(),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn(),
      scanSkill: vi.fn(),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Imports' }));

    fireEvent.change(screen.getByLabelText('TAR import path'), {
      target: { value: '/tmp/tar-helper.tar' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import TAR' }));
    await waitFor(() => expect(api.importTar).toHaveBeenCalledWith('/tmp/tar-helper.tar'));
    expect(screen.getByText('TAR Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sparse Git URL'), {
      target: { value: 'file:///tmp/monorepo' }
    });
    fireEvent.change(screen.getByLabelText('Sparse Git subpath'), {
      target: { value: 'skills/sparse-helper' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import sparse Git' }));
    await waitFor(() =>
      expect(api.importGitSparse).toHaveBeenCalledWith({
        gitUrl: 'file:///tmp/monorepo',
        subpath: 'skills/sparse-helper'
      })
    );
    expect(screen.getByText('Sparse Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mirror import directory'), {
      target: { value: '/tmp/mirror-helper' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import mirror' }));
    await waitFor(() => expect(api.importMirror).toHaveBeenCalledWith('/tmp/mirror-helper'));
    expect(screen.getByText('signed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Indexed skills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await waitFor(() => expect(api.getSkillDetail).toHaveBeenCalledWith(runtimeSkill.id));
    fireEvent.change(screen.getByLabelText('Skill export directory'), {
      target: { value: '/tmp/export' }
    });
    fireEvent.change(screen.getByLabelText('Signed export signer'), {
      target: { value: 'maintainer@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export signed skill' }));
    await waitFor(() =>
      expect(api.exportSignedSkill).toHaveBeenCalledWith({
        skillId: runtimeSkill.id,
        outputDirectory: '/tmp/export',
        signer: 'maintainer@example.com'
      })
    );
  });

  it('lets the user roll back, uninstall, create exemptions, and revoke exemptions through IPC', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Lifecycle helper',
      versionNo: 2
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(
        workspaceState({
          librarySkills: [
            {
              id: runtimeSkill.id,
              name: runtimeSkill.name,
              sourceAgent: 'Codex',
              path: '/tmp/runtime-helper',
              installStatus: 'installed'
            }
          ],
          skills: [runtimeSkill]
        })
      ),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      getSkillDetail: vi.fn().mockResolvedValue(skillDetail(runtimeSkill)),
      rollbackVersion: vi.fn().mockResolvedValue({
        status: 'rolled_back',
        installationId: 'installation-runtime',
        versionId: 'version-1'
      }),
      uninstall: vi.fn().mockResolvedValue({
        status: 'uninstalled',
        installationId: 'installation-runtime',
        removedFiles: ['SKILL.md'],
        preservedFiles: []
      }),
      reinstall: vi.fn().mockResolvedValue({
        status: 'reinstalled',
        installationId: 'installation-runtime',
        targetRoot: '/tmp/.codex/skills',
        projectionMode: 'copy',
        compatibility: {
          status: 'compatible',
          skillId: runtimeSkill.id,
          versionId: runtimeSkill.versionId,
          agentCode: 'codex',
          targetRoot: '/tmp/.codex/skills',
          supportedAgents: ['codex'],
          reasons: []
        }
      }),
      relink: vi.fn().mockResolvedValue({
        status: 'relinked',
        installationId: 'installation-runtime',
        targetRoot: '/tmp/.codex-relinked/skills',
        projectionMode: 'copy',
        compatibility: {
          status: 'compatible',
          skillId: runtimeSkill.id,
          versionId: runtimeSkill.versionId,
          agentCode: 'codex',
          targetRoot: '/tmp/.codex-relinked/skills',
          supportedAgents: ['codex'],
          reasons: []
        }
      }),
      setReadOnlyLock: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'locked',
          installationId: 'installation-runtime',
          readOnlyLocked: true
        })
        .mockResolvedValueOnce({
          status: 'unlocked',
          installationId: 'installation-runtime',
          readOnlyLocked: false
        }),
      createSecurityExemption: vi.fn().mockResolvedValue({
        id: 'exemption-runtime',
        skillId: runtimeSkill.id,
        scope: 'user',
        reason: 'Reviewed by maintainer',
        createdAt: '2026-06-05T00:00:00.000Z',
        revokedAt: null
      }),
      revokeSecurityExemption: vi.fn().mockResolvedValue({
        status: 'revoked',
        exemptionId: 'exemption-runtime'
      }),
      importLocalFolder: vi.fn(),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn(),
      scanSkill: vi.fn(),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await waitFor(() => expect(api.getSkillDetail).toHaveBeenCalledWith(runtimeSkill.id));

    fireEvent.click(screen.getByRole('button', { name: 'Installs' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Uninstalls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll back install' }));
    await waitFor(() => expect(api.rollbackVersion).toHaveBeenCalledWith('installation-runtime', 'version-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Reinstall app-owned files' }));
    await waitFor(() => expect(api.reinstall).toHaveBeenCalledWith('installation-runtime'));
    fireEvent.change(screen.getByLabelText('Relink target root'), {
      target: { value: '/tmp/.codex-relinked/skills' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Relink install' }));
    await waitFor(() =>
      expect(api.relink).toHaveBeenCalledWith({
        installationId: 'installation-runtime',
        targetRoot: '/tmp/.codex-relinked/skills',
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'builtin',
        scope: 'user',
        projectionMode: 'copy'
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lock read-only' }));
    await waitFor(() => expect(api.setReadOnlyLock).toHaveBeenCalledWith('installation-runtime', true));
    fireEvent.click(screen.getByRole('button', { name: 'Unlock read-only' }));
    await waitFor(() => expect(api.setReadOnlyLock).toHaveBeenCalledWith('installation-runtime', false));
    fireEvent.click(screen.getByRole('button', { name: 'Uninstall app-owned files' }));
    await waitFor(() => expect(api.uninstall).toHaveBeenCalledWith('installation-runtime'));
    expect(screen.getByText('Uninstalled app-owned files for installation-runtime.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Exemptions' }));
    fireEvent.change(screen.getByLabelText('Exemption reason'), {
      target: { value: 'Reviewed by maintainer' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create exemption' }));
    await waitFor(() =>
      expect(api.createSecurityExemption).toHaveBeenCalledWith({
        skillId: runtimeSkill.id,
        scope: 'user',
        reason: 'Reviewed by maintainer'
      })
    );
    expect(screen.getByText('Reviewed by maintainer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke exemption' }));
    await waitFor(() => expect(api.revokeSecurityExemption).toHaveBeenCalledWith('exemption-runtime'));
  });

  it('lets the user operate discover sources, opt-in sync, and plugins through IPC', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Sync helper',
      versionNo: 1
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState({ skills: [runtimeSkill] })),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      addDiscoverSource: vi.fn().mockResolvedValue({
        id: 'source-local',
        name: 'Local Curated',
        sourceType: 'local',
        url: '/tmp/curated',
        trustLevel: 'verified',
        status: 'configured',
        lastCheckedAt: null
      }),
      previewDiscoverSource: vi.fn().mockResolvedValue({
        source: {
          id: 'source-local',
          name: 'Local Curated',
          sourceType: 'local',
          url: '/tmp/curated',
          trustLevel: 'verified',
          status: 'cached',
          lastCheckedAt: '2026-06-05T00:00:00.000Z'
        },
        skills: [
          {
            name: 'Curated Helper',
            description: 'Preview only',
            relativePath: 'curated-helper',
            tags: ['curated'],
            riskStatus: 'safe'
          }
        ]
      }),
      previewMigration: vi.fn().mockResolvedValue({
        adapter: 'openskills',
        sourcePath: '/tmp/openskills',
        skills: [
          {
            name: 'Migrated Helper',
            description: 'Preview only',
            relativePath: 'migrated-helper',
            tags: ['migration'],
            riskStatus: 'safe'
          }
        ],
        warnings: []
      }),
      createSyncProfile: vi.fn().mockResolvedValue({
        id: 'sync-profile',
        mode: 'shared-folder',
        remoteUrl: '/tmp/shared',
        enabled: true,
        authRef: null,
        lastSyncAt: null
      }),
      enqueueSyncLocalChange: vi.fn().mockResolvedValue({
        id: 'outbox-runtime',
        profileId: 'sync-profile',
        entityType: 'skill_version',
        entityId: runtimeSkill.versionId,
        status: 'queued',
        payload: { skillId: runtimeSkill.id }
      }),
      pushSync: vi.fn().mockResolvedValue({ status: 'pushed' }),
      pullSync: vi.fn().mockResolvedValue([
        {
          id: 'inbox-runtime',
          profileId: 'sync-profile',
          entityType: 'skill_version',
          entityId: runtimeSkill.versionId,
          status: 'received',
          payload: { skillId: runtimeSkill.id }
        }
      ]),
      installPlugin: vi.fn().mockResolvedValue({
        id: 'plugin-runtime',
        name: 'Runtime Plugin',
        version: '1.0.0',
        rootPath: '/tmp/plugin',
        status: 'installed'
      }),
      authorizePluginPermission: vi.fn().mockResolvedValue({ status: 'authorized' }),
      enablePlugin: vi.fn().mockResolvedValue({
        agentAdapters: [{ pluginId: 'plugin-runtime', code: 'runtime-agent', displayName: 'Runtime Agent' }],
        importers: [{ pluginId: 'plugin-runtime', id: 'frontmatter-importer', name: 'Frontmatter Importer' }],
        securityRules: [{ pluginId: 'plugin-runtime', id: 'extra-risk', name: 'Extra Risk' }],
        syncDrivers: [{ pluginId: 'plugin-runtime', id: 'remote-sync', name: 'Remote Sync' }]
      }),
      disablePlugin: vi.fn().mockResolvedValue({ status: 'disabled' }),
      getPluginRegistry: vi.fn().mockResolvedValue({
        agentAdapters: [],
        importers: [],
        securityRules: [],
        syncDrivers: []
      }),
      importLocalFolder: vi.fn(),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn(),
      scanSkill: vi.fn(),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    fireEvent.change(screen.getByLabelText('Discover source name'), {
      target: { value: 'Local Curated' }
    });
    fireEvent.change(screen.getByLabelText('Discover source URL'), {
      target: { value: '/tmp/curated' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    await waitFor(() =>
      expect(api.addDiscoverSource).toHaveBeenCalledWith({
        name: 'Local Curated',
        sourceType: 'local',
        url: '/tmp/curated',
        trustLevel: 'verified'
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));
    await waitFor(() => expect(api.previewDiscoverSource).toHaveBeenCalledWith('source-local'));
    expect(screen.getByText('Curated Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Migration source path'), {
      target: { value: '/tmp/openskills' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview migration' }));
    await waitFor(() =>
      expect(api.previewMigration).toHaveBeenCalledWith({
        adapter: 'openskills',
        sourcePath: '/tmp/openskills'
      })
    );
    expect(screen.getByText('Migrated Helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sync' }));
    fireEvent.change(screen.getByLabelText('Sync remote path'), {
      target: { value: '/tmp/shared' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sync profile' }));
    await waitFor(() =>
      expect(api.createSyncProfile).toHaveBeenCalledWith({
        mode: 'shared-folder',
        remoteUrl: '/tmp/shared',
        enabled: true
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Push and pull' }));
    await waitFor(() =>
      expect(api.enqueueSyncLocalChange).toHaveBeenCalledWith({
        profileId: 'sync-profile',
        entityType: 'skill_version',
        entityId: runtimeSkill.versionId,
        payload: { skillId: runtimeSkill.id, versionNo: runtimeSkill.versionNo }
      })
    );
    expect(api.pushSync).toHaveBeenCalledWith('sync-profile');
    expect(api.pullSync).toHaveBeenCalledWith('sync-profile');

    fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }));
    fireEvent.change(screen.getByLabelText('Plugin folder'), {
      target: { value: '/tmp/plugin' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Install plugin' }));
    await waitFor(() => expect(api.installPlugin).toHaveBeenCalledWith('/tmp/plugin'));
    fireEvent.click(screen.getByRole('button', { name: 'Authorize permission' }));
    await waitFor(() =>
      expect(api.authorizePluginPermission).toHaveBeenCalledWith({
        pluginId: 'plugin-runtime',
        permission: 'network:fetch',
        reason: 'User authorized from Settings'
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enable plugin' }));
    await waitFor(() => expect(api.enablePlugin).toHaveBeenCalledWith('plugin-runtime'));
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Sync' }));
    expect(screen.getByRole('option', { name: 'Remote Sync' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disable plugin' }));
    await waitFor(() => expect(api.disablePlugin).toHaveBeenCalledWith('plugin-runtime'));
    expect(api.getPluginRegistry).toHaveBeenCalled();
  });

  it('lets the user create, inspect, and delete masked REST sync credentials without rendering raw tokens', async () => {
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState()),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      createSyncProfile: vi.fn().mockResolvedValue({
        id: 'sync-profile-rest',
        mode: 'rest',
        remoteUrl: 'https://sync.example.test',
        enabled: true,
        authRef: 'keychain://sync/profile-rest',
        lastSyncAt: null
      }),
      inspectSyncCredential: vi.fn().mockResolvedValue({
        authRef: 'keychain://sync/profile-rest',
        label: 'Production sync token',
        masked: 'su************en'
      }),
      deleteSyncCredential: vi.fn().mockResolvedValue({ status: 'deleted' }),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sync' }));
    fireEvent.change(screen.getByLabelText('Sync mode'), {
      target: { value: 'rest' }
    });
    fireEvent.change(screen.getByLabelText('Sync remote path'), {
      target: { value: 'https://sync.example.test' }
    });
    fireEvent.change(screen.getByLabelText('Credential label'), {
      target: { value: 'Production sync token' }
    });
    fireEvent.change(screen.getByLabelText('Credential token'), {
      target: { value: 'super-secret-token' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sync profile' }));

    await waitFor(() =>
      expect(api.createSyncProfile).toHaveBeenCalledWith({
        mode: 'rest',
        remoteUrl: 'https://sync.example.test',
        enabled: true,
        auth: {
          label: 'Production sync token',
          token: 'super-secret-token'
        }
      })
    );
    expect(document.body.textContent).not.toContain('super-secret-token');

    fireEvent.click(screen.getByRole('button', { name: 'Inspect credential' }));
    await waitFor(() => expect(api.inspectSyncCredential).toHaveBeenCalledWith('keychain://sync/profile-rest'));
    expect(screen.getByText('Production sync token')).toBeInTheDocument();
    expect(screen.getByText('su************en')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('super-secret-token');

    fireEvent.click(screen.getByRole('button', { name: 'Delete credential' }));
    await waitFor(() => expect(api.deleteSyncCredential).toHaveBeenCalledWith('keychain://sync/profile-rest'));
    expect(screen.getByText('Credential deleted')).toBeInTheDocument();
  });

  it('lists sync conflicts and applies explicit metadata, file draft, and delete resolutions', async () => {
    const conflicts = [
      {
        id: 'conflict-metadata',
        profileId: 'sync-profile',
        entityType: 'skill_metadata',
        entityId: 'skill-runtime',
        base: { name: 'Runtime Helper', description: 'base' },
        local: { name: 'Local Helper', description: 'local' },
        remote: { name: 'Remote Helper', description: 'remote' },
        status: 'open' as const,
        resolution: null
      },
      {
        id: 'conflict-files',
        profileId: 'sync-profile',
        entityType: 'skill_files',
        entityId: 'skill-runtime',
        base: { files: [{ relativePath: 'SKILL.md', hash: 'base' }] },
        local: { files: [{ relativePath: 'SKILL.md', hash: 'local' }] },
        remote: { files: [{ relativePath: 'SKILL.md', hash: 'remote' }] },
        status: 'open' as const,
        resolution: null
      },
      {
        id: 'conflict-delete',
        profileId: 'sync-profile',
        entityType: 'skill_delete',
        entityId: 'skill-runtime',
        base: { status: 'active' },
        local: { status: 'active' },
        remote: { status: 'deleted' },
        status: 'open' as const,
        resolution: null
      }
    ];
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(
        workspaceState({
          syncCenter: {
            profiles: [{ mode: 'rest', status: 'enabled' }],
            outbox: [],
            inbox: [],
            conflicts: conflicts.map((conflict) => ({ entityType: conflict.entityType, status: conflict.status }))
          }
        })
      ),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      listSyncConflicts: vi.fn().mockResolvedValue(conflicts),
      applySyncConflict: vi.fn().mockImplementation(async ({ conflictId }) => ({
        ...conflicts.find((conflict) => conflict.id === conflictId)!,
        status: 'resolved',
        resolution: 'applied'
      })),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sync' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load sync conflicts' }));

    await waitFor(() => expect(api.listSyncConflicts).toHaveBeenCalledWith(undefined));
    expect(screen.getByText('Local Helper')).toBeInTheDocument();
    expect(screen.getByText('Remote Helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply local metadata for conflict-metadata' }));
    await waitFor(() =>
      expect(api.applySyncConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-metadata',
        confirm: true,
        resolution: {
          type: 'metadata',
          fields: {
            name: { source: 'local' },
            description: { source: 'local' }
          }
        }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create file drafts for conflict-files' }));
    await waitFor(() =>
      expect(api.applySyncConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-files',
        confirm: true,
        resolution: { type: 'file-drafts' }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Soft-delete skill for conflict-delete' }));
    await waitFor(() =>
      expect(api.applySyncConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-delete',
        confirm: true,
        resolution: { type: 'delete', action: 'soft-delete' }
      })
    );
    expect(screen.getByText('Applied conflict-delete')).toBeInTheDocument();
  });

  it('lets the user create active policy packs and preview/apply team baselines through IPC', async () => {
    const policy = {
      id: 'policy-safe-local',
      name: 'Safe Local Policy',
      allowedSources: ['local', 'mirror'],
      blockedRules: ['dangerous-shell-command'],
      requiredScanLevel: 'safe',
      approvedPlugins: ['approved-plugin']
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState()),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      createPolicyPack: vi.fn().mockResolvedValue(policy),
      setActivePolicyPack: vi.fn().mockResolvedValue({ status: 'active' }),
      evaluatePolicy: vi.fn().mockResolvedValue({ allowed: false, reasons: ['source-blocked:git'] }),
      exportBaseline: vi.fn().mockResolvedValue({ outputDirectory: '/tmp/baseline-export' }),
      previewBaseline: vi.fn().mockResolvedValue({
        name: 'Frontend Team',
        changes: ['policy-pack:create:Safe Local Policy'],
        writesAgentRoots: false
      }),
      applyBaseline: vi.fn().mockResolvedValue({
        name: 'Frontend Team',
        changes: ['policy-pack:create:Safe Local Policy'],
        writesAgentRoots: false
      }),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Rules' }));
    fireEvent.change(screen.getByLabelText('Policy pack name'), {
      target: { value: 'Safe Local Policy' }
    });
    fireEvent.change(screen.getByLabelText('Allowed sources'), {
      target: { value: 'local, mirror' }
    });
    fireEvent.change(screen.getByLabelText('Blocked rule IDs'), {
      target: { value: 'dangerous-shell-command' }
    });
    fireEvent.change(screen.getByLabelText('Approved plugin IDs'), {
      target: { value: 'approved-plugin' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create policy pack' }));

    await waitFor(() =>
      expect(api.createPolicyPack).toHaveBeenCalledWith({
        name: 'Safe Local Policy',
        allowedSources: ['local', 'mirror'],
        blockedRules: ['dangerous-shell-command'],
        requiredScanLevel: 'safe',
        approvedPlugins: ['approved-plugin']
      })
    );
    expect(api.setActivePolicyPack).toHaveBeenCalledWith('policy-safe-local');

    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Git source' }));
    await waitFor(() =>
      expect(api.evaluatePolicy).toHaveBeenCalledWith({
        policyPackId: 'policy-safe-local',
        sourceType: 'git',
        findingRuleIds: [],
        scanLevel: 'safe',
        pluginIds: ['approved-plugin']
      })
    );
    expect(screen.getByText('source-blocked:git')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Baseline output directory'), {
      target: { value: '/tmp/baseline-export' }
    });
    fireEvent.change(screen.getByLabelText('Baseline name'), {
      target: { value: 'Frontend Team' }
    });
    fireEvent.change(screen.getByLabelText('Baseline package directory'), {
      target: { value: '/tmp/baseline-export' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export baseline' }));
    await waitFor(() =>
      expect(api.exportBaseline).toHaveBeenCalledWith({
        outputDirectory: '/tmp/baseline-export',
        name: 'Frontend Team',
        collectionIds: [],
        policyPackId: 'policy-safe-local',
        rootTemplates: [{ agentCode: 'codex', scope: 'project', rootPathTemplate: '.codex/skills' }]
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview baseline' }));
    await waitFor(() => expect(api.previewBaseline).toHaveBeenCalledWith('/tmp/baseline-export'));
    expect(screen.getByText('policy-pack:create:Safe Local Policy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply baseline' }));
    await waitFor(() => expect(api.applyBaseline).toHaveBeenCalledWith('/tmp/baseline-export', true));
    expect(screen.getByText('writesAgentRoots:false')).toBeInTheDocument();
  });

  it('shows a first-launch wizard before the dashboard and can skip onboarding', async () => {
    const api = {
      getOnboardingState: vi.fn().mockResolvedValue({
        completed: false,
        detectedRoots: [],
        migrationPreviews: []
      }),
      completeOnboarding: vi.fn().mockResolvedValue({
        completed: true,
        detectedRoots: [],
        migrationPreviews: []
      }),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState()),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'First launch setup' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip setup' }));
    await waitFor(() => expect(api.completeOnboarding).toHaveBeenCalledWith(true));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('previews and explicitly imports migration selections from the first-launch wizard', async () => {
    const migratedSkill = {
      id: 'skill-migrated',
      versionId: 'version-migrated',
      name: 'Migrated Helper',
      description: 'Imported through migration',
      versionNo: 1,
      favorite: false
    };
    const api = {
      getOnboardingState: vi.fn().mockResolvedValue({
        completed: false,
        detectedRoots: [],
        migrationPreviews: []
      }),
      completeOnboarding: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState()),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      previewMigration: vi.fn().mockResolvedValue({
        adapter: 'skillhub',
        sourcePath: '/tmp/skillhub',
        writesPlanned: false,
        skills: [
          {
            name: 'Migrated Helper',
            description: 'Preview only',
            tags: ['migration'],
            path: '/tmp/skillhub/skills/migrated-helper',
            riskStatus: 'unscanned'
          }
        ]
      }),
      importMigration: vi.fn().mockResolvedValue([
        {
          skill: migratedSkill,
          files: [{ relativePath: 'SKILL.md', hash: 'hash-migrated', size: 120 }],
          stagedFrom: '/tmp/staging/migrated'
        }
      ]),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await screen.findByRole('heading', { name: 'First launch setup' });
    fireEvent.change(screen.getByLabelText('Migration adapter'), {
      target: { value: 'skillhub' }
    });
    fireEvent.change(screen.getByLabelText('Migration source path'), {
      target: { value: '/tmp/skillhub' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview migration' }));

    await waitFor(() =>
      expect(api.previewMigration).toHaveBeenCalledWith({
        adapter: 'skillhub',
        sourcePath: '/tmp/skillhub'
      })
    );
    expect(api.importMigration).not.toHaveBeenCalled();
    expect(screen.getByText('Migrated Helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import selected migration' }));
    await waitFor(() =>
      expect(api.importMigration).toHaveBeenCalledWith({
        adapter: 'skillhub',
        sourcePath: '/tmp/skillhub',
        paths: ['/tmp/skillhub/skills/migrated-helper']
      })
    );
    expect(screen.getByText('Imported Migrated Helper')).toBeInTheDocument();
  });

  it('selects individual migration items, maps import labels, and surfaces duplicate warnings', async () => {
    const migratedSkill = {
      id: 'skill-keep',
      versionId: 'version-keep',
      name: 'Keep Helper',
      description: 'Imported through migration',
      versionNo: 1,
      favorite: false
    };
    const api = {
      getOnboardingState: vi.fn().mockResolvedValue({
        completed: false,
        detectedRoots: [],
        migrationPreviews: []
      }),
      completeOnboarding: vi.fn(),
      previewMigration: vi.fn().mockResolvedValue({
        adapter: 'openskills',
        sourcePath: '/tmp/openskills',
        writesPlanned: false,
        skills: [
          {
            name: 'Keep Helper',
            description: 'Preview keep',
            tags: ['migration'],
            path: '/tmp/openskills/keep-helper',
            riskStatus: 'unscanned',
            selected: true,
            importLabel: 'duplicate-helper',
            warnings: ['duplicate-import-label']
          },
          {
            name: 'Skip Helper',
            description: 'Preview skip',
            tags: ['migration'],
            path: '/tmp/openskills/skip-helper',
            riskStatus: 'unscanned',
            selected: true,
            importLabel: 'duplicate-helper',
            warnings: ['duplicate-import-label']
          }
        ]
      }),
      importMigration: vi.fn().mockResolvedValue([
        {
          skill: migratedSkill,
          files: [{ relativePath: 'SKILL.md', hash: 'hash-keep', size: 120 }],
          stagedFrom: '/tmp/staging/keep'
        }
      ]),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await screen.findByRole('heading', { name: 'First launch setup' });
    fireEvent.change(screen.getByLabelText('Migration source path'), {
      target: { value: '/tmp/openskills' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview migration' }));
    await waitFor(() => expect(api.previewMigration).toHaveBeenCalled());
    expect(screen.getAllByText('duplicate-import-label').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Select none migration items' }));
    expect(screen.getByLabelText('Select Keep Helper')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Select Keep Helper'));
    fireEvent.change(screen.getByLabelText('Import label for Keep Helper'), {
      target: { value: 'custom-keep' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import selected migration' }));

    await waitFor(() =>
      expect(api.importMigration).toHaveBeenCalledWith({
        adapter: 'openskills',
        sourcePath: '/tmp/openskills',
        items: [
          {
            path: '/tmp/openskills/keep-helper',
            selected: true,
            importLabel: 'custom-keep'
          },
          {
            path: '/tmp/openskills/skip-helper',
            selected: false,
            importLabel: 'duplicate-helper'
          }
        ]
      })
    );
    expect(screen.getByText('Imported Keep Helper')).toBeInTheDocument();
  });

  it('lets the user favorite skills and search only favorites', async () => {
    const runtimeSkill = {
      id: 'skill-runtime',
      versionId: 'version-runtime',
      name: 'Runtime Helper',
      description: 'Searchable runtime helper',
      versionNo: 1,
      favorite: false
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState({ skills: [runtimeSkill] })),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      searchLibrary: vi.fn().mockResolvedValue([runtimeSkill]),
      setFavorite: vi.fn().mockResolvedValue({ ...runtimeSkill, favorite: true }),
      getSkillDetail: vi.fn().mockResolvedValue(skillDetail({ ...runtimeSkill, favorite: true })),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.change(screen.getByLabelText('Library search query'), {
      target: { value: 'runtime' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search library' }));
    await waitFor(() => expect(api.searchLibrary).toHaveBeenCalledWith('runtime', { favoritesOnly: false }));

    fireEvent.click(screen.getByRole('button', { name: 'Favorite Runtime Helper' }));
    await waitFor(() => expect(api.setFavorite).toHaveBeenCalledWith('skill-runtime', true));

    fireEvent.click(screen.getByLabelText('Favorites only'));
    fireEvent.click(screen.getByRole('button', { name: 'Search library' }));
    await waitFor(() => expect(api.searchLibrary).toHaveBeenLastCalledWith('runtime', { favoritesOnly: true }));
  });

  it('adds project roots from Settings and exposes them as install targets', async () => {
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceState()),
      listInstallTargets: vi.fn().mockResolvedValue([]),
      addProjectRoot: vi.fn().mockResolvedValue({
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'builtin',
        rootPath: '/tmp/project/.codex/skills',
        scope: 'project',
        rootKind: 'project',
        writable: true,
        isDefault: false
      }),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Project root path'), {
      target: { value: '/tmp/project/.codex/skills' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add project root' }));

    await waitFor(() =>
      expect(api.addProjectRoot).toHaveBeenCalledWith({
        agentCode: 'codex',
        rootPath: '/tmp/project/.codex/skills'
      })
    );
    expect(screen.getByText('/tmp/project/.codex/skills')).toBeInTheDocument();
  });

  it('runs an initial agent scan when the runtime workspace has no indexed local skills', async () => {
    const scannedSkill = {
      id: 'skill-openai-docs',
      versionId: 'version-openai-docs',
      name: 'openai-docs',
      description: 'Searches local OpenAI docs.',
      versionNo: 1
    };
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi
        .fn()
        .mockResolvedValueOnce(workspaceState())
        .mockResolvedValueOnce(
          workspaceState({
            librarySkills: [
              {
                id: scannedSkill.id,
                name: scannedSkill.name,
                sourceAgent: 'Codex',
                path: '/Users/a1/.codex/skills/.system/openai-docs',
                installStatus: 'installed'
              }
            ],
            skills: [scannedSkill]
          })
        ),
      importLocalFolder: vi.fn(),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn(),
      scanSkill: vi.fn(),
      scanAgentRoots: vi.fn().mockResolvedValue({
        indexedSkills: [
          {
            id: scannedSkill.id,
            name: scannedSkill.name,
            agentCode: 'codex',
            path: '/Users/a1/.codex/skills/.system/openai-docs',
            files: [{ relativePath: 'SKILL.md', size: 120 }]
          }
        ],
        errors: []
      }),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.scanAgentRoots).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));

    expect(screen.getAllByText('openai-docs').length).toBeGreaterThan(0);
    expect(screen.getByText('/Users/a1/.codex/skills/.system/openai-docs')).toBeInTheDocument();
    expect(screen.getByText('installed')).toBeInTheDocument();
  });

  it('renders Discover, Usage, Reviews, and Settings contract copy from empty local state', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    expect(screen.getByText('Browse trusted local and remote skill sources before importing.')).toBeInTheDocument();
    expect(screen.getByText('No files are written to agent roots until an install plan is reviewed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Source filter: All' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Usage' }));
    expect(screen.getByText('Local usage signals from installs, launches, scans, and exports.')).toBeInTheDocument();
    expect(screen.getByText('Usage is derived from local SQLite records. No cloud analytics.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeInTheDocument();
    expect(screen.getByText('High-risk installs stay blocked until a scoped exemption is recorded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Privacy' }));
    const settingsWorkspace = screen.getByRole('region', { name: 'Settings workspace' });
    const currentDefaults = within(settingsWorkspace).getByRole('region', { name: 'Current defaults' });
    expect(within(currentDefaults).getByText('Node integration')).toBeInTheDocument();
    expect(within(currentDefaults).getByText('Off')).toBeInTheDocument();
    expect(within(currentDefaults).getByText('Context isolation')).toBeInTheDocument();
    expect(within(currentDefaults).getByText('On')).toBeInTheDocument();
    expect(within(currentDefaults).getByText('Telemetry')).toBeInTheDocument();
    expect(within(currentDefaults).getAllByText('None')).toHaveLength(2);
  });

  it('renders persisted usage and review center state ahead of fixture-backed rows', () => {
    render(
      <App
        initialUsageCenter={{
          totals: {
            launches: 0,
            installs: 2,
            scans: 1,
            exports: 0
          },
          dailyActivity: [{ date: '2026-06-01', count: 3 }],
          topSkills: [{ skillName: 'Runtime Helper', count: 3 }],
          agentSplit: [{ agent: 'Codex', count: 2 }],
          recent: [
            {
              eventType: 'security.scan',
              label: 'Security scanned Runtime Helper',
              value: '2026-06-01T11:00:00.000Z'
            }
          ]
        }}
        initialReviewCenter={{
          queue: [
            {
              id: 'review-runtime',
              title: 'Runtime Helper security review',
              detail: 'v1 security scan',
              reason: 'Dangerous shell command',
              source: 'Security scan',
              reviewer: 'Maintainer',
              risk: 'High',
              status: 'Open',
              skillName: 'Runtime Helper'
            }
          ],
          notes: [{ label: 'Explain why shell access is required.', value: 'open' }]
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Usage' }));
    expect(screen.getByText('Runtime Helper')).toBeInTheDocument();
    expect(screen.getByText('Security scanned Runtime Helper')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    expect(screen.getAllByText('Runtime Helper security review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dangerous shell command').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Explain why shell access is required.').length).toBeGreaterThan(0);
  });

  it('refreshes runtime review queue after a security scan creates a review item', async () => {
    const runtimeSkill = {
      id: 'skill-high-risk',
      versionId: 'version-high-risk',
      name: 'High Risk Helper',
      description: 'Imported through the renderer',
      versionNo: 1
    };
    const initialState = workspaceState({
      skills: [runtimeSkill]
    });
    const refreshedState = workspaceState({
      skills: [runtimeSkill],
      securityCenter: {
        queue: [{ skillName: 'High Risk Helper', status: 'blocked' }],
        riskScore: 100,
        level: 'critical',
        findings: [{ ruleName: 'Dangerous shell command', severity: 'critical' }],
        history: [{ skillName: 'High Risk Helper', level: 'critical' }],
        exemptions: []
      },
      reviewCenter: {
        queue: [
          {
            id: 'review-high-risk',
            title: 'High Risk Helper security review',
            detail: 'v1 security scan',
            reason: 'Dangerous shell command',
            source: 'Security scan',
            reviewer: 'Maintainer',
            risk: 'Critical',
            status: 'Open',
            skillName: 'High Risk Helper'
          }
        ],
        notes: []
      }
    });
    const api = {
      getAppInfo: vi.fn(),
      listLibrarySkills: vi.fn(),
      getWorkspaceState: vi.fn().mockResolvedValueOnce(initialState).mockResolvedValueOnce(refreshedState),
      importLocalFolder: vi.fn(),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn(),
      scanSkill: vi.fn().mockResolvedValue({
        id: 'scan-high-risk',
        skillId: runtimeSkill.id,
        versionId: runtimeSkill.versionId,
        score: 100,
        level: 'critical',
        blocked: true,
        rulesetVersion: 'test',
        findings: [
          {
            ruleId: 'dangerous-shell-command',
            ruleName: 'Dangerous shell command',
            severity: 'critical',
            category: 'execution',
            relativePath: 'SKILL.md',
            lineNo: 1,
            excerpt: 'rm -rf'
          }
        ]
      }),
      scanAgentRoots: vi.fn(),
      getSyncStartupPlan: vi.fn(),
      getPluginCenterState: vi.fn()
    };
    window.theOpenHub = api as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run rescan' }));

    await waitFor(() => expect(api.scanSkill).toHaveBeenCalledWith(runtimeSkill.id));
    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    expect(screen.getAllByText('High Risk Helper security review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dangerous shell command').length).toBeGreaterThan(0);
  });
});

function workspaceState(overrides: Partial<DesktopWorkspaceState> = {}): DesktopWorkspaceState {
  return {
    appInfo: {
      productName: 'OpenHub',
      phase: 'Phase 10',
      localFirst: true
    },
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
    },
    ...overrides
  };
}

function skillDetail(skill: {
  id: string;
  versionId: string;
  name: string;
  description: string;
  versionNo: number;
  favorite?: boolean;
}) {
  return {
    skill: {
      ...skill,
      slug: skill.name.toLowerCase().replaceAll(' ', '-'),
      tags: ['runtime']
    },
    source: {
      type: 'local',
      url: '/tmp/runtime-helper',
      trustLevel: 'verified'
    },
    versions: [
      {
        versionId: 'version-1',
        skillId: skill.id,
        versionNo: 1,
        changeSummary: 'Initial import',
        createdAt: '2026-06-05T00:00:00.000Z',
        lifecycle: 'released',
        releaseChannel: 'stable'
      }
    ],
    files: [
      {
        relativePath: 'SKILL.md',
        hash: 'hash-runtime',
        size: 140,
        kind: 'markdown'
      },
      {
        relativePath: 'references/guide.md',
        hash: 'hash-guide',
        size: 80,
        kind: 'markdown'
      }
    ],
    skillMarkdown: '# Runtime Helper\n\nRuntime helper instructions.',
    latestScan: {
      scanId: 'scan-runtime',
      score: 0,
      level: 'safe',
      blocked: false,
      scannedAt: '2026-06-05T00:00:00.000Z'
    },
    installations: [
      {
        installationId: 'installation-runtime',
        agent: 'Codex',
        rootPath: '/tmp/.codex/skills',
        scope: 'user',
        installPath: '/tmp/.codex/skills/runtime-helper',
        status: 'installed',
        projectionMode: 'copy',
        readOnlyLocked: false,
        versionNo: skill.versionNo
      }
    ],
    riskStatus: 'safe'
  };
}
