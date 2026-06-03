/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('desktop app shell', () => {
  it('shows the product name and Phase 5 empty state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TheOpenHub Skills Studio' })).toBeInTheDocument();
    expect(screen.getByText('Phase 5 security governance')).toBeInTheDocument();
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
});
