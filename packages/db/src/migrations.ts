import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;

interface Migration {
  version: number;
  name: string;
  up(database: SqliteDatabase): void;
}

export interface MigrationResult {
  applied: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    name: '001_domain_schema',
    up(database) {
      database.exec(`
        create table sources (
          id text primary key,
          source_type text not null,
          url text,
          repo_owner text,
          repo_name text,
          default_branch text,
          trust_level text not null,
          created_at text not null default current_timestamp
        );

        create table skills (
          id text primary key,
          slug text not null unique,
          name text not null,
          description text not null,
          status text not null default 'active',
          tags_json text not null default '[]',
          canonical_source_id text references sources(id) on delete set null,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table skill_versions (
          id text primary key,
          skill_id text not null references skills(id) on delete cascade,
          version_no integer not null,
          change_summary text,
          source_commit text,
          source_ref text,
          manifest_hash text not null,
          created_at text not null default current_timestamp,
          released integer not null default 1,
          unique(skill_id, version_no)
        );

        create table blob_objects (
          hash text primary key,
          storage_path text not null,
          size integer not null,
          compression text not null default 'none',
          content_type text not null,
          created_at text not null default current_timestamp
        );

        create table skill_files (
          id text primary key,
          skill_version_id text not null references skill_versions(id) on delete cascade,
          relative_path text not null,
          blob_hash text not null references blob_objects(hash),
          file_kind text not null,
          file_size integer not null,
          content_type text not null,
          unique(skill_version_id, relative_path)
        );

        create table agents (
          id text primary key,
          code text not null unique,
          display_name text not null,
          adapter_version text not null,
          detected integer not null default 0,
          os_scope text not null,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table agent_roots (
          id text primary key,
          agent_id text not null references agents(id) on delete cascade,
          root_path text not null,
          scope text not null,
          writable integer not null default 0,
          is_default integer not null default 0,
          created_at text not null default current_timestamp,
          unique(agent_id, root_path, scope)
        );

        create table installations (
          id text primary key,
          skill_id text not null references skills(id) on delete cascade,
          agent_root_id text not null references agent_roots(id) on delete cascade,
          installed_version_id text not null references skill_versions(id),
          install_scope text not null,
          install_path text not null,
          status text not null,
          installed_at text not null default current_timestamp,
          last_verified_at text
        );

        create table collections (
          id text primary key,
          name text not null,
          description text not null default '',
          pinned integer not null default 0,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table collection_items (
          collection_id text not null references collections(id) on delete cascade,
          skill_id text not null references skills(id) on delete cascade,
          created_at text not null default current_timestamp,
          primary key(collection_id, skill_id)
        );

        create table security_scans (
          id text primary key,
          skill_version_id text not null references skill_versions(id) on delete cascade,
          score integer not null,
          level text not null,
          blocked integer not null default 0,
          ruleset_version text not null,
          scanned_at text not null default current_timestamp
        );

        create table security_findings (
          id text primary key,
          scan_id text not null references security_scans(id) on delete cascade,
          rule_id text not null,
          severity text not null,
          category text not null,
          relative_path text not null,
          line_no integer,
          excerpt text not null
        );

        create index idx_skill_versions_skill on skill_versions(skill_id, version_no desc);
        create index idx_skill_files_version on skill_files(skill_version_id);
        create index idx_installations_skill on installations(skill_id);
        create index idx_security_scans_version on security_scans(skill_version_id);
      `);
    }
  },
  {
    version: 2,
    name: '002_skill_search_fts',
    up(database) {
      database.exec(`
        create virtual table skill_search using fts5(
          skill_id unindexed,
          name,
          description,
          tags,
          file_paths,
          file_content
        );
      `);
    }
  },
  {
    version: 3,
    name: '003_installation_files',
    up(database) {
      database.exec(`
        create table installation_files (
          id text primary key,
          installation_id text not null references installations(id) on delete cascade,
          relative_path text not null,
          target_path text not null,
          blob_hash text not null references blob_objects(hash),
          created_at text not null default current_timestamp,
          unique(installation_id, relative_path)
        );

        create index idx_installation_files_installation on installation_files(installation_id);
      `);
    }
  },
  {
    version: 4,
    name: '004_security_exemptions',
    up(database) {
      database.exec(`
        create unique index idx_security_scans_version_ruleset
          on security_scans(skill_version_id, ruleset_version);

        create table security_exemptions (
          id text primary key,
          skill_id text not null references skills(id) on delete cascade,
          scope text not null,
          reason text not null,
          created_at text not null default current_timestamp,
          revoked_at text
        );

        create index idx_security_exemptions_skill on security_exemptions(skill_id);

        create unique index idx_security_exemptions_active_scope
          on security_exemptions(skill_id, scope)
          where revoked_at is null;
      `);
    }
  },
  {
    version: 5,
    name: '005_sync_state',
    up(database) {
      database.exec(`
        create table sync_profiles (
          id text primary key,
          mode text not null,
          remote_url text not null,
          auth_ref text,
          enabled integer not null default 0,
          last_synced_at text,
          created_at text not null default current_timestamp
        );

        create table sync_outbox (
          id text primary key,
          profile_id text not null references sync_profiles(id) on delete cascade,
          entity_type text not null,
          entity_id text not null,
          payload_json text not null,
          status text not null,
          created_at text not null default current_timestamp,
          sent_at text
        );

        create table sync_inbox (
          id text primary key,
          profile_id text not null references sync_profiles(id) on delete cascade,
          remote_event_id text not null,
          entity_type text not null,
          entity_id text not null,
          payload_json text not null,
          status text not null,
          received_at text not null default current_timestamp,
          applied_at text,
          unique(profile_id, remote_event_id)
        );

        create table sync_conflicts (
          id text primary key,
          profile_id text not null references sync_profiles(id) on delete cascade,
          entity_type text not null,
          entity_id text not null,
          base_json text not null,
          local_json text not null,
          remote_json text not null,
          status text not null,
          resolution_json text,
          created_at text not null default current_timestamp,
          resolved_at text
        );

        create table sync_events (
          id text primary key,
          profile_id text not null references sync_profiles(id) on delete cascade,
          direction text not null,
          status text not null,
          entity_type text not null,
          entity_id text not null,
          conflict_id text references sync_conflicts(id) on delete set null,
          occurred_at text not null default current_timestamp
        );

        create index idx_sync_outbox_profile_status on sync_outbox(profile_id, status);
        create index idx_sync_inbox_profile_status on sync_inbox(profile_id, status);
        create index idx_sync_conflicts_profile_status on sync_conflicts(profile_id, status);
      `);
    }
  },
  {
    version: 6,
    name: '006_plugin_runtime',
    up(database) {
      database.exec(`
        create table plugin_manifests (
          id text primary key,
          name text not null,
          version text not null,
          api_version integer not null,
          entry text not null,
          capabilities_json text not null,
          permissions_json text not null,
          integrity_json text not null,
          root_path text not null,
          enabled integer not null default 0,
          status text not null default 'disabled',
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table plugin_permission_grants (
          id text primary key,
          plugin_id text not null references plugin_manifests(id) on delete cascade,
          permission text not null,
          reason text not null,
          created_at text not null default current_timestamp,
          revoked_at text
        );

        create table plugin_errors (
          id text primary key,
          plugin_id text not null references plugin_manifests(id) on delete cascade,
          message text not null,
          created_at text not null default current_timestamp
        );

        create index idx_plugin_permission_grants_plugin
          on plugin_permission_grants(plugin_id, permission);

        create unique index idx_plugin_permission_grants_active
          on plugin_permission_grants(plugin_id, permission)
          where revoked_at is null;

        create index idx_plugin_errors_plugin on plugin_errors(plugin_id, created_at desc);
      `);
    }
  },
  {
    version: 7,
    name: '007_review_usage_events',
    up(database) {
      database.exec(`
        create table usage_events (
          id text primary key,
          event_type text not null,
          skill_id text,
          skill_name text,
          agent_code text,
          agent_display_name text,
          subject text not null,
          metadata_json text not null default '{}',
          occurred_at text not null default current_timestamp
        );

        create index idx_usage_events_type_time on usage_events(event_type, occurred_at desc);
        create index idx_usage_events_skill on usage_events(skill_id, occurred_at desc);
        create index idx_usage_events_agent on usage_events(agent_code, occurred_at desc);

        create table review_items (
          id text primary key,
          item_type text not null,
          subject_id text not null,
          skill_id text,
          skill_name text,
          title text not null,
          detail text not null default '',
          reason text not null,
          source text not null,
          reviewer text not null,
          risk text not null,
          status text not null,
          metadata_json text not null default '{}',
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp,
          unique(item_type, subject_id)
        );

        create table review_notes (
          id text primary key,
          review_item_id text references review_items(id) on delete cascade,
          note text not null,
          status text not null,
          created_at text not null default current_timestamp
        );

        create index idx_review_items_status_risk on review_items(status, risk, updated_at desc);
        create index idx_review_items_skill on review_items(skill_id);
        create index idx_review_notes_item on review_notes(review_item_id, created_at desc);
      `);
    }
  },
  {
    version: 8,
    name: '008_discover_sources',
    up(database) {
      database.exec(`
        create table discover_sources (
          id text primary key,
          name text not null,
          source_type text not null,
          url text not null,
          trust_level text not null,
          verified integer not null default 0,
          status text not null default 'configured',
          cached_at text,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table discover_source_cache (
          id text primary key,
          source_id text not null references discover_sources(id) on delete cascade,
          skill_name text not null,
          description text not null default '',
          tags_json text not null default '[]',
          skill_path text not null,
          risk_status text not null default 'unscanned',
          cached_at text not null default current_timestamp
        );

        create index idx_discover_sources_status on discover_sources(status, updated_at desc);
        create index idx_discover_source_cache_source on discover_source_cache(source_id, skill_name);
      `);
    }
  },
  {
    version: 9,
    name: '009_research_gap_closure',
    up(database) {
      database.exec(`
        alter table agent_roots add column root_kind text not null default 'user';
        alter table installations add column projection_mode text not null default 'copy';
        alter table skill_versions add column lifecycle text not null default 'released';
        alter table skill_versions add column release_channel text not null default 'stable';
        alter table skill_versions add column signature_json text;

        create table skill_favorites (
          skill_id text primary key references skills(id) on delete cascade,
          created_at text not null default current_timestamp
        );

        create table policy_packs (
          id text primary key,
          name text not null,
          allowed_sources_json text not null default '[]',
          blocked_rules_json text not null default '[]',
          required_scan_level text not null,
          approved_plugins_json text not null default '[]',
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table team_baselines (
          id text primary key,
          name text not null,
          package_json text not null,
          applied_at text not null default current_timestamp
        );

        drop table skill_search;
        create virtual table skill_search using fts5(
          skill_id unindexed,
          name,
          description,
          tags,
          file_paths,
          file_content
        );
      `);
    }
  },
  {
    version: 10,
    name: '010_app_settings',
    up(database) {
      database.exec(`
        create table app_settings (
          key text primary key,
          value_json text not null,
          updated_at text not null default current_timestamp
        );
      `);
    }
  },
  {
    version: 11,
    name: '011_local_similarity_index',
    up(database) {
      database.exec(`
        create table skill_similarity_index (
          skill_id text primary key references skills(id) on delete cascade,
          tokens_json text not null,
          updated_at text not null default current_timestamp
        );
      `);
    }
  }
];

export function createMemoryDatabase(): SqliteDatabase {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  return database;
}

export function createFileDatabase(databasePath: string): SqliteDatabase {
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  return database;
}

export function runMigrations(database: SqliteDatabase): MigrationResult {
  database.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      applied_at text not null default current_timestamp
    );
  `);

  const appliedVersions = new Set(
    database
      .prepare('select version from schema_migrations')
      .all()
      .map((row) => migrationRow(row).version)
  );

  const applied: string[] = [];
  const transaction = database.transaction(() => {
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      migration.up(database);
      database
        .prepare('insert into schema_migrations (version, name) values (?, ?)')
        .run(migration.version, migration.name);
      applied.push(migration.name);
    }
  });

  transaction();

  return { applied };
}

export function getCurrentSchemaVersion(database: SqliteDatabase): number {
  database.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      applied_at text not null default current_timestamp
    );
  `);

  const row = database.prepare('select max(version) as version from schema_migrations').get();
  return maxVersionRow(row).version ?? 0;
}

function migrationRow(row: unknown): { version: number } {
  return row as { version: number };
}

function maxVersionRow(row: unknown): { version: number | null } {
  return row as { version: number | null };
}
