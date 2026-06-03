/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('desktop app shell', () => {
  it('shows the product name and Phase 1 empty state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TheOpenHub Skills Studio' })).toBeInTheDocument();
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
});
