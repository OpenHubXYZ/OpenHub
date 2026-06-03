/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

describe('desktop app shell', () => {
  afterEach(() => {
    cleanup();
    delete window.theOpenHub;
  });

  it('shows the product name and Phase 10 empty state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TheOpenHub Skills Studio' })).toBeInTheDocument();
    expect(screen.getByText('Phase 10 maintainer operations')).toBeInTheDocument();
    expect(screen.getByText('No skills indexed yet')).toBeInTheDocument();
    expect(screen.getByText('SQLite source of truth')).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Security Center' })).toBeInTheDocument();
    expect(screen.getByText('Risk Score')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('Dangerous shell command')).toBeInTheDocument();
    expect(screen.getByText('Medium Risk Helper')).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Sync Center' })).toBeInTheDocument();
    expect(screen.getByText('shared-folder')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
    expect(screen.getByText('received')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument();
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
          productName: 'TheOpenHub Skills Studio',
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

    await screen.findByRole('heading', { name: 'Import Queue' });
    fireEvent.click(screen.getByRole('button', { name: 'Scan agent roots' }));
    await waitFor(() => expect(api.scanAgentRoots).toHaveBeenCalled());
    expect(screen.getByText('Scanned Helper')).toBeInTheDocument();

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
});
