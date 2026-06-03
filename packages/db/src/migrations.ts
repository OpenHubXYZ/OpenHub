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
          file_paths
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
  }
];

export function createMemoryDatabase(): SqliteDatabase {
  const database = new Database(':memory:');
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
