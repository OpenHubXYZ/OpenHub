import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PluginHostError,
  PluginManifestError,
  createPluginService,
  type PluginCapability,
  type PluginManifest
} from './plugin-service';

const tempDirectories: string[] = [];

describe('plugin service', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('validates manifests for missing fields, unknown permissions, incompatible versions, and integrity', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });

    expectPluginManifestError(() => plugins.validateManifest({ id: 'missing-fields' }), 'missing-field');
    expectPluginManifestError(
      () => plugins.validateManifest(validManifest({ permissions: ['filesystem:*'] })),
      'unknown-permission'
    );
    expectPluginManifestError(
      () => plugins.validateManifest(validManifest({ apiVersion: 99 })),
      'incompatible-api-version'
    );

    await expect(
      plugins.installPlugin({
        rootPath: await createPluginFixture({
          integrityHash: 'bad-hash'
        })
      })
    ).rejects.toMatchObject({ code: 'integrity-mismatch' });
  });

  it('enables an example plugin adapter and removes its capability when disabled', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });
    const rootPath = await createPluginFixture({
      id: 'mock-agent-plugin',
      name: 'Mock Agent Plugin',
      source: `
        exports.register = (host) => {
          host.registerAgentAdapter({ code: 'mock-agent', displayName: 'Mock Agent' });
        };
      `
    });

    const installed = await plugins.installPlugin({ rootPath });
    expect(installed.status).toBe('disabled');

    await plugins.enablePlugin({ pluginId: installed.id });
    expect(plugins.getRegistry().agentAdapters).toEqual([
      {
        pluginId: installed.id,
        code: 'mock-agent',
        displayName: 'Mock Agent'
      }
    ]);
    expect(plugins.getPluginCenterState().plugins[0]).toMatchObject({
      name: 'Mock Agent Plugin',
      status: 'enabled'
    });

    plugins.disablePlugin({ pluginId: installed.id });
    expect(plugins.getRegistry().agentAdapters).toEqual([]);
    expect(plugins.getPluginCenterState().plugins[0]).toMatchObject({
      name: 'Mock Agent Plugin',
      status: 'disabled'
    });
  });

  it('requires explicit authorization before enabling plugins with declared permissions', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });
    const rootPath = await createPluginFixture({
      id: 'network-plugin',
      name: 'Network Plugin',
      capabilities: [{ type: 'agent-adapter', id: 'network-agent' }],
      permissions: ['network:fetch'],
      source: `
        exports.register = (host) => {
          host.registerAgentAdapter({ code: 'network-agent', displayName: 'Network Agent' });
        };
      `
    });
    const installed = await plugins.installPlugin({ rootPath });

    await expect(plugins.enablePlugin({ pluginId: installed.id })).rejects.toMatchObject({
      code: 'permission-not-authorized'
    });
    expect(plugins.getRegistry().agentAdapters).toEqual([]);

    plugins.authorizePermission({
      pluginId: installed.id,
      permission: 'network:fetch',
      reason: 'Fixture authorization'
    });
    await plugins.enablePlugin({ pluginId: installed.id });

    expect(plugins.getRegistry().agentAdapters).toHaveLength(1);
    expect(plugins.getPluginCenterState().plugins[0]?.permissions).toEqual([
      { name: 'network:fetch', status: 'authorized' }
    ]);
  });

  it('blocks malicious fixtures before they can escape the host API', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });
    const rootPath = await createPluginFixture({
      id: 'malicious-plugin',
      name: 'Malicious Plugin',
      source: `
        const fs = require('node:fs');
        exports.register = (host) => {
          host.registerAgentAdapter({ code: 'bad-agent', displayName: fs.readFileSync('/etc/passwd', 'utf8') });
        };
      `
    });
    const installed = await plugins.installPlugin({ rootPath });

    await expect(plugins.enablePlugin({ pluginId: installed.id })).rejects.toBeInstanceOf(PluginHostError);
    expect(plugins.getRegistry().agentAdapters).toEqual([]);
    expect(plugins.getPluginCenterState().plugins[0]?.errors[0]?.message).toMatch(/Unsafe plugin entry/);
  });

  it('invokes executable providers only through authorized host-mediated APIs', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });
    const rootPath = await createPluginFixture({
      id: 'provider-plugin',
      name: 'Provider Plugin',
      capabilities: [{ type: 'importer', id: 'frontmatter-importer' }],
      permissions: ['import:local'],
      source: `
        exports.register = (host) => {
          host.registerImporter({
            id: 'frontmatter-importer',
            name: 'Frontmatter Importer',
            invoke(input) {
              return { accepted: input.path.endsWith('SKILL.md'), normalizedPath: input.path };
            }
          });
        };
      `
    });
    const installed = await plugins.installPlugin({ rootPath });

    await expect(
      plugins.invokeProvider({
        pluginId: installed.id,
        capabilityType: 'importer',
        capabilityId: 'frontmatter-importer',
        input: { path: 'SKILL.md' }
      })
    ).rejects.toMatchObject({ code: 'plugin-not-found' });

    plugins.authorizePermission({
      pluginId: installed.id,
      permission: 'import:local',
      reason: 'Import provider test'
    });
    await plugins.enablePlugin({ pluginId: installed.id });

    await expect(
      plugins.invokeProvider({
        pluginId: installed.id,
        capabilityType: 'importer',
        capabilityId: 'frontmatter-importer',
        input: { path: 'SKILL.md' }
      })
    ).resolves.toEqual({ accepted: true, normalizedPath: 'SKILL.md' });

    plugins.disablePlugin({ pluginId: installed.id });
    await expect(
      plugins.invokeProvider({
        pluginId: installed.id,
        capabilityType: 'importer',
        capabilityId: 'frontmatter-importer',
        input: { path: 'SKILL.md' }
      })
    ).rejects.toMatchObject({ code: 'plugin-not-found' });
  });

  it('registers exporter providers only after permission grants and removes them when disabled', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });
    const rootPath = await createPluginFixture({
      id: 'exporter-plugin',
      name: 'Exporter Plugin',
      capabilities: [{ type: 'exporter', id: 'bundle-exporter' }],
      permissions: ['export:local'],
      signature: {
        signer: 'trusted:fixture',
        value: signedPluginManifestValue('exporter-plugin', 'Exporter Plugin', '1.0.0', 'trusted:fixture')
      },
      source: `
        exports.register = (host) => {
          host.registerExporter({
            id: 'bundle-exporter',
            name: 'Bundle Exporter',
            invoke(input) {
              return { outputDirectory: input.outputDirectory, fileCount: input.files.length };
            }
          });
        };
      `
    });
    const installed = await plugins.installPlugin({ rootPath });

    expect(installed.signatureStatus).toBe('trusted');
    await expect(plugins.enablePlugin({ pluginId: installed.id })).rejects.toMatchObject({
      code: 'permission-not-authorized'
    });
    expect(plugins.getRegistry().exporters).toEqual([]);

    plugins.authorizePermission({
      pluginId: installed.id,
      permission: 'export:local',
      reason: 'Export provider test'
    });
    await plugins.enablePlugin({ pluginId: installed.id });

    expect(plugins.getRegistry().exporters).toEqual([
      { pluginId: installed.id, id: 'bundle-exporter', name: 'Bundle Exporter' }
    ]);
    await expect(
      plugins.invokeProvider({
        pluginId: installed.id,
        capabilityType: 'exporter',
        capabilityId: 'bundle-exporter',
        input: { outputDirectory: '/tmp/out', files: ['SKILL.md'] }
      })
    ).resolves.toEqual({ outputDirectory: '/tmp/out', fileCount: 1 });

    plugins.disablePlugin({ pluginId: installed.id });
    expect(plugins.getRegistry().exporters).toEqual([]);
    await expect(
      plugins.invokeProvider({
        pluginId: installed.id,
        capabilityType: 'exporter',
        capabilityId: 'bundle-exporter',
        input: { outputDirectory: '/tmp/out', files: [] }
      })
    ).rejects.toMatchObject({ code: 'plugin-not-found' });
  });

  it('manages plugin directories, catalog scans, and package signature trust state', async () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const plugins = createPluginService({ database });
    const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-plugin-catalog-'));
    tempDirectories.push(directory);
    const trustedRoot = await createPluginFixture({
      directory: path.join(directory, 'trusted'),
      id: 'trusted-plugin',
      name: 'Trusted Plugin',
      signature: {
        signer: 'trusted:catalog',
        value: signedPluginManifestValue('trusted-plugin', 'Trusted Plugin', '1.0.0', 'trusted:catalog')
      }
    });
    await createPluginFixture({
      directory: path.join(directory, 'untrusted'),
      id: 'untrusted-plugin',
      name: 'Untrusted Plugin',
      signature: {
        signer: 'unknown:catalog',
        value: 'bad-signature'
      }
    });
    await createPluginFixture({
      directory: path.join(directory, 'unsigned'),
      id: 'unsigned-plugin',
      name: 'Unsigned Plugin'
    });

    const record = plugins.addPluginDirectory({ rootPath: directory });
    expect(plugins.listPluginDirectories()).toEqual([expect.objectContaining({ id: record.id, rootPath: directory })]);

    const scan = await plugins.scanPluginDirectory({ directoryId: record.id });
    expect(scan.directory.status).toBe('scanned');
    expect(scan.catalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: 'trusted-plugin',
          rootPath: trustedRoot,
          signatureStatus: 'trusted',
          installed: false
        }),
        expect.objectContaining({ pluginId: 'untrusted-plugin', signatureStatus: 'untrusted' }),
        expect.objectContaining({ pluginId: 'unsigned-plugin', signatureStatus: 'unsigned' })
      ])
    );

    await plugins.installPlugin({ rootPath: trustedRoot });
    expect(plugins.getPluginCenterState().catalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pluginId: 'trusted-plugin', installed: true, signatureStatus: 'trusted' })
      ])
    );

    const removed = plugins.removePluginDirectory({ directoryId: record.id });
    expect(removed).toEqual({ status: 'removed' });
    expect(plugins.listPluginDirectories()).toEqual([]);
    expect(plugins.getPluginCenterState().catalog).toEqual([]);
  });
});

