/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { createEmptyWorkspaceState } from './workspace-view-model';

describe('desktop app shell', () => {
  afterEach(() => {
    cleanup();
    delete window.theOpenHub;
  });

  it('renders the inventory workbench without Deploy or Trust navigation', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: 'Primary pages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sources' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deploy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trust' })).not.toBeInTheDocument();
    expect(screen.queryByText(/security center/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/install plan/i)).not.toBeInTheDocument();
  });

  it('loads runtime state and scans local roots from the command bar', async () => {
    const state = createEmptyWorkspaceState();
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue({
        ...state,
        librarySkills: [
          {
            id: 'skill-runtime',
            name: 'Runtime Helper',
            sourceAgent: 'Codex',
            path: '/tmp/.codex/skills/runtime-helper',
            visibilityStatus: 'indexed'
          }
        ],
        skills: [
          {
            id: 'skill-runtime',
            versionId: 'version-runtime',
            name: 'Runtime Helper',
            description: 'Runtime helper',
            versionNo: 1
          }
        ]
      }),
      listAgentRoots: vi.fn().mockResolvedValue([]),
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

    await waitFor(() => expect(window.theOpenHub?.getWorkspaceState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
    expect(await screen.findByText('Runtime Helper')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Scan roots' }));

    await waitFor(() => expect(window.theOpenHub?.scanAgentRoots).toHaveBeenCalled());
    expect(screen.getByText('indexed')).toBeInTheDocument();
  });

  it('previews local sources without trust or write-impact language', async () => {
    window.theOpenHub = {
      getWorkspaceState: vi.fn().mockResolvedValue(createEmptyWorkspaceState()),
      listAgentRoots: vi.fn().mockResolvedValue([]),
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
    fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
    fireEvent.change(screen.getByLabelText('Source name'), { target: { value: 'Local Source' } });
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: '/tmp/source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview source' }));

    expect(await screen.findByText('Preview Helper')).toBeInTheDocument();
    const sourcesPage = screen.getByRole('region', { name: 'Sources workspace' });
    expect(within(sourcesPage).queryByText(/trust/i)).not.toBeInTheDocument();
    expect(within(sourcesPage).queryByText(/writes/i)).not.toBeInTheDocument();
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
