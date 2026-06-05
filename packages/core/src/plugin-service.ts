import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

import type { SqliteDatabase } from '@theopenhub/db';

import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

export type PluginCapabilityType = 'agent-adapter' | 'importer' | 'security-rule' | 'sync-driver';
export type PluginPermission =
  | 'agent-root:read'
  | 'agent-root:write'
  | 'network:fetch'
  | 'import:local'
  | 'sync-driver';
export type PluginStatus = 'disabled' | 'enabled' | 'error';
export type PluginManifestErrorCode =
  | 'missing-field'
  | 'unknown-permission'
  | 'unknown-capability'
  | 'incompatible-api-version'
  | 'unsafe-entry-path'
  | 'integrity-mismatch';
export type PluginHostErrorCode =
  | 'plugin-not-found'
  | 'permission-not-authorized'
  | 'unsafe-entry'
  | 'capability-not-declared'
  | 'host-execution-failed';

export interface PluginCapability {
  type: PluginCapabilityType;
  id: string;
}

export interface PluginIntegrity {
  algorithm: 'sha256';
  hash: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: number;
  entry: string;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  integrity: PluginIntegrity;
}

export interface InstalledPlugin extends PluginManifest {
  rootPath: string;
  enabled: boolean;
  status: PluginStatus;
}

export interface PluginAgentAdapterRegistration {
  pluginId: string;
  code: string;
  displayName: string;
}

export interface PluginRegistry {
  agentAdapters: PluginAgentAdapterRegistration[];
  importers: Array<{ pluginId: string; id: string; name: string }>;
  securityRules: Array<{ pluginId: string; id: string; name: string }>;
  syncDrivers: Array<{ pluginId: string; id: string; name: string }>;
}

type PluginProvider = (input: unknown) => unknown;
type PluginProviderMap = Map<string, PluginProvider>;

export interface PluginCenterState {
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    rootPath: string;
    status: PluginStatus;
    capabilities: string[];
    permissions: Array<{ name: PluginPermission; status: 'declared' | 'authorized' }>;
    errors: Array<{ message: string }>;
  }>;
}

export interface CreatePluginServiceInput {
  database: SqliteDatabase;
}

export interface PluginService {
  validateManifest(input: unknown): PluginManifest;
  installPlugin(input: { rootPath: string }): Promise<InstalledPlugin>;
  authorizePermission(input: { pluginId: string; permission: PluginPermission; reason: string }): void;
  enablePlugin(input: { pluginId: string }): Promise<PluginRegistry>;
  disablePlugin(input: { pluginId: string }): void;
  invokeProvider(input: {
    pluginId: string;
    capabilityType: PluginCapabilityType;
    capabilityId: string;
    input: unknown;
  }): Promise<unknown>;
  getRegistry(): PluginRegistry;
  getPluginCenterState(): PluginCenterState;
}

export class PluginManifestError extends Error {
  constructor(
    public readonly code: PluginManifestErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'PluginManifestError';
  }
}

export class PluginHostError extends Error {
  constructor(
    public readonly code: PluginHostErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'PluginHostError';
  }
}

const SUPPORTED_API_VERSION = 1;
const ALLOWED_PERMISSIONS = new Set<PluginPermission>([
  'agent-root:read',
  'agent-root:write',
  'network:fetch',
  'import:local',
  'sync-driver'
]);
const ALLOWED_CAPABILITIES = new Set<PluginCapabilityType>([
  'agent-adapter',
  'importer',
  'security-rule',
  'sync-driver'
]);
const UNSAFE_ENTRY_PATTERNS = [
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bprocess\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /constructor\s*\.\s*constructor/,
  /node:/,
  /child_process/,
  /\bfs\b/
] as const;

