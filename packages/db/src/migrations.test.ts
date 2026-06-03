import { describe, expect, it } from 'vitest';

import { createMemoryDatabase, getCurrentSchemaVersion, runMigrations } from './migrations';

describe('SQLite migrations', () => {
  it('runs from an empty database to latest and is idempotent', () => {
    const db = createMemoryDatabase();

    const firstRun = runMigrations(db);
    const secondRun = runMigrations(db);

    expect(firstRun.applied).toEqual([
      '001_domain_schema',
      '002_skill_search_fts',
      '003_installation_files'
    ]);
    expect(secondRun.applied).toEqual([]);
    expect(getCurrentSchemaVersion(db)).toBe(3);
  });

  it('creates the required Phase 2 domain tables and FTS table', () => {
    const db = createMemoryDatabase();
    runMigrations(db);

    const tableNames = db
      .prepare(
        "select name from sqlite_master where type in ('table', 'virtual table') order by name"
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        'agents',
        'agent_roots',
        'blob_objects',
        'collections',
        'collection_items',
        'installations',
        'installation_files',
        'security_findings',
        'security_scans',
        'skill_files',
        'skill_search',
        'skill_versions',
        'skills',
        'sources'
      ])
    );
  });
});