function validManifest(
  overrides: Partial<Omit<PluginManifest, 'permissions'>> & { permissions?: string[] } = {}
): Record<string, unknown> {
  return {
    id: 'valid-plugin',
    name: 'Valid Plugin',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'plugin.js',
    capabilities: [{ type: 'agent-adapter', id: 'mock-agent' }],
    permissions: [],
    integrity: { algorithm: 'sha256', hash: 'hash' },
    ...overrides
  };
}

async function createPluginFixture(input: {
  directory?: string;
  id?: string;
  name?: string;
  apiVersion?: number;
  source?: string;
  capabilities?: PluginCapability[];
  permissions?: string[];
  integrityHash?: string;
  signature?: { signer: string; value: string };
} = {}): Promise<string> {
  const directory = input.directory ?? (await mkdtemp(path.join(tmpdir(), 'theopenhub-plugin-')));
  if (!input.directory) {
    tempDirectories.push(directory);
  }
  await mkdir(directory, { recursive: true });

  const source =
    input.source ??
    `
      exports.register = (host) => {
        host.registerAgentAdapter({ code: 'mock-agent', displayName: 'Mock Agent' });
      };
    `;
  await writeFile(path.join(directory, 'plugin.js'), source);

  const hash = createHash('sha256').update(source).digest('hex');
  const id = input.id ?? 'mock-agent-plugin';
  const name = input.name ?? 'Mock Agent Plugin';
  await writeFile(
    path.join(directory, 'plugin.json'),
    JSON.stringify(
      validManifest({
        id,
        name,
        apiVersion: input.apiVersion ?? 1,
        capabilities: input.capabilities ?? [{ type: 'agent-adapter', id: 'mock-agent' }],
        permissions: input.permissions ?? [],
        integrity: { algorithm: 'sha256', hash: input.integrityHash ?? hash },
        ...(input.signature
          ? {
              signature: {
                status: 'signed',
                algorithm: 'sha256',
                signer: input.signature.signer,
                value: input.signature.value
              }
            }
          : {})
      }),
      null,
      2
    )
  );

  return directory;
}

function expectPluginManifestError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PluginManifestError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected PluginManifestError: ${code}`);
}

function signedPluginManifestValue(id: string, name: string, version: string, signer: string): string {
  return createHash('sha256').update(`${JSON.stringify({ id, name, version })}:${signer}`).digest('hex');
}