export function createPluginService(input: CreatePluginServiceInput): PluginService {
  const registry: PluginRegistry = emptyRegistry();
  const providers: PluginProviderMap = new Map();

  return {
    validateManifest: validatePluginManifest,

    async installPlugin({ rootPath }) {
      const manifestPath = await ensurePathInsideRoot(rootPath, path.join(rootPath, 'plugin.json'));
      const manifest = validatePluginManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
      const entryPath = await resolveEntryPath(rootPath, manifest.entry);
      const entrySource = await readFile(entryPath, 'utf8');
      verifyIntegrity(manifest, entrySource);

      input.database
        .prepare(
          `
            insert into plugin_manifests
              (id, name, version, api_version, entry, capabilities_json, permissions_json, integrity_json, root_path)
            values
              (@id, @name, @version, @apiVersion, @entry, @capabilitiesJson, @permissionsJson, @integrityJson, @rootPath)
          `
        )
        .run({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          apiVersion: manifest.apiVersion,
          entry: manifest.entry,
          capabilitiesJson: JSON.stringify(manifest.capabilities),
          permissionsJson: JSON.stringify(manifest.permissions),
          integrityJson: JSON.stringify(manifest.integrity),
          rootPath
        });

      return getInstalledPlugin(input.database, manifest.id);
    },

    authorizePermission({ pluginId, permission, reason }) {
      assertKnownPermission(permission);
      const plugin = getInstalledPlugin(input.database, pluginId);
      if (!plugin.permissions.includes(permission)) {
        throw new PluginManifestError(
          'unknown-permission',
          `Plugin did not declare permission: ${permission}`
        );
      }

      input.database
        .prepare(
          `
            insert into plugin_permission_grants (id, plugin_id, permission, reason)
            values (@id, @pluginId, @permission, @reason)
          `
        )
        .run({ id: randomUUID(), pluginId, permission, reason });
    },

    async enablePlugin({ pluginId }) {
      const plugin = getInstalledPlugin(input.database, pluginId);

      try {
        ensurePermissionsAuthorized(input.database, plugin);
        const entryPath = await resolveEntryPath(plugin.rootPath, plugin.entry);
        const source = await readFile(entryPath, 'utf8');
        ensureEntrySourceSafe(source);
        unregisterPlugin(registry, providers, plugin.id);
        runPluginModule(source, entryPath, createRestrictedHost(plugin, registry, providers));
        input.database
          .prepare(
            `
              update plugin_manifests
              set enabled = 1, status = 'enabled', updated_at = current_timestamp
              where id = ?
            `
          )
          .run(plugin.id);
      } catch (error) {
        unregisterPlugin(registry, providers, plugin.id);
        const message = error instanceof Error ? error.message : String(error);
        recordPluginError(input.database, plugin.id, message);
        input.database
          .prepare(
            `
              update plugin_manifests
              set enabled = 0, status = 'error', updated_at = current_timestamp
              where id = ?
            `
          )
          .run(plugin.id);
        throw error;
      }

      return cloneRegistry(registry);
    },

    disablePlugin({ pluginId }) {
      getInstalledPlugin(input.database, pluginId);
      unregisterPlugin(registry, providers, pluginId);
      input.database
        .prepare(
          `
            update plugin_manifests
            set enabled = 0, status = 'disabled', updated_at = current_timestamp
            where id = ?
          `
        )
          .run(pluginId);
    },

    async invokeProvider({ pluginId, capabilityType, capabilityId, input: providerInput }) {
      const plugin = getInstalledPlugin(input.database, pluginId);
      if (!plugin.enabled || plugin.status !== 'enabled') {
        throw new PluginHostError('plugin-not-found', `Plugin provider is not enabled: ${pluginId}`);
      }
      assertDeclaredCapability(plugin, capabilityType, capabilityId);
      const provider = providers.get(providerKey(pluginId, capabilityType, capabilityId));
      if (!provider) {
        throw new PluginHostError(
          'capability-not-declared',
          `Plugin provider was not registered: ${capabilityType}:${capabilityId}`
        );
      }

      return Promise.resolve(provider(providerInput));
    },

    getRegistry() {
      return cloneRegistry(registry);
    },

    getPluginCenterState() {
      const plugins = input.database
        .prepare(
          `
            select
              id,
              name,
              version,
              api_version as apiVersion,
              entry,
              capabilities_json as capabilitiesJson,
              permissions_json as permissionsJson,
              integrity_json as integrityJson,
              root_path as rootPath,
              enabled,
              status
            from plugin_manifests
            order by created_at
          `
        )
        .all()
        .map(pluginRow);

      return {
        plugins: plugins.map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          rootPath: plugin.rootPath,
          status: plugin.status,
          capabilities: plugin.capabilities.map((capability) => capabilityKey(capability)),
          permissions: plugin.permissions.map((permission) => ({
            name: permission,
            status: isPermissionAuthorized(input.database, plugin.id, permission) ? 'authorized' : 'declared'
          })),
          errors: getPluginErrors(input.database, plugin.id)
        }))
      };
    }
  };
}

