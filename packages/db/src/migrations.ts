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
          root_kind text not null default 'user',
          created_at text not null default current_timestamp,
          unique(agent_id, root_path, scope)
        );

        create table indexed_skill_locations (
          id text primary key,
          skill_id text not null references skills(id) on delete cascade,
          agent_root_id text not null references agent_roots(id) on delete cascade,
          skill_version_id text not null references skill_versions(id) on delete cascade,
          skill_path text not null,
          visibility_status text not null default 'indexed',
          last_indexed_at text not null default current_timestamp,
          unique(skill_id, agent_root_id, skill_path)
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

        create index idx_skill_versions_skill on skill_versions(skill_id, version_no desc);
        create index idx_skill_files_version on skill_files(skill_version_id);
        create index idx_indexed_skill_locations_skill on indexed_skill_locations(skill_id);
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
    name: '003_sync_state',
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
    version: 4,
    name: '004_plugin_runtime',
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
    version: 5,
    name: '005_discover_sources',
    up(database) {
      database.exec(`
        create table discover_sources (
          id text primary key,
          name text not null,
          source_type text not null,
          url text not null,
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
          cached_at text not null default current_timestamp
        );

        create index idx_discover_sources_status on discover_sources(status, updated_at desc);
        create index idx_discover_source_cache_source on discover_source_cache(source_id, skill_name);
      `);
    }
  },
  {
    version: 6,
    name: '006_inventory_productization',
    up(database) {
      database.exec(`
        create table skill_favorites (
          skill_id text primary key references skills(id) on delete cascade,
          created_at text not null default current_timestamp
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
    version: 7,
    name: '007_app_settings',
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
    version: 8,
    name: '008_local_similarity_index',
    up(database) {
      database.exec(`
        create table skill_similarity_index (
          skill_id text primary key references skills(id) on delete cascade,
          tokens_json text not null,
          updated_at text not null default current_timestamp
        );
      `);
    }
  },
  {
    version: 9,
    name: '009_plugin_directories',
    up(database) {
      database.exec(`
        create table plugin_directories (
          id text primary key,
          root_path text not null unique,
          status text not null default 'active',
          scanned_at text,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create table plugin_catalog_entries (
          id text primary key,
          directory_id text not null references plugin_directories(id) on delete cascade,
          plugin_id text not null,
          name text not null,
          version text not null,
          root_path text not null,
          status text not null default 'available',
          error_message text,
          created_at text not null default current_timestamp,
          updated_at text not null default current_timestamp
        );

        create index idx_plugin_catalog_directory
          on plugin_catalog_entries(directory_id, plugin_id);

        create index idx_plugin_catalog_plugin
          on plugin_catalog_entries(plugin_id);
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
