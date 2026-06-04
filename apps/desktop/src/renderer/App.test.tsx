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
      ['discover', 'Discover', 'skills.sh official'],
      ['installs', 'Installs', 'sui-move-contract'],
      ['usage', 'Usage', 'Usage insight'],
      ['reviews', 'Reviews', 'gh-fix-ci update'],
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
    expect(screen.getByText('High Risk Helper')).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('Change manifest and add guide')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diff' })).toBeInTheDocument();
    expect(screen.getByText('references/new.txt')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.getByText('Starter Pack')).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Offline-first sync' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sync preview' })).toBeInTheDocument();
    expect(screen.getByText('shared-folder')).toBeInTheDocument();
    expect(screen.getByText('1 queued')).toBeInTheDocument();
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('1 open')).toBeInTheDocument();
  });

  it('shows Plugins install, enable, permission, capability, and error state', () => {
    render(
      <App
        initialPlugins={{
          plugins: [
            {
              name: 'Mock Agent Plugin',
              status: 'enabled',
              capabilities: ['agent-adapter:mock-agent'],
              permissions: [{ name: 'network:fetch', status: 'authorized' }],
              errors: [{ message: 'Unsafe plugin entry blocked' }]
            }
          ]
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('heading', { name: 'Plugin runtime' })).toBeInTheDocument();
    expect(screen.getByText('Mock Agent Plugin')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('agent-adapter:mock-agent')).toBeInTheDocument();
    expect(screen.getByText('network:fetch')).toBeInTheDocument();
    expect(screen.getByText('authorized')).toBeInTheDocument();
    expect(screen.getByText('Unsafe plugin entry blocked')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Import source path'), {
      target: { value: '/tmp/runtime-helper' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import local folder' }));

    await waitFor(() => expect(api.importLocalFolder).toHaveBeenCalledWith('/tmp/runtime-helper'));
    expect(screen.getByText('Runtime Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Install target root'), {
      target: { value: '/tmp/.codex/skills' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create install plan' }));

    await waitFor(() =>
      expect(api.createInstallPlan).toHaveBeenCalledWith({
        skillId: importedSkill.id,
        targetRoot: '/tmp/.codex/skills',
        agentCode: 'codex',
        agentDisplayName: 'Codex',
        adapterVersion: 'builtin',
        scope: 'user'
      })
    );
    expect(screen.getByText('1 planned writes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply install plan' }));
    await waitFor(() => expect(api.applyInstallPlan).toHaveBeenCalledWith(installPlan));
    expect(screen.getByText('Installed 1 files by copy projection.')).toBeInTheDocument();
  });

  it('renders Discover, Usage, Reviews, and Settings contract copy from local fixture boundaries', () => {
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
    const currentDefaults = screen.getByRole('region', { name: 'Current defaults' });
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
    expect(screen.getByText('Runtime Helper security review')).toBeInTheDocument();
    expect(screen.getByText('Dangerous shell command')).toBeInTheDocument();
    expect(screen.getByText('Explain why shell access is required.')).toBeInTheDocument();
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

    expect(screen.getByText('High Risk Helper security review')).toBeInTheDocument();
    expect(screen.getByText('Dangerous shell command')).toBeInTheDocument();
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
      plugins: []
    },
    ...overrides
  };
}