function validatePluginManifest(input: unknown): PluginManifest {
  const manifest = input as Partial<PluginManifest> | null;
  if (!manifest || typeof manifest !== 'object') {
    throw new PluginManifestError('missing-field', 'Plugin manifest must be an object');
  }

  const id = requiredStringField(manifest.id, 'id');
  const name = requiredStringField(manifest.name, 'name');
  const version = requiredStringField(manifest.version, 'version');
  const rawEntry = requiredStringField(manifest.entry, 'entry');

  if (manifest.apiVersion !== SUPPORTED_API_VERSION) {
    throw new PluginManifestError(
      'incompatible-api-version',
      `Unsupported plugin API version: ${String(manifest.apiVersion)}`
    );
  }

  if (!Array.isArray(manifest.capabilities)) {
    throw new PluginManifestError('missing-field', 'Plugin manifest missing field: capabilities');
  }

  if (!Array.isArray(manifest.permissions)) {
    throw new PluginManifestError('missing-field', 'Plugin manifest missing field: permissions');
  }

  const entry = assertSafeEntry(rawEntry);
  const capabilities = manifest.capabilities.map(validateCapability);
  const permissions = manifest.permissions.map((permission) => {
    if (typeof permission !== 'string') {
      throw new PluginManifestError('unknown-permission', 'Plugin permission must be a string');
    }
    assertKnownPermission(permission);
    return permission;
  });

  const integrity = validateIntegrityMetadata(manifest.integrity);

  return {
    id,
    name,
    version,
    apiVersion: manifest.apiVersion,
    entry,
    capabilities,
    permissions,
    integrity
  };
}

function requiredStringField(input: unknown, field: string): string {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new PluginManifestError('missing-field', `Plugin manifest missing field: ${field}`);
  }

  return input;
}

function assertSafeEntry(entry: string): string {
  try {
    return assertZipEntryPathSafe(entry);
  } catch (error) {
    if (error instanceof Error) {
      throw new PluginManifestError('unsafe-entry-path', error.message);
    }

    throw error;
  }
}

function validateCapability(capability: unknown): PluginCapability {
  const candidate = capability as Partial<PluginCapability>;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.type !== 'string' ||
    typeof candidate.id !== 'string' ||
    candidate.id.trim() === '' ||
    !ALLOWED_CAPABILITIES.has(candidate.type as PluginCapabilityType)
  ) {
    throw new PluginManifestError('unknown-capability', 'Unknown plugin capability');
  }

  return {
    type: candidate.type as PluginCapabilityType,
    id: candidate.id
  };
}

function assertKnownPermission(permission: string): asserts permission is PluginPermission {
  if (!ALLOWED_PERMISSIONS.has(permission as PluginPermission)) {
    throw new PluginManifestError('unknown-permission', `Unknown plugin permission: ${permission}`);
  }
}

function validateIntegrityMetadata(input: unknown): PluginIntegrity {
  const integrity = input as Partial<PluginIntegrity> | null;
  if (
    !integrity ||
    typeof integrity !== 'object' ||
    integrity.algorithm !== 'sha256' ||
    typeof integrity.hash !== 'string' ||
    integrity.hash.trim() === ''
  ) {
    throw new PluginManifestError('missing-field', 'Plugin manifest missing field: integrity');
  }

  return { algorithm: 'sha256', hash: integrity.hash };
}

