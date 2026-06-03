import type { ReactElement } from 'react';

import './app.css';

const principles = [
  'SQLite source of truth',
  'Agent directories as projections',
  'Offline by default'
] as const;

const plannedSurfaces = ['Library', 'Import', 'Install Plan', 'Security Center', 'Settings'] as const;

export function App(): ReactElement {
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
            <p className="phase-label">Phase 1 workspace baseline</p>
            <h1 id="app-title">TheOpenHub Skills Studio</h1>
          </div>
          <span className="status-chip">Local-first</span>
        </header>

        <section className="empty-state" aria-label="Library empty state">
          <div className="empty-icon" aria-hidden="true">
            <span />
          </div>
          <div className="empty-copy">
            <h2>No skills indexed yet</h2>
            <p>
              The desktop shell is ready for the next phase: SQLite migrations, local
              library indexing, and typed agent adapters.
            </p>
          </div>
        </section>

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
