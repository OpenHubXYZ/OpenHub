import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(rootDirectory, 'config/desktop-packaging.json'), 'utf8'));
const releaseDirectory = path.join(rootDirectory, config.releaseDirectory);
const packageDirectory = await findCurrentPackage();
const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'release-manifest.json'), 'utf8'));

for (const entrypoint of Object.values(manifest.entrypoints)) {
  await readFile(path.join(packageDirectory, entrypoint));
}
await readFile(path.join(packageDirectory, 'resources/app/node_modules/better-sqlite3/package.json'));

if (manifest.privacyDefaults.telemetry !== false) {
  throw new Error('Release manifest must keep telemetry disabled');
}
if (manifest.privacyDefaults.syncProfileCreated !== false) {
  throw new Error('Release manifest must not create sync profiles by default');
}
if (manifest.privacyDefaults.pluginEnabled !== false) {
  throw new Error('Release manifest must not enable plugins by default');
}
if (manifest.runtimeBoundaries?.credentialStorage !== 'os-keychain-required') {
  throw new Error('Release manifest must require OS-backed credential storage');
}
if (manifest.runtimeBoundaries?.rendererNodeAccess !== false) {
  throw new Error('Release manifest must keep renderer Node access disabled');
}
if (manifest.runtimeBoundaries?.syncDefaultEnabled !== false) {
  throw new Error('Release manifest must keep sync disabled by default');
}
if (manifest.runtimeBoundaries?.pluginDefaultEnabled !== false) {
  throw new Error('Release manifest must keep plugins disabled by default');
}

await runSmokeTests();
await runPackagedStartupSmoke();
await runPackagedWindowSmoke();
await mkdir(releaseDirectory, { recursive: true });

const logContent = [
  'release_smoke=passed',
  `platform=${process.platform}`,
  `arch=${process.arch}`,
  'package_payload=verified',
  'package_startup=verified',
  'package_window=verified',
  'database_migration=verified',
  'skills_flow=verified',
  'desktop_runtime=verified',
  'root_detection=verified',
  'advanced_import=verified',
  'credential_store_boundary=verified',
  'sync_disabled_default=verified',
  'plugin_disabled_default=verified',
  'sync_conflict_center=verified',
  'plugin_provider_workflows=verified',
  'privacy_defaults=verified',
  'renderer_privilege_boundary=verified'
].join('\n');

assertLogIsRedacted(logContent);
const logPath = path.join(releaseDirectory, `release-smoke-${process.platform}-${process.arch}.log`);
await writeFile(logPath, `${logContent}\n`);
console.log(`Release smoke passed; log written to ${path.relative(rootDirectory, logPath)}`);

async function findCurrentPackage() {
  const packagesDirectory = path.join(rootDirectory, config.unpackedDirectory);
  const packageNames = await readdir(packagesDirectory);
  const packageName = packageNames
    .filter((name) => name.startsWith(`${config.artifactName}-`) && name.includes(`${process.platform}-${process.arch}`))
    .sort()
    .at(-1);

  if (!packageName) {
    throw new Error(`No package found for ${process.platform}-${process.arch}`);
  }

  return path.join(packagesDirectory, packageName);
}

async function runSmokeTests() {
  const args = [
    'exec',
    'vitest',
    'run',
    'packages/db/src/migrations.test.ts',
    'packages/core/src/import-service.test.ts',
    'packages/core/src/library-scanner.test.ts',
    'packages/core/src/version-service.test.ts',
    'apps/desktop/src/main/desktop-runtime.test.ts',
    'apps/desktop/src/main/window-options.test.ts',
    'apps/desktop/src/renderer/App.test.tsx'
  ];
  const result = await spawnForResult('pnpm', args);
  if (result.code !== 0) {
    throw new Error(`Release smoke tests failed:\n${result.output}`);
  }
}

async function runPackagedStartupSmoke() {
  const smokeDataDirectory = await mkdtemp(path.join(tmpdir(), 'theopenhub-package-smoke-'));
  const result = await spawnForResult(
    'pnpm',
    [
      'exec',
      'electron',
      path.join(packageDirectory, manifest.entrypoints.main),
      '--release-smoke',
      `--smoke-data-dir=${smokeDataDirectory}`
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeoutMs: 45000 }
  );

  await rm(smokeDataDirectory, { recursive: true, force: true });

  if (result.code !== 0) {
    throw new Error(`Packaged startup smoke failed:\n${result.output}`);
  }
  if (!result.output.includes('"status":"passed"')) {
    throw new Error(`Packaged startup smoke did not report success:\n${result.output}`);
  }
}

async function runPackagedWindowSmoke() {
  const smokeDataDirectory = await mkdtemp(path.join(tmpdir(), 'theopenhub-window-smoke-'));
  const executable = findPackagedExecutable();
  const result = await spawnForResult(
    executable.command,
    [...executable.args, '--window-smoke', `--smoke-data-dir=${smokeDataDirectory}`],
    { timeoutMs: 45000 }
  );

  await rm(smokeDataDirectory, { recursive: true, force: true });

  if (result.code !== 0) {
    throw new Error(`Packaged window smoke failed:\n${result.output}`);
  }
  if (!result.output.includes('"windowSmoke":{"status":"passed"')) {
    throw new Error(`Packaged window smoke did not report success:\n${result.output}`);
  }
}

function findPackagedExecutable() {
  if (process.platform === 'darwin' && manifest.appBundle) {
    return {
      command: path.join(packageDirectory, manifest.appBundle, 'Contents/MacOS/Electron'),
      args: []
    };
  }

  return {
    command: 'pnpm',
    args: ['exec', 'electron', path.join(packageDirectory, manifest.entrypoints.main)]
  };
}

function spawnForResult(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDirectory,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ code: 124, output: `${output}\nTimed out after ${options.timeoutMs}ms` });
        }, options.timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({ code, output });
    });
  });
}

function assertLogIsRedacted(content) {
  const forbiddenPatterns = [/token/i, /secret/i, /\.env/i, /id_rsa/i, /-----BEGIN/, /\/Users\//, /\/tmp\//];
  const failedPattern = forbiddenPatterns.find((pattern) => pattern.test(content));
  if (failedPattern) {
    throw new Error(`Release smoke log contains forbidden pattern: ${failedPattern.source}`);
  }
}