async function resolveEntryPath(rootPath: string, entry: string): Promise<string> {
  return ensurePathInsideRoot(rootPath, path.join(rootPath, assertSafeEntry(entry)));
}

function verifyIntegrity(manifest: PluginManifest, source: string): void {
  const actualHash = createHash('sha256').update(source).digest('hex');
  if (actualHash !== manifest.integrity.hash) {
    throw new PluginManifestError('integrity-mismatch', `Plugin entry integrity mismatch: ${manifest.id}`);
  }
}

function ensurePermissionsAuthorized(database: SqliteDatabase, plugin: InstalledPlugin): void {
  const missing = plugin.permissions.find((permission) => !isPermissionAuthorized(database, plugin.id, permission));
  if (!missing) {
    return;
  }

  throw new PluginHostError(
    'permission-not-authorized',
    `Plugin permission not authorized: ${plugin.id}:${missing}`
  );
}

function ensureEntrySourceSafe(source: string): void {
  const unsafePattern = UNSAFE_ENTRY_PATTERNS.find((pattern) => pattern.test(source));
  if (unsafePattern) {
    throw new PluginHostError('unsafe-entry', `Unsafe plugin entry blocked: ${unsafePattern.source}`);
  }
}

function runPluginModule(
  source: string,
  entryPath: string,
  host: ReturnType<typeof createRestrictedHost>
): void {
  const context = vm.createContext({
    exports: {},
    host,
    console: {
      log() {
        return undefined;
      },
      warn() {
        return undefined;
      },
      error() {
        return undefined;
      }
    }
  });

  try {
    new vm.Script(`${source}\nif (typeof exports.register !== 'function') { throw new Error('Missing register export'); }\nexports.register(host);`, {
      filename: entryPath
    }).runInContext(context, { timeout: 100 });
  } catch (error) {
    if (error instanceof PluginHostError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new PluginHostError('host-execution-failed', message);
  }
}

function createRestrictedHost(plugin: InstalledPlugin, registry: PluginRegistry, providers: PluginProviderMap) {
  return {
    registerAgentAdapter(adapter: { code: string; displayName: string }) {
      if (typeof adapter.code !== 'string' || typeof adapter.displayName !== 'string') {
        throw new PluginHostError('host-execution-failed', 'Invalid agent adapter registration');
      }
      assertDeclaredCapability(plugin, 'agent-adapter', adapter.code);
      registry.agentAdapters.push({
        pluginId: plugin.id,
        code: adapter.code,
        displayName: adapter.displayName
      });
    },

    registerImporter(importer: { id: string; name: string; invoke?: PluginProvider }) {
      assertNamedRegistration(plugin, registry.importers, 'importer', importer);
      if (typeof importer.invoke === 'function') {
        providers.set(providerKey(plugin.id, 'importer', importer.id), importer.invoke);
      }
    },

    registerSecurityRule(rule: { id: string; name: string; invoke?: PluginProvider }) {
      assertNamedRegistration(plugin, registry.securityRules, 'security-rule', rule);
      if (typeof rule.invoke === 'function') {
        providers.set(providerKey(plugin.id, 'security-rule', rule.id), rule.invoke);
      }
    },

    registerSyncDriver(driver: { id: string; name: string; invoke?: PluginProvider }) {
      assertNamedRegistration(plugin, registry.syncDrivers, 'sync-driver', driver);
      if (typeof driver.invoke === 'function') {
        providers.set(providerKey(plugin.id, 'sync-driver', driver.id), driver.invoke);
      }
    }
  };
}

function assertNamedRegistration(
  plugin: InstalledPlugin,
  bucket: Array<{ pluginId: string; id: string; name: string }>,
  type: PluginCapabilityType,
  registration: { id: string; name: string }
): void {
  if (typeof registration.id !== 'string' || typeof registration.name !== 'string') {
    throw new PluginHostError('host-execution-failed', 'Invalid plugin registration');
  }
  assertDeclaredCapability(plugin, type, registration.id);
  bucket.push({ pluginId: plugin.id, id: registration.id, name: registration.name });
}

function assertDeclaredCapability(
  plugin: InstalledPlugin,
  type: PluginCapabilityType,
  id: string
): void {
  if (!plugin.capabilities.some((capability) => capability.type === type && capability.id === id)) {
    throw new PluginHostError('capability-not-declared', `Plugin capability not declared: ${type}:${id}`);
  }
}

function unregisterPlugin(registry: PluginRegistry, providers: PluginProviderMap, pluginId: string): void {
  registry.agentAdapters = registry.agentAdapters.filter((adapter) => adapter.pluginId !== pluginId);
  registry.importers = registry.importers.filter((importer) => importer.pluginId !== pluginId);
  registry.securityRules = registry.securityRules.filter((rule) => rule.pluginId !== pluginId);
  registry.syncDrivers = registry.syncDrivers.filter((driver) => driver.pluginId !== pluginId);
  for (const key of providers.keys()) {
    if (key.startsWith(`${pluginId}:`)) {
      providers.delete(key);
    }
  }
}

function emptyRegistry(): PluginRegistry {
  return {
    agentAdapters: [],
    importers: [],
    securityRules: [],
    syncDrivers: []
  };
}

function cloneRegistry(registry: PluginRegistry): PluginRegistry {
  return {
    agentAdapters: [...registry.agentAdapters],
    importers: [...registry.importers],
    securityRules: [...registry.securityRules],
    syncDrivers: [...registry.syncDrivers]
  };
}

function getInstalledPlugin(database: SqliteDatabase, pluginId: string): InstalledPlugin {
  const row = database
    .prepare(
      `
        select
          id,
          name,
          version,
          api_version as apiVersion,
          entry,
          capabilities_json as capabilitiesJson,
          permissions_json as permissionsJson,
          integrity_json as integrityJson,
          root_path as rootPath,
          enabled,
          status
        from plugin_manifests
        where id = ?
      `
    )
    .get(pluginId);

  if (!row) {
    throw new PluginHostError('plugin-not-found', `Plugin not found: ${pluginId}`);
  }

  return pluginRow(row);
}

function pluginRow(row: unknown): InstalledPlugin {
  const plugin = row as {
    id: string;
    name: string;
    version: string;
    apiVersion: number;
    entry: string;
    capabilitiesJson: string;
    permissionsJson: string;
    integrityJson: string;
    rootPath: string;
    enabled: number;
    status: PluginStatus;
  };

  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    apiVersion: plugin.apiVersion,
    entry: plugin.entry,
    capabilities: JSON.parse(plugin.capabilitiesJson) as PluginCapability[],
    permissions: JSON.parse(plugin.permissionsJson) as PluginPermission[],
    integrity: JSON.parse(plugin.integrityJson) as PluginIntegrity,
    rootPath: plugin.rootPath,
    enabled: plugin.enabled === 1,
    status: plugin.status
  };
}

function isPermissionAuthorized(
  database: SqliteDatabase,
  pluginId: string,
  permission: PluginPermission
): boolean {
  const row = database
    .prepare(
      `
        select id from plugin_permission_grants
        where plugin_id = @pluginId
          and permission = @permission
          and revoked_at is null
      `
    )
    .get({ pluginId, permission });

  return Boolean(row);
}

function recordPluginError(database: SqliteDatabase, pluginId: string, message: string): void {
  database
    .prepare(
      `
        insert into plugin_errors (id, plugin_id, message)
        values (@id, @pluginId, @message)
      `
    )
    .run({ id: randomUUID(), pluginId, message });
}

function getPluginErrors(database: SqliteDatabase, pluginId: string): Array<{ message: string }> {
  return database
    .prepare(
      `
        select message
        from plugin_errors
        where plugin_id = ?
        order by created_at desc
      `
    )
    .all(pluginId)
    .map((row) => row as { message: string });
}

function capabilityKey(capability: PluginCapability): string {
  return `${capability.type}:${capability.id}`;
}

function providerKey(pluginId: string, capabilityType: PluginCapabilityType, capabilityId: string): string {
  return `${pluginId}:${capabilityType}:${capabilityId}`;
}
