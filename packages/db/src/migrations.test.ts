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
      '003_sync_state',
      '004_plugin_runtime',
      '005_discover_sources',
      '006_inventory_productization',
      '007_app_settings',
      '008_local_similarity_index',
      '009_plugin_directories',
      '010_skill_installations'
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
        'indexed_skill_locations',
        'installation_files',
        'installations',
        'plugin_errors',
        'plugin_catalog_entries',
        'plugin_directories',
        'plugin_manifests',
        'plugin_permission_grants',
        'skill_favorites',
        'skill_files',
        'skill_similarity_index',
        'skill_search',
        'skill_versions',
        'skills',
        'sources',
        'sync_conflicts',
        'sync_events',
        'sync_inbox',
        'sync_outbox',
        'sync_profiles'
      ])
    );
    expect(tableNames).not.toEqual(
      expect.arrayContaining([
        'security_scans',
        'security_findings',
        'security_exemptions',
        'review_items',
        'review_notes',
        'policy_packs',
        'team_baselines',
        'usage_events'
      ])
    );
  });

});
