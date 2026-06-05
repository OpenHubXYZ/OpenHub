import { createHash, randomUUID } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

import type { SqliteDatabase } from '@theopenhub/db';

import { assertZipEntryPathSafe, ensurePathInsideRoot } from './path-safety';

export type PluginCapabilityType = 'agent-adapter' | 'importer' | 'security-rule' | 'sync-driver' | 'exporter';
export type PluginPermission =
  | 'agent-root:read'
  | 'agent-root:write'
  | 'network:fetch'
  | 'import:local'
  | 'sync-driver'
  | 'export:local';
export type PluginStatus = 'disabled' | 'enabled' | 'error';
export type PluginSignatureStatus = 'unsigned' | 'trusted' | 'untrusted';
export type PluginDirectoryStatus = 'active' | 'scanned';
export type PluginCatalogStatus = 'available' | 'error';
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

export interface PluginSignature {
  status: 'unsigned' | 'signed';
  algorithm?: 'sha256';
  signer?: string;
  value?: string;
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
  signature: PluginSignature;
}

export interface InstalledPlugin extends PluginManifest {
  rootPath: string;
  enabled: boolean;
  status: PluginStatus;
  signatureStatus: PluginSignatureStatus;
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
  exporters: Array<{ pluginId: string; id: string; name: string }>;
}

type PluginProvider = (input: unknown) => unknown;
type PluginProviderMap = Map<string, PluginProvider>;

export interface PluginCenterState {
  directories: PluginDirectoryRecord[];
  catalog: PluginCatalogEntry[];
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    rootPath: string;
    status: PluginStatus;
    signatureStatus: PluginSignatureStatus;
    capabilities: string[];
    permissions: Array<{ name: PluginPermission; status: 'declared' | 'authorized' }>;
    errors: Array<{ message: string }>;
  }>;
}

export interface PluginDirectoryRecord {
  id: string;
  rootPath: string;
  status: PluginDirectoryStatus;
  scannedAt: string | null;
}

export interface PluginCatalogEntry {
  id: string;
  directoryId: string;
  pluginId: string;
  name: string;
  version: string;
  rootPath: string;
  signatureStatus: PluginSignatureStatus;
  installed: boolean;
  status: PluginCatalogStatus;
  errorMessage?: string | null;
}

export interface PluginDirectoryScanResult {
  directory: PluginDirectoryRecord;
  catalog: PluginCatalogEntry[];
}

export interface CreatePluginServiceInput {
  database: SqliteDatabase;
}

