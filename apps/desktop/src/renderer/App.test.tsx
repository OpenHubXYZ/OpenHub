/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings, DesktopWorkspaceState, InstallPlan, LibraryScanResult } from '@theopenhub/shared';

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
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Local-first workspace')).toBeInTheDocument();
    expect(screen.queryByText('Phase 10')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inventory' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sources' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deploy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trust' })).not.toBeInTheDocument();
    expect(screen.queryByText(/security center/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/install plan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ratings|reputation|risk score/i)).not.toBeInTheDocument();
  });

  it('keeps home action buttons accessible by their primary labels', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Set local roots' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build skills index' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review marketplace' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review marketplace' }));

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Marketplace' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the first populated agent tab when entering Skills from Home', () => {
    render(
      <App
        initialState={workspaceWithAgentSkill(createEmptyWorkspaceState(), {
          agentCode: 'claude',
          agentDisplayName: 'Claude',
          name: 'Claude Helper',
          rootPath: '/tmp/claude-project-skills'
        })}
        initialAgentRoots={[
          createAgentRoot({
            agentCode: 'claude',
            agentDisplayName: 'Claude',
            rootPath: '/tmp/claude-project-skills'
          })
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Build skills index' }));

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Claude' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Claude Helper')).toBeInTheDocument();
    expect(screen.queryByText('Codex skills')).not.toBeInTheDocument();
  });

  it('counts home root locations by unique indexed root paths', () => {
    render(<App initialState={workspaceWithSkills(createEmptyWorkspaceState())} initialAgentRoots={[createRoot('/tmp/.codex/skills')]} />);

    const rootMetric = screen.getByText('Root locations').closest('article');
    expect(rootMetric).not.toBeNull();
    expect(within(rootMetric!).getByText('1')).toBeInTheDocument();
    expect(within(rootMetric!).queryByText('2')).not.toBeInTheDocument();

    const localRootsMetric = screen.getByText('Local roots').closest('article');
    expect(localRootsMetric).not.toBeNull();
    expect(within(localRootsMetric!).getByText('Detected roots')).toBeInTheDocument();
  });

  it('filters indexed skills by path as well as name', () => {
    render(<App initialState={workspaceWithSkills(createEmptyWorkspaceState())} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(screen.getByText('Prompt Writer')).toBeInTheDocument();
    expect(screen.getByText('Palette Helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'visual-assets' } });

    expect(screen.getByText('Palette Helper')).toBeInTheDocument();
    expect(screen.queryByText('Prompt Writer')).not.toBeInTheDocument();
  });

  it('opens matching skills when searching from Home', () => {
    render(
      <App
        initialState={workspaceWithAgentSkill(createEmptyWorkspaceState(), {
          agentCode: 'claude',
          agentDisplayName: 'Claude',
          name: 'Claude Helper',
          rootPath: '/tmp/claude-project-skills'
        })}
      />
    );

    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'Claude' } });

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Claude' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Claude Helper')).toBeInTheDocument();
  });

  it('shows a search-specific empty state when indexed skills do not match', () => {
    render(<App initialState={workspaceWithSkills(createEmptyWorkspaceState())} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'no-match' } });

    expect(screen.getByText('No skills match "no-match"')).toBeInTheDocument();
    expect(screen.queryByText('No indexed skills')).not.toBeInTheDocument();
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
    expect(await screen.findByText('1 indexed, 2 errors: parse_error at /tmp/a - Bad skill A')).toHaveClass('status-error');
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

  it('clears stale marketplace candidates when preview fails', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([createSource()]),
      previewDiscoverSource: vi
        .fn()
        .mockRejectedValue(new Error("Error invoking remote method 'discover.previewSource': Error: Preview failed"))
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(
      <App
        initialPreviewSkills={[
          {
            name: 'market-helper',
            description: 'Marketplace helper',
            tags: ['market'],
            path: '/tmp/source/market-helper'
          }
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');
    expect(screen.getByText('market-helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText('Preview failed')).toHaveClass('status-error');
    expect(screen.queryByText(/Error invoking remote method/)).not.toBeInTheDocument();
    expect(screen.queryByText('market-helper')).not.toBeInTheDocument();
    expect(screen.getByText('No sources previewed')).toBeInTheDocument();
  });

  it('summarizes command failures from marketplace preview', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([createSource()]),
      previewDiscoverSource: vi.fn().mockRejectedValue(new Error(
        [
          'Command failed: git clone --depth 1 file:///tmp/source /tmp/cache',
          "Cloning into '/tmp/cache'...",
          "fatal: '/tmp/source' does not appear to be a git repository",
          'fatal: Could not read from remote repository.',
          '',
          'Please make sure you have the correct access rights',
          'and the repository exists.'
        ].join('\n')
      ))
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText("Command failed: '/tmp/source' does not appear to be a git repository")).toHaveClass('status-error');
    expect(screen.queryByText(/git clone --depth/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Please make sure/)).not.toBeInTheDocument();
  });

  it('filters marketplace preview candidates by description, tags, and path', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([createSource()])
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(
      <App
        initialPreviewSkills={[
          {
            name: 'market-helper',
            description: 'Marketplace helper',
            tags: ['market'],
            path: '/tmp/source/market-helper'
          },
          {
            name: 'palette-helper',
            description: 'Visual asset palette',
            tags: ['visual', 'asset'],
            path: '/tmp/source/visual-assets/palette-helper'
          }
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));

    await screen.findByText('Local Source');
    expect(screen.getByText('market-helper')).toBeInTheDocument();
    expect(screen.getByText('palette-helper')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'visual' } });

    expect(screen.getByText('palette-helper')).toBeInTheDocument();
    expect(screen.queryByText('market-helper')).not.toBeInTheDocument();
  });

  it('renders marketplace candidates as preview cards without rating or reputation copy', async () => {
    render(
      <App
        initialAgentRoots={[createRoot('/tmp/.codex/skills')]}
        initialPreviewSkills={[
          {
            name: 'Preview Helper',
            description: 'Preview only',
            tags: ['automation', 'codex'],
            path: '/tmp/source/preview-helper'
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));

    const candidate = screen.getByRole('article', { name: 'Preview Helper' });
    expect(within(candidate).getByText('automation')).toBeInTheDocument();
    expect(within(candidate).getByText('codex')).toBeInTheDocument();
    expect(within(candidate).getByText('/tmp/source/preview-helper')).toBeInTheDocument();
    expect(within(candidate).queryByText(/rating|reviews|installs|reputation|trending/i)).not.toBeInTheDocument();
  });

  it('shows a marketplace search empty state when preview candidates do not match', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([createSource()])
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(
      <App
        initialPreviewSkills={[
          {
            name: 'market-helper',
            description: 'Marketplace helper',
            tags: ['market'],
            path: '/tmp/source/market-helper'
          }
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');

    fireEvent.change(screen.getByLabelText('Search skills'), { target: { value: 'no-candidate' } });

    expect(screen.getByText('No candidates match "no-candidate"')).toBeInTheDocument();
    expect(screen.queryByText('No sources previewed')).not.toBeInTheDocument();
    expect(screen.queryByText('market-helper')).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Install target root'), { target: { value: '/tmp/.codex/skills' } });
    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Install' }));
    expect(await screen.findByText('Installed market-helper')).toBeInTheDocument();
    expect(within(marketCandidate()).getByText('Installed')).toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    expect(window.theOpenHub?.createInstallPlan).toHaveBeenCalledWith(expect.objectContaining({ skillId: 'skill-market' }));
  });

  it('keeps installed marketplace candidates marked after workspace state reloads', () => {
    render(
      <App
        initialState={workspaceWithInstalledSkill(createEmptyWorkspaceState(), 'market-helper')}
        initialAgentRoots={[createRoot('/tmp/.codex/skills')]}
        initialPreviewSkills={[
          {
            name: 'market-helper',
            description: 'Marketplace helper',
            tags: ['market'],
            path: '/tmp/source/market-helper'
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));

    expect(within(marketCandidate()).getByText('Installed')).toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(within(marketCandidate()).queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  it('does not mark different marketplace candidates installed just because their names match', () => {
    render(
      <App
        initialState={workspaceWithInstalledSkill(createEmptyWorkspaceState(), 'market-helper')}
        initialAgentRoots={[createRoot('/tmp/.codex/skills')]}
        initialPreviewSkills={[
          {
            name: 'market-helper',
            description: 'Different marketplace helper',
            tags: ['market'],
            path: '/tmp/other-source/market-helper'
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));

    expect(within(marketCandidate()).queryByText('Installed')).not.toBeInTheDocument();
    expect(within(marketCandidate()).getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(within(marketCandidate()).getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('shows singular overwrite confirmation before applying a conflicting marketplace install', async () => {
    const plan = createMarketInstallPlan('conflict');
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
    fireEvent.change(screen.getByLabelText('Install target root'), { target: { value: '/tmp/.codex/skills' } });
    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Install' }));

    expect(await screen.findByText('1 conflict')).toBeInTheDocument();
    expect(screen.queryByText('1 conflicts')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm overwrite' }));

    await waitFor(() => expect(window.theOpenHub?.applyInstallPlan).toHaveBeenCalledWith(plan, true));
    expect(await screen.findByText('Installed market-helper')).toBeInTheDocument();
  });

  it('reports marketplace import failures during install without continuing the install plan', async () => {
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
      importLocalFolder: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: skills.slug')),
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn()
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText('market-helper')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Install target root'), { target: { value: '/tmp/.codex/skills' } });
    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Install' }));

    expect(await screen.findByText('UNIQUE constraint failed: skills.slug')).toHaveClass('status-error');
    expect(window.theOpenHub?.createInstallPlan).not.toHaveBeenCalled();
    expect(window.theOpenHub?.applyInstallPlan).not.toHaveBeenCalled();
  });

  it('requires an explicit marketplace install target before importing candidates', async () => {
    const plan = createMarketInstallPlan('clean');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([createRoot('/tmp/.codex/skills')]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
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

    render(
      <App
        initialAgentRoots={[createRoot('/tmp/.codex/skills')]}
        initialPreviewSkills={[
          {
            name: 'market-helper',
            description: 'Marketplace helper',
            tags: ['market'],
            path: '/tmp/source/market-helper'
          }
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));

    expect(screen.getByLabelText('Install target root')).toHaveValue('');
    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Install' }));

    expect(await screen.findByText('Select an install target root first')).toHaveClass('status-error');
    expect(window.theOpenHub?.importLocalFolder).not.toHaveBeenCalled();
    expect(window.theOpenHub?.createInstallPlan).not.toHaveBeenCalled();
    expect(window.theOpenHub?.applyInstallPlan).not.toHaveBeenCalled();
  });

  it('keeps read-only roots out of marketplace install targets', async () => {
    const readOnlyRoot = createReadOnlyRoot('/tmp/.codex/skills');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([readOnlyRoot]),
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
      createInstallPlan: vi.fn(),
      applyInstallPlan: vi.fn()
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Marketplace' }));
    await screen.findByText('Local Source');
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText('market-helper')).toBeInTheDocument();
    const targetRootSelect = screen.getByLabelText('Install target root');
    expect(within(targetRootSelect).queryByRole('option', { name: `Codex - ${readOnlyRoot.rootPath}` })).not.toBeInTheDocument();
    expect(screen.getByText('No writable install roots')).toBeInTheDocument();

    fireEvent.click(within(marketCandidate()).getByRole('button', { name: 'Install' }));

    expect(await screen.findByText('Select a writable root first')).toHaveClass('status-error');
    expect(window.theOpenHub?.importLocalFolder).not.toHaveBeenCalled();
    expect(window.theOpenHub?.createInstallPlan).not.toHaveBeenCalled();
    expect(window.theOpenHub?.applyInstallPlan).not.toHaveBeenCalled();
  });

  it('reports refresh failures without clearing the loaded workspace', async () => {
    const state = workspaceWithSkill(createEmptyWorkspaceState(), 'Cached Helper');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValueOnce(state).mockRejectedValueOnce(new Error('Refresh failed')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([])
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(await screen.findByText('Cached Helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText('Refresh failed')).toHaveClass('status-error');
    expect(screen.getByText('Cached Helper')).toBeInTheDocument();
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

  it('normalizes file URL marketplace sources as local paths', async () => {
    const source = {
      id: 'source-local',
      name: 'Local Source',
      sourceType: 'local' as const,
      url: '/tmp/source dir',
      status: 'configured',
      cachedAt: null,
      verified: false
    };
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      addDiscoverSource: vi.fn().mockResolvedValue(source)
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Marketplace source URL'), { target: { value: 'file:///tmp/source%20dir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));

    await waitFor(() => expect(window.theOpenHub?.addDiscoverSource).toHaveBeenCalledWith({
      name: 'Local Source',
      sourceType: 'local',
      url: '/tmp/source dir'
    }));
  });

  it('removes project roots from Settings without offering removal for detected roots', async () => {
    const detectedRoot = createRoot('/tmp/.codex/skills');
    const projectRoot = createProjectRoot('/tmp/project-skills');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([detectedRoot, projectRoot]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      removeProjectRoot: vi.fn().mockResolvedValue({ status: 'removed' })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App initialAgentRoots={[detectedRoot, projectRoot]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('/tmp/.codex/skills')).toBeInTheDocument();
    expect(screen.getByText('/tmp/project-skills')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove /tmp/.codex/skills' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove /tmp/project-skills' }));

    await waitFor(() => expect(window.theOpenHub?.removeProjectRoot).toHaveBeenCalledWith({
      agentCode: 'codex',
      rootPath: '/tmp/project-skills'
    }));
    expect(await screen.findByText('Root removed')).toBeInTheDocument();
    expect(screen.queryByText('/tmp/project-skills')).not.toBeInTheDocument();
    expect(screen.getByText('/tmp/.codex/skills')).toBeInTheDocument();
  });

  it('reports settings source and root failures without mutating visible lists', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      addProjectRoot: vi.fn().mockRejectedValue(new Error('Root failed')),
      addDiscoverSource: vi.fn().mockRejectedValue(new Error('Source failed'))
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('No local roots')).toBeInTheDocument();
    expect(screen.getByText('No marketplace sources')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Root path'), { target: { value: '/tmp/project-skills' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add root' }));
    expect(await screen.findByText('Root failed')).toHaveClass('status-error');
    expect(screen.getByText('No local roots')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Marketplace source URL'), { target: { value: '/tmp/source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(await screen.findByText('Source failed')).toHaveClass('status-error');
    expect(screen.getByText('No marketplace sources')).toBeInTheDocument();
  });

  it('reports missing Settings paths before invoking add actions', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      addProjectRoot: vi.fn(),
      addDiscoverSource: vi.fn()
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('No local roots')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add root' }));
    expect(await screen.findByText('Enter a root path first')).toHaveClass('status-error');
    expect(window.theOpenHub?.addProjectRoot).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(await screen.findByText('Enter a marketplace source URL first')).toHaveClass('status-error');
    expect(window.theOpenHub?.addDiscoverSource).not.toHaveBeenCalled();
  });

  it('reports uninstall failures without hiding app-owned skills', async () => {
    const state = workspaceWithInstalledSkill(createEmptyWorkspaceState(), 'market-helper');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(state),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      uninstallSkill: vi.fn().mockRejectedValue(new Error('Uninstall failed'))
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App initialState={state} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(await screen.findByText('market-helper')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Uninstall' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Uninstall market-helper' }));

    expect(await screen.findByText('Uninstall failed')).toHaveClass('status-error');
    expect(screen.getByText('market-helper')).toBeInTheDocument();
    expect(window.theOpenHub.uninstallSkill).toHaveBeenCalledWith('installation-market-helper');
  });

  it('removes app-owned skills after successful uninstall even when refresh fails', async () => {
    const state = workspaceWithInstalledSkill(createEmptyWorkspaceState(), 'market-helper');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValueOnce(state).mockRejectedValueOnce(new Error('Refresh failed')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      uninstallSkill: vi.fn().mockResolvedValue({ status: 'uninstalled', installationId: 'installation-market-helper' })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App initialState={state} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(await screen.findByText('market-helper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Uninstall market-helper' }));

    expect(await screen.findByText('Uninstalled; Refresh failed')).toHaveClass('status-error');
    expect(screen.queryByText('market-helper')).not.toBeInTheDocument();
    expect(screen.getByText('No indexed skills')).toBeInTheDocument();
    expect(window.theOpenHub.uninstallSkill).toHaveBeenCalledWith('installation-market-helper');
  });

  it('clears selected app-owned skill details after successful uninstall even when refresh fails', async () => {
    const state = workspaceWithInstalledSkill(createEmptyWorkspaceState(), 'market-helper');
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValueOnce(state).mockRejectedValueOnce(new Error('Refresh failed')),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      uninstallSkill: vi.fn().mockResolvedValue({ status: 'uninstalled', installationId: 'installation-market-helper' }),
      getSkillDetail: vi.fn().mockResolvedValue({
        skill: {
          id: 'skill-market-helper',
          versionId: 'version-market-helper',
          slug: 'market-helper',
          name: 'market-helper',
          description: 'Installed helper',
          tags: [],
          versionNo: 1,
          favorite: false
        },
        source: { type: 'local', url: '/tmp/source/market-helper' },
        versions: [],
        files: [{ relativePath: 'SKILL.md', hash: 'hash-market-helper', size: 120, kind: 'markdown' }],
        skillMarkdown: '# market-helper'
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App initialState={state} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open market-helper details' }));
    expect(await screen.findByRole('heading', { name: 'market-helper' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Uninstall market-helper' }));

    expect(await screen.findByText('Uninstalled; Refresh failed')).toHaveClass('status-error');
    expect(screen.queryByRole('heading', { name: 'market-helper' })).not.toBeInTheDocument();
    expect(screen.queryByText('# market-helper')).not.toBeInTheDocument();
    expect(screen.getByText('Select a skill to inspect files and versions.')).toBeInTheDocument();
  });

  it('opens a live skill detail view from an indexed skill row', async () => {
    const state = workspaceWithAgentSkill(createEmptyWorkspaceState(), {
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      name: 'PDF Parser',
      rootPath: '/tmp/.codex/skills'
    });
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(state),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      getSkillDetail: vi.fn().mockResolvedValue({
        skill: {
          id: 'skill-pdf',
          versionId: 'version-pdf',
          slug: 'pdf-parser',
          name: 'PDF Parser',
          description: 'Parse PDFs',
          tags: ['documents'],
          versionNo: 2,
          favorite: false
        },
        source: { type: 'local', url: '/tmp/pdf-parser' },
        versions: [
          {
            versionId: 'version-pdf',
            skillId: 'skill-pdf',
            versionNo: 2,
            changeSummary: 'Import',
            createdAt: '2026-06-07'
          }
        ],
        files: [{ relativePath: 'SKILL.md', hash: 'hash-pdf', size: 120, kind: 'markdown' }],
        skillMarkdown: '# PDF Parser'
      })
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App initialState={state} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open PDF Parser details' }));

    expect(await screen.findByRole('heading', { name: 'PDF Parser' })).toBeInTheDocument();
    expect(screen.getByText('SKILL.md')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run test task/i })).not.toBeInTheDocument();
  });

  it('toggles a skill favorite through typed preload IPC', async () => {
    const state = workspaceWithSkills(createEmptyWorkspaceState());
    const setFavorite = vi.fn().mockResolvedValue({
      id: 'skill-prompt-writer',
      versionId: 'version-prompt-writer',
      name: 'Prompt Writer',
      description: 'Writes prompts',
      versionNo: 1,
      favorite: true
    });
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(state),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      setFavorite
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App initialState={state} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Prompt Writer' }));

    await waitFor(() => expect(setFavorite).toHaveBeenCalledWith('skill-prompt-writer', true));
    expect(await screen.findByText('Favorited Prompt Writer')).toBeInTheDocument();
  });

  it('filters indexed skills to favorites only from local state', () => {
    const state = workspaceWithSkills(createEmptyWorkspaceState());
    state.librarySkills = state.librarySkills.map((skill) =>
      skill.id === 'skill-prompt-writer' ? { ...skill, favorite: true } : skill
    );
    render(<App initialState={state} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Favorites only' }));

    expect(screen.getByText('Prompt Writer')).toBeInTheDocument();
    expect(screen.queryByText('Palette Helper')).not.toBeInTheDocument();
  });

  it('renders Settings without telemetry sharing or API key prompts', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('heading', { name: 'Local roots' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marketplace sources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/share usage analytics|telemetry|crash reports/i)).not.toBeInTheDocument();
  });

  it('wires Settings app preferences to existing local settings IPC', async () => {
    const settings = createAppSettings({ updateChecksEnabled: true, logLevel: 'info' });
    const updatedChecks = createAppSettings({ updateChecksEnabled: false, logLevel: 'info' });
    const updatedLogLevel = createAppSettings({ updateChecksEnabled: false, logLevel: 'warn' });
    const setUpdateChecks = vi.fn().mockResolvedValue(updatedChecks);
    const setLogLevel = vi.fn().mockResolvedValue(updatedLogLevel);
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
      listDiscoverSources: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(settings),
      setUpdateChecks,
      setLogLevel
    } as unknown as NonNullable<typeof window.theOpenHub>;

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'App preferences' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Check for updates' })).toBeChecked();
    expect(screen.getByLabelText('Log level')).toHaveValue('info');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Check for updates' }));
    await waitFor(() => expect(setUpdateChecks).toHaveBeenCalledWith(false));
    expect(await screen.findByText('Settings updated')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Log level'), { target: { value: 'warn' } });
    await waitFor(() => expect(setLogLevel).toHaveBeenCalledWith('warn'));
    expect(screen.getByLabelText('Log level')).toHaveValue('warn');
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

function createAppSettings(input: Partial<AppSettings> = {}): AppSettings {
  return {
    mirrorSources: [],
    updateChecksEnabled: false,
    logLevel: 'info',
    pluginDirectories: [],
    ...input
  };
}

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

function workspaceWithSkills(state: DesktopWorkspaceState): DesktopWorkspaceState {
  return {
    ...state,
    librarySkills: [
      {
        id: 'skill-prompt-writer',
        name: 'Prompt Writer',
        sourceAgent: 'Codex',
        agentCode: 'codex',
        path: '/tmp/.codex/skills/prompt-writer',
        visibilityStatus: 'indexed',
        rootPath: '/tmp/.codex/skills',
        scope: 'user',
        rootKind: 'user',
        writable: true,
        ownership: 'indexed'
      },
      {
        id: 'skill-palette-helper',
        name: 'Palette Helper',
        sourceAgent: 'Codex',
        agentCode: 'codex',
        path: '/tmp/.codex/skills/visual-assets/palette-helper',
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
        id: 'skill-prompt-writer',
        versionId: 'version-prompt-writer',
        name: 'Prompt Writer',
        description: 'Prompt Writer description',
        versionNo: 1
      },
      {
        id: 'skill-palette-helper',
        versionId: 'version-palette-helper',
        name: 'Palette Helper',
        description: 'Palette Helper description',
        versionNo: 1
      }
    ]
  };
}

function workspaceWithAgentSkill(
  state: DesktopWorkspaceState,
  input: { agentCode: string; agentDisplayName: string; name: string; rootPath: string }
): DesktopWorkspaceState {
  const slug = input.name.toLowerCase().replace(/\s+/g, '-');
  return {
    ...state,
    librarySkills: [
      {
        id: `skill-${slug}`,
        name: input.name,
        sourceAgent: input.agentDisplayName,
        agentCode: input.agentCode,
        path: `${input.rootPath}/${slug}`,
        visibilityStatus: 'indexed',
        rootPath: input.rootPath,
        scope: 'project',
        rootKind: 'project',
        writable: true,
        ownership: 'indexed'
      }
    ],
    skills: [
      {
        id: `skill-${slug}`,
        versionId: `version-${slug}`,
        name: input.name,
        description: `${input.name} description`,
        versionNo: 1
      }
    ]
  };
}

function workspaceWithInstalledSkill(
  state: DesktopWorkspaceState,
  name: string,
  input: { sourceUrl?: string } = {}
): DesktopWorkspaceState {
  const id = `skill-${name}`;
  return {
    ...state,
    librarySkills: [
      {
        id,
        name,
        sourceAgent: 'Codex',
        agentCode: 'codex',
        path: `/tmp/.codex/skills/${name}`,
        visibilityStatus: 'installed',
        rootPath: '/tmp/.codex/skills',
        scope: 'user',
        rootKind: 'user',
        writable: true,
        installationId: `installation-${name}`,
        sourceUrl: input.sourceUrl ?? `/tmp/source/${name}`,
        ownership: 'app-owned'
      }
    ],
    skills: [
      {
        id,
        versionId: `version-${name}`,
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
    writable: true,
    isDefault: true
  };
}

function createProjectRoot(rootPath: string) {
  return {
    ...createRoot(rootPath),
    scope: 'project',
    rootKind: 'project' as const,
    isDefault: false
  };
}

function createReadOnlyRoot(rootPath: string) {
  return {
    ...createRoot(rootPath),
    writable: false
  };
}

function createAgentRoot(input: { agentCode: 'codex' | 'claude' | 'gemini' | 'opencode' | 'agents'; agentDisplayName: string; rootPath: string }) {
  return {
    ...createRoot(input.rootPath),
    agentCode: input.agentCode,
    agentDisplayName: input.agentDisplayName,
    scope: 'project',
    rootKind: 'project' as const,
    isDefault: false
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

function createMarketInstallPlan(writeStatus: InstallPlan['writes'][number]['status']): InstallPlan {
  return {
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
    status: writeStatus === 'clean' ? 'ready' : writeStatus,
    writes: [
      {
        relativePath: 'SKILL.md',
        targetPath: '/tmp/.codex/skills/market-helper/SKILL.md',
        sourceHash: 'hash-market',
        action: 'copy',
        status: writeStatus
      }
    ]
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
