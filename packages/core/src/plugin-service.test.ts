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
  id?: string;
  name?: string;
  apiVersion?: number;
  source?: string;
  capabilities?: PluginCapability[];
  permissions?: string[];
  integrityHash?: string;
} = {}): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-plugin-'));
  tempDirectories.push(directory);
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
  await writeFile(
    path.join(directory, 'plugin.json'),
    JSON.stringify(
      validManifest({
        id: input.id ?? 'mock-agent-plugin',
        name: input.name ?? 'Mock Agent Plugin',
        apiVersion: input.apiVersion ?? 1,
        capabilities: input.capabilities ?? [{ type: 'agent-adapter', id: 'mock-agent' }],
        permissions: input.permissions ?? [],
        integrity: { algorithm: 'sha256', hash: input.integrityHash ?? hash }
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
