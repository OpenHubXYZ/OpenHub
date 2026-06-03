/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('desktop app shell', () => {
  it('shows the product name and Phase 4 empty state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TheOpenHub Skills Studio' })).toBeInTheDocument();
    expect(screen.getByText('Phase 4 P0 import and install loop')).toBeInTheDocument();
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
});
