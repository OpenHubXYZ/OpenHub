/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopWorkspaceState, LibraryScanResult } from '@theopenhub/shared';

import { App } from './App';
import { createEmptyWorkspaceState } from './workspace-view-model';

describe('desktop app shell', () => {
  afterEach(() => {
    cleanup();
    delete window.theOpenHub;
  });

  it('renders the skills workbench without Sources, Deploy, or Trust navigation', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: 'Primary pages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inventory' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sources' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deploy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trust' })).not.toBeInTheDocument();
    expect(screen.queryByText(/security center/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/install plan/i)).not.toBeInTheDocument();
  });

  it('starts automatic root scanning after initial workspace data is visible', async () => {
    const state = createEmptyWorkspaceState();
    const initialWorkspace = deferred<DesktopWorkspaceState>();
    const scan = deferred<LibraryScanResult>();
    const events: string[] = [];
    const root = createRoot('/tmp/.codex/skills');
    const source = createSource();
    window.theOpenHub = {
      getWorkspaceState: vi
        .fn()
        .mockImplementationOnce(() => {
          events.push('workspace.initial');
          return initialWorkspace.promise;
        })
        .mockImplementationOnce(() => {
          events.push('workspace.refresh');
          return Promise.resolve(workspaceWithSkill(state, 'Scanned Helper'));
        }),
      listAgentRoots: vi
        .fn()
        .mockImplementationOnce(() => {
          events.push('roots.initial');
          return Promise.resolve([root]);
        })
        .mockImplementationOnce(() => {
          events.push('roots.refresh');
          return Promise.resolve([root]);
        }),
      listDiscoverSources: vi
        .fn()
        .mockImplementationOnce(() => {
          events.push('sources.initial');
          return Promise.resolve([source]);
        })
        .mockImplementationOnce(() => {
          events.push('sources.refresh');
          return Promise.resolve([source]);
        }),
      scanAgentRoots: vi.fn().mockImplementation(() => {
        events.push('scan');
        return scan.promise;
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    expect(window.theOpenHub!.scanAgentRoots).not.toHaveBeenCalled();

    await act(async () => {
      initialWorkspace.resolve(workspaceWithSkill(state, 'Cached Helper'));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(await screen.findByText('Cached Helper')).toBeInTheDocument();
    expect(await screen.findByText('Scanning roots...')).toBeInTheDocument();
    await waitFor(() => expect(window.theOpenHub!.scanAgentRoots).toHaveBeenCalledTimes(1));
    expect(events.indexOf('scan')).toBeGreaterThan(events.indexOf('workspace.initial'));
    expect(events.indexOf('scan')).toBeGreaterThan(events.indexOf('roots.initial'));
    expect(events.indexOf('scan')).toBeGreaterThan(events.indexOf('sources.initial'));

    await act(async () => {
      scan.resolve({
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
      });
    });

    expect(await screen.findByText('Scanned Helper')).toBeInTheDocument();
    expect(await screen.findByText('1 indexed')).toBeInTheDocument();
    expect(window.theOpenHub.getWorkspaceState).toHaveBeenCalledTimes(2);
    expect(window.theOpenHub.listAgentRoots).toHaveBeenCalledTimes(2);
    expect(window.theOpenHub.listDiscoverSources).toHaveBeenCalledTimes(2);
  });

  it('reports automatic scan errors without clearing the loaded workspace', async () => {
    const state = createEmptyWorkspaceState();
    window.theOpenHub = {
      getWorkspaceState: vi
        .fn()
        .mockResolvedValueOnce(workspaceWithSkill(state, 'Cached Helper'))
        .mockResolvedValueOnce(workspaceWithSkill(state, 'Scanned Helper')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
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
        errors: [
          { agentCode: 'codex', code: 'parse_error', skillPath: '/tmp/a', message: 'Bad skill A' },
          { agentCode: 'codex', code: 'parse_error', skillPath: '/tmp/b', message: 'Bad skill B' }
        ]
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));

    expect(await screen.findByText('Scanned Helper')).toBeInTheDocument();
    expect(await screen.findByText('1 indexed, 2 errors')).toBeInTheDocument();
  });

  it('keeps initial workspace state visible when automatic scanning rejects', async () => {
    const state = createEmptyWorkspaceState();
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceWithSkill(state, 'Cached Helper')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      scanAgentRoots: vi.fn().mockRejectedValue(new Error('Scan failed'))
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));

    expect(await screen.findByText('Cached Helper')).toBeInTheDocument();
    expect(await screen.findByText('Scan failed')).toBeInTheDocument();
    expect(screen.getByText('Cached Helper')).toBeInTheDocument();
  });

  it('keeps manual root scanning available after the startup scan', async () => {
    const state = createEmptyWorkspaceState();
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceWithSkill(state, 'Runtime Helper')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      scanAgentRoots: vi.fn().mockResolvedValue({
        indexedSkills: [
          {
            id: 'skill-runtime',
            name: 'Runtime Helper',
            agentCode: 'codex',
            path: '/tmp/.codex/skills/runtime-helper',
            files: [{ relativePath: 'SKILL.md', size: 120 }]
          }
        ],
        errors: []
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);

    await waitFor(() => expect(window.theOpenHub!.scanAgentRoots).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Scan roots' }));

    await waitFor(() => expect(window.theOpenHub!.scanAgentRoots).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('indexed').length).toBeGreaterThan(0);
  });

  it('does not refresh workspace after a root scan resolves post-unmount', async () => {
    const state = createEmptyWorkspaceState();
    const startupScan = deferred<LibraryScanResult>();
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceWithSkill(state, 'Runtime Helper')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      scanAgentRoots: vi.fn().mockReturnValue(startupScan.promise)
    } as unknown as NonNullable<typeof window.theOpenHub>;

    const { unmount } = render(<App />);
    await waitFor(() => expect(window.theOpenHub!.scanAgentRoots).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      startupScan.resolve({
        indexedSkills: [
          {
            id: 'skill-runtime',
            name: 'Runtime Helper',
            agentCode: 'codex',
            path: '/tmp/.codex/skills/runtime-helper',
            files: [{ relativePath: 'SKILL.md', size: 120 }]
          }
        ],
        errors: []
      });
    });

    expect(window.theOpenHub!.getWorkspaceState).toHaveBeenCalledTimes(1);
  });

  it('does not refresh workspace after a manual root scan resolves post-unmount', async () => {
    const state = createEmptyWorkspaceState();
    const manualScan = deferred<LibraryScanResult>();
    const scanResult = {
      indexedSkills: [
        {
          id: 'skill-runtime',
          name: 'Runtime Helper',
          agentCode: 'codex',
          path: '/tmp/.codex/skills/runtime-helper',
          files: [{ relativePath: 'SKILL.md', size: 120 }]
        }
      ],
      errors: []
    };
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(workspaceWithSkill(state, 'Runtime Helper')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      scanAgentRoots: vi.fn().mockResolvedValueOnce(scanResult).mockReturnValueOnce(manualScan.promise)
    } as unknown as NonNullable<typeof window.theOpenHub>;

    const { unmount } = render(<App />);
    await waitFor(() => expect(window.theOpenHub!.getWorkspaceState).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Scan roots' }));
    await waitFor(() => expect(window.theOpenHub!.scanAgentRoots).toHaveBeenCalledTimes(2));

    unmount();
    await act(async () => {
      manualScan.resolve(scanResult);
    });

    expect(window.theOpenHub!.getWorkspaceState).toHaveBeenCalledTimes(2);
  });

  it('previews local sources without trust or write-impact language', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([
        {
          id: 'source-local',
          name: 'Local Source',
          sourceType: 'local',
          url: '/tmp/source',
          status: 'configured',
          cachedAt: null,
          verified: false
        }
      ]),
      addDiscoverSource: vi.fn().mockResolvedValue({
        id: 'source-local',
        name: 'Local Source',
        sourceType: 'local',
        url: '/tmp/source',
        status: 'configured',
        cachedAt: null,
        verified: false
      }),
      previewDiscoverSource: vi.fn().mockResolvedValue({
        source: {
          id: 'source-local',
          name: 'Local Source',
          sourceType: 'local',
          url: '/tmp/source',
          status: 'cached',
          cachedAt: '2026-06-07T00:00:00.000Z',
          verified: false
        },
        skills: [
          {
            name: 'Preview Helper',
            description: 'Preview only',
            tags: ['preview'],
            path: 'preview-helper'
          }
        ],
        cachedAt: '2026-06-07T00:00:00.000Z'
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText('Preview Helper')).toBeInTheDocument();
    const skillsPage = screen.getByRole('region', { name: 'Skills workspace' });
    expect(within(skillsPage).queryByText(/trust/i)).not.toBeInTheDocument();
  });

  it('marks marketplace candidates as imported and installed instead of repeating actions', async () => {
    const plan = {
      id: 'plan-market',
      skillId: 'skill-market',
      skillVersionId: 'version-market',
      skillName: 'market-helper',
      skillSlug: 'market-helper',
      targetRoot: '/tmp/.codex/skills',
      targetSkillPath: '/tmp/.codex/skills/market-helper',
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'builtin',
      scope: 'user',
      rootKind: 'user',
      projectionMode: 'copy',
      status: 'ready',
      writes: [
        {
          relativePath: 'SKILL.md',
          targetPath: '/tmp/.codex/skills/market-helper/SKILL.md',
          sourceHash: 'hash-market',
          action: 'copy',
          status: 'clean'
        }
      ]
    } as const;
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([createRoot('/tmp/.codex/skills')]),
      listDiscoverSources: vi.fn().mockResolvedValue([createSource()]),
      previewDiscoverSource: vi.fn().mockResolvedValue({
        source: createSource(),
        skills: [
          {
            name: 'market-helper',
            description: 'Marketplace helper',
            tags: ['market'],
            path: '/tmp/source/market-helper'
          }
        ],
        cachedAt: '2026-06-07T00:00:00.000Z'
      }),
      importLocalFolder: vi.fn().mockResolvedValue({
        skill: {
          id: 'skill-market',
          versionId: 'version-market',
          name: 'market-helper',
          description: 'Marketplace helper',
          versionNo: 1
        },
        files: []
      }),
      createInstallPlan: vi.fn().mockResolvedValue(plan),
      applyInstallPlan: vi.fn().mockResolvedValue({
        status: 'installed',
        installationId: 'installation-market',
        skillId: 'skill-market',
        files: plan.writes
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText('market-helper')).toBeInTheDocument();
    expect(within(marketCandidate()).getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(within(marketCandidate()).getByRole('button', { name: 'Install' })).toBeInTheDocument();

    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Imported market-helper')).toBeInTheDocument();
    expect(within(marketCandidate()).getByText('Imported')).toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(within(marketCandidate()).getByRole('button', { name: 'Install' })).toBeInTheDocument();

    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Install' }));
    expect(await screen.findByText('Installed market-helper')).toBeInTheDocument();
    expect(within(marketCandidate()).getByText('Installed')).toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    expect(window.theOpenHub?.createInstallPlan).toHaveBeenCalledWith(expect.objectContaining({ skillId: 'skill-market' }));
  });

  it('manages marketplace sources from Settings', async () => {
    const source = {
      id: 'source-local',
      name: 'Local Source',
      sourceType: 'local' as const,
      url: '/tmp/source',
      status: 'configured',
      cachedAt: null,
      verified: false
    };
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([source]),
      addDiscoverSource: vi.fn().mockResolvedValue(source),
      removeDiscoverSource: vi.fn().mockResolvedValue({ status: 'removed' })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Local Source')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Marketplace source name'), { target: { value: 'Local Source' } });
    fireEvent.change(screen.getByLabelText('Marketplace source URL'), { target: { value: '/tmp/source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));

    await waitFor(() => expect(window.theOpenHub?.addDiscoverSource).toHaveBeenCalledWith({
      name: 'Local Source',
      sourceType: 'local',
      url: '/tmp/source'
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Local Source' }));
    await waitFor(() => expect(window.theOpenHub?.removeDiscoverSource).toHaveBeenCalledWith('source-local'));
  });

  it('shows retained plugin capabilities only', async () => {
    const state = createEmptyWorkspaceState();
    render(
      <App
        initialState={{
          ...state,
          plugins: {
            directories: [],
            catalog: [],
            plugins: [
              {
                id: 'plugin-1',
                name: 'Runtime Importer',
                version: '1.0.0',
                rootPath: '/tmp/plugin',
                status: 'enabled',
                capabilities: ['importer:runtime-importer'],
                permissions: [{ name: 'import:local', status: 'authorized' }],
                errors: []
              }
            ]
          }
        }}
        initialPluginRegistry={{
          agentAdapters: [],
          importers: [{ pluginId: 'plugin-1', id: 'runtime-importer', name: 'Runtime Importer' }],
          syncDrivers: []
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByText('Runtime Importer')).toBeInTheDocument();
    expect(screen.getByText('Importers')).toBeInTheDocument();
    expect(screen.queryByText('Security rules')).not.toBeInTheDocument();
    expect(screen.queryByText('Exporters')).not.toBeInTheDocument();
  });
});

function workspaceWithSkill(state: DesktopWorkspaceState, name: string): DesktopWorkspaceState {
  return {
    ...state,
    librarySkills: [
      {
        id: `skill-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        sourceAgent: 'Codex',
        agentCode: 'codex',
        path: `/tmp/.codex/skills/${name.toLowerCase().replace(/\s+/g, '-')}`,
        visibilityStatus: 'indexed',
        rootPath: '/tmp/.codex/skills',
        scope: 'user',
        rootKind: 'user',
        writable: true,
        ownership: 'indexed'
      }
    ],
    skills: [
      {
        id: `skill-${name.toLowerCase().replace(/\s+/g, '-')}`,
        versionId: `version-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        description: `${name} description`,
        versionNo: 1
      }
    ]
  };
}

function createRoot(rootPath: string) {
  return {
    agentCode: 'codex' as const,
    agentDisplayName: 'Codex',
    adapterVersion: '1.0.0',
    rootPath,
    scope: 'user',
    rootKind: 'user' as const,
    writable: true
  };
}

function createSource() {
  return {
    id: 'source-local',
    name: 'Local Source',
    sourceType: 'local' as const,
    url: '/tmp/source',
    status: 'configured',
    cachedAt: null,
    verified: false
  };
}

function marketCandidate(): HTMLElement {
  const candidate = screen.getByText('market-helper').closest('article');
  if (!candidate) {
    throw new Error('Missing market-helper candidate');
  }
  return candidate;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
