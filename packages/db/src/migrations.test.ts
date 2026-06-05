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
      '003_installation_files',
      '004_security_exemptions',
      '005_sync_state',
      '006_plugin_runtime',
      '007_review_usage_events',
      '008_discover_sources',
      '009_research_gap_closure',
      '010_app_settings'
    ]);
    expect(secondRun.applied).toEqual([]);
    expect(getCurrentSchemaVersion(db)).toBe(10);
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
        'app_settings',
        'blob_objects',
        'collections',
        'collection_items',
        'discover_source_cache',
        'discover_sources',
        'installations',
        'installation_files',
        'plugin_errors',
        'plugin_manifests',
        'plugin_permission_grants',
        'policy_packs',
        'review_items',
        'review_notes',
        'security_findings',
        'security_exemptions',
        'security_scans',
        'skill_favorites',
        'skill_files',
        'skill_search',
        'skill_versions',
        'skills',
        'sources',
        'team_baselines',
        'sync_conflicts',
        'sync_events',
        'sync_inbox',
        'sync_outbox',
        'sync_profiles',
        'usage_events'
      ])
    );
  });
});
