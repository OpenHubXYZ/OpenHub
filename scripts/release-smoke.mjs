import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
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

if (manifest.privacyDefaults.telemetry !== false) {
  throw new Error('Release manifest must keep telemetry disabled');
}
if (manifest.privacyDefaults.syncProfileCreated !== false) {
  throw new Error('Release manifest must not create sync profiles by default');
}
if (manifest.privacyDefaults.pluginEnabled !== false) {
  throw new Error('Release manifest must not enable plugins by default');
}

await runSmokeTests();
await mkdir(releaseDirectory, { recursive: true });

const logContent = [
  'release_smoke=passed',
  `platform=${process.platform}`,
  `arch=${process.arch}`,
  'package_payload=verified',
  'database_migration=verified',
  'phase4_import_install=verified',
  'first_launch_options=verified',
  'privacy_defaults=verified'
].join('\n');

assertLogIsRedacted(logContent);
const logPath = path.join(releaseDirectory, `release-smoke-${process.platform}-${process.arch}.log`);
await writeFile(logPath, `${logContent}\n`);
console.log(`Release smoke passed; log written to ${path.relative(rootDirectory, logPath)}`);

async function findCurrentPackage() {
  const packagesDirectory = path.join(rootDirectory, config.unpackedDirectory);
  const packageNames = await readdir(packagesDirectory);
  const packageName = packageNames
    .filter((name) => name.includes(`${process.platform}-${process.arch}`))
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
    'packages/core/src/install-service.test.ts',
    'apps/desktop/src/main/window-options.test.ts'
  ];
  const result = await spawnForResult('pnpm', args);
  if (result.code !== 0) {
    throw new Error(`Release smoke tests failed:\n${result.output}`);
  }
}

function spawnForResult(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDirectory, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
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