export interface PluginService {
  validateManifest(input: unknown): PluginManifest;
  installPlugin(input: { rootPath: string }): Promise<InstalledPlugin>;
  addPluginDirectory(input: { rootPath: string }): PluginDirectoryRecord;
  listPluginDirectories(): PluginDirectoryRecord[];
  scanPluginDirectory(input: { directoryId: string }): Promise<PluginDirectoryScanResult>;
  removePluginDirectory(input: { directoryId: string }): { status: 'removed' };
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
  'sync-driver',
  'export:local'
]);
const ALLOWED_CAPABILITIES = new Set<PluginCapabilityType>([
  'agent-adapter',
  'importer',
  'security-rule',
  'sync-driver',
  'exporter'
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
      const signatureStatus = getPluginSignatureStatus(manifest);

      input.database
        .prepare(
          `
            insert into plugin_manifests
              (
                id,
                name,
                version,
                api_version,
                entry,
                capabilities_json,
                permissions_json,
                integrity_json,
                signature_json,
                signature_status,
                root_path
              )
            values
              (
                @id,
                @name,
                @version,
                @apiVersion,
                @entry,
                @capabilitiesJson,
                @permissionsJson,
                @integrityJson,
                @signatureJson,
                @signatureStatus,
                @rootPath
              )
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
          signatureJson: JSON.stringify(manifest.signature),
          signatureStatus,
          rootPath
        });

      return getInstalledPlugin(input.database, manifest.id);
    },

    addPluginDirectory({ rootPath }) {
      const existing = input.database
        .prepare(
          `
            select id, root_path as rootPath, status, scanned_at as scannedAt
            from plugin_directories
            where root_path = ?
          `
        )
        .get(rootPath);
      if (existing) {
        return pluginDirectoryRow(existing);
      }

      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into plugin_directories (id, root_path)
            values (@id, @rootPath)
          `
        )
        .run({ id, rootPath });
      return getPluginDirectory(input.database, id);
    },

    listPluginDirectories() {
      return listPluginDirectories(input.database);
    },

    async scanPluginDirectory({ directoryId }) {
      const directory = getPluginDirectory(input.database, directoryId);
      const pluginRoots = await collectPluginRoots(directory.rootPath);
      input.database.prepare('delete from plugin_catalog_entries where directory_id = ?').run(directory.id);

      for (const pluginRoot of pluginRoots) {
        const catalogEntry = await readPluginCatalogEntry(input.database, directory.id, pluginRoot);
        input.database
          .prepare(
            `
              insert into plugin_catalog_entries
                (
                  id,
                  directory_id,
                  plugin_id,
                  name,
                  version,
                  root_path,
                  signature_status,
                  status,
                  error_message
                )
              values
                (
                  @id,
                  @directoryId,
                  @pluginId,
                  @name,
                  @version,
                  @rootPath,
                  @signatureStatus,
                  @status,
                  @errorMessage
                )
            `
          )
          .run(catalogEntry);
      }

      input.database
        .prepare(
          `
            update plugin_directories
            set status = 'scanned',
                scanned_at = current_timestamp,
                updated_at = current_timestamp
            where id = ?
          `
        )
        .run(directory.id);

      return {
        directory: getPluginDirectory(input.database, directory.id),
        catalog: listPluginCatalog(input.database, directory.id)
      };
    },

    removePluginDirectory({ directoryId }) {
      getPluginDirectory(input.database, directoryId);
      input.database.prepare('delete from plugin_catalog_entries where directory_id = ?').run(directoryId);
      input.database.prepare('delete from plugin_directories where id = ?').run(directoryId);
      return { status: 'removed' };
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
              signature_json as signatureJson,
              signature_status as signatureStatus,
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
        directories: listPluginDirectories(input.database),
        catalog: listPluginCatalog(input.database),
        plugins: plugins.map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          rootPath: plugin.rootPath,
          status: plugin.status,
          signatureStatus: plugin.signatureStatus,
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
  const signature = validateSignatureMetadata((manifest as { signature?: unknown }).signature);

  return {
    id,
    name,
    version,
    apiVersion: manifest.apiVersion,
    entry,
    capabilities,
    permissions,
    integrity,
    signature
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

function validateSignatureMetadata(input: unknown): PluginSignature {
  if (input === undefined || input === null) {
    return { status: 'unsigned' };
  }

  const signature = input as Partial<PluginSignature> | null;
  if (!signature || typeof signature !== 'object' || signature.status === 'unsigned') {
    return { status: 'unsigned' };
  }

  if (
    signature.status !== 'signed' ||
    signature.algorithm !== 'sha256' ||
    typeof signature.signer !== 'string' ||
    signature.signer.trim() === '' ||
    typeof signature.value !== 'string' ||
    signature.value.trim() === ''
  ) {
    return { status: 'unsigned' };
  }

  return {
    status: 'signed',
    algorithm: 'sha256',
    signer: signature.signer,
    value: signature.value
  };
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
    },

    registerExporter(exporter: { id: string; name: string; invoke?: PluginProvider }) {
      assertNamedRegistration(plugin, registry.exporters, 'exporter', exporter);
      if (typeof exporter.invoke === 'function') {
        providers.set(providerKey(plugin.id, 'exporter', exporter.id), exporter.invoke);
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
  registry.exporters = registry.exporters.filter((exporter) => exporter.pluginId !== pluginId);
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
    syncDrivers: [],
    exporters: []
  };
}

function cloneRegistry(registry: PluginRegistry): PluginRegistry {
  return {
    agentAdapters: [...registry.agentAdapters],
    importers: [...registry.importers],
    securityRules: [...registry.securityRules],
    syncDrivers: [...registry.syncDrivers],
    exporters: [...registry.exporters]
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
          signature_json as signatureJson,
          signature_status as signatureStatus,
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
    signatureJson: string;
    signatureStatus: PluginSignatureStatus;
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
    signature: JSON.parse(plugin.signatureJson) as PluginSignature,
    rootPath: plugin.rootPath,
    enabled: plugin.enabled === 1,
    status: plugin.status,
    signatureStatus: plugin.signatureStatus
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

function getPluginDirectory(database: SqliteDatabase, directoryId: string): PluginDirectoryRecord {
  const row = database
    .prepare(
      `
        select id, root_path as rootPath, status, scanned_at as scannedAt
        from plugin_directories
        where id = ?
      `
    )
    .get(directoryId);

  if (!row) {
    throw new PluginHostError('plugin-not-found', `Plugin directory not found: ${directoryId}`);
  }

  return pluginDirectoryRow(row);
}

function listPluginDirectories(database: SqliteDatabase): PluginDirectoryRecord[] {
  return database
    .prepare(
      `
        select id, root_path as rootPath, status, scanned_at as scannedAt
        from plugin_directories
        order by created_at
      `
    )
    .all()
    .map(pluginDirectoryRow);
}

function pluginDirectoryRow(row: unknown): PluginDirectoryRecord {
  const directory = row as {
    id: string;
    rootPath: string;
    status: PluginDirectoryStatus;
    scannedAt: string | null;
  };

  return {
    id: directory.id,
    rootPath: directory.rootPath,
    status: directory.status,
    scannedAt: directory.scannedAt
  };
}

async function readPluginCatalogEntry(
  database: SqliteDatabase,
  directoryId: string,
  rootPath: string
): Promise<{
  id: string;
  directoryId: string;
  pluginId: string;
  name: string;
  version: string;
  rootPath: string;
  signatureStatus: PluginSignatureStatus;
  status: PluginCatalogStatus;
  errorMessage: string | null;
}> {
  try {
    const manifestPath = await ensurePathInsideRoot(rootPath, path.join(rootPath, 'plugin.json'));
    const manifest = validatePluginManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
    return {
      id: randomUUID(),
      directoryId,
      pluginId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      rootPath,
      signatureStatus: getPluginSignatureStatus(manifest),
      status: 'available',
      errorMessage: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackId = path.basename(rootPath) || randomUUID();
    return {
      id: randomUUID(),
      directoryId,
      pluginId: fallbackId,
      name: fallbackId,
      version: '0.0.0',
      rootPath,
      signatureStatus: 'unsigned',
      status: 'error',
      errorMessage: message
    };
  }
}

function listPluginCatalog(database: SqliteDatabase, directoryId?: string): PluginCatalogEntry[] {
  const rows = directoryId
    ? database
        .prepare(
          `
            select
              pce.id,
              pce.directory_id as directoryId,
              pce.plugin_id as pluginId,
              pce.name,
              pce.version,
              pce.root_path as rootPath,
              pce.signature_status as signatureStatus,
              pce.status,
              pce.error_message as errorMessage,
              case when pm.id is null then 0 else 1 end as installed
            from plugin_catalog_entries pce
            left join plugin_manifests pm on pm.id = pce.plugin_id
            where pce.directory_id = ?
            order by pce.name
          `
        )
        .all(directoryId)
    : database
        .prepare(
          `
            select
              pce.id,
              pce.directory_id as directoryId,
              pce.plugin_id as pluginId,
              pce.name,
              pce.version,
              pce.root_path as rootPath,
              pce.signature_status as signatureStatus,
              pce.status,
              pce.error_message as errorMessage,
              case when pm.id is null then 0 else 1 end as installed
            from plugin_catalog_entries pce
            left join plugin_manifests pm on pm.id = pce.plugin_id
            order by pce.name
          `
        )
        .all();

  return rows.map(pluginCatalogRow);
}

function pluginCatalogRow(row: unknown): PluginCatalogEntry {
  const entry = row as {
    id: string;
    directoryId: string;
    pluginId: string;
    name: string;
    version: string;
    rootPath: string;
    signatureStatus: PluginSignatureStatus;
    installed: number;
    status: PluginCatalogStatus;
    errorMessage: string | null;
  };

  return {
    id: entry.id,
    directoryId: entry.directoryId,
    pluginId: entry.pluginId,
    name: entry.name,
    version: entry.version,
    rootPath: entry.rootPath,
    signatureStatus: entry.signatureStatus,
    installed: entry.installed === 1,
    status: entry.status,
    errorMessage: entry.errorMessage
  };
}

async function collectPluginRoots(directory: string): Promise<string[]> {
  if (await fileExists(path.join(directory, 'plugin.json'))) {
    return [directory];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const roots: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = path.join(directory, entry.name);
    if (await fileExists(path.join(candidate, 'plugin.json'))) {
      roots.push(candidate);
    }
  }

  return roots.sort();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getPluginSignatureStatus(manifest: PluginManifest): PluginSignatureStatus {
  if (manifest.signature.status !== 'signed') {
    return 'unsigned';
  }

  const { signer, value } = manifest.signature;
  if (!signer || !value) {
    return 'untrusted';
  }

  if (signedPluginManifestValue(manifest, signer) !== value) {
    return 'untrusted';
  }

  return signer.startsWith('trusted:') ? 'trusted' : 'untrusted';
}

function signedPluginManifestValue(manifest: Pick<PluginManifest, 'id' | 'name' | 'version'>, signer: string): string {
  return createHash('sha256')
    .update(`${JSON.stringify({ id: manifest.id, name: manifest.name, version: manifest.version })}:${signer}`)
    .digest('hex');
}

function capabilityKey(capability: PluginCapability): string {
  return `${capability.type}:${capability.id}`;
}

function providerKey(pluginId: string, capabilityType: PluginCapabilityType, capabilityId: string): string {
  return `${pluginId}:${capabilityType}:${capabilityId}`;
}
