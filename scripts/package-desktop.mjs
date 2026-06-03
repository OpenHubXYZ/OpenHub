import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateChecksums } from './release-utils.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = await readJson(path.join(rootDirectory, 'config/desktop-packaging.json'));
const rootPackage = await readJson(path.join(rootDirectory, 'package.json'));
const desktopPackage = await readJson(path.join(rootDirectory, 'apps/desktop/package.json'));
const requireFromDesktop = createRequire(path.join(rootDirectory, 'apps/desktop/package.json'));
const runtimeExternalDependencies = ['better-sqlite3'];
const runtimeNativeDependencies = ['better-sqlite3'];
const electronPackage = await readJson(requireFromDesktop.resolve('electron/package.json'));
const target = config.targets[process.platform];

if (!target) {
  throw new Error(`Unsupported packaging platform: ${process.platform}`);
}

const artifactName = `${config.artifactName}-${rootPackage.version}-${process.platform}-${process.arch}`;
const packageDirectory = path.join(rootDirectory, config.unpackedDirectory, artifactName);
const appDirectory = path.join(packageDirectory, 'resources/app');

await rm(packageDirectory, { recursive: true, force: true });
await mkdir(appDirectory, { recursive: true });

await cp(path.join(rootDirectory, 'apps/desktop/dist'), path.join(appDirectory, 'dist'), {
  recursive: true
});
await cp(path.join(rootDirectory, 'apps/desktop/index.html'), path.join(appDirectory, 'index.html'));
await cp(path.join(rootDirectory, 'apps/desktop/public'), path.join(appDirectory, 'public'), {
  recursive: true
});

await writeFile(
  path.join(appDirectory, 'package.json'),
  JSON.stringify(
    {
      name: desktopPackage.name,
      version: rootPackage.version,
      private: true,
      type: 'module',
      main: desktopPackage.main,
      dependencies: pickDependencies(desktopPackage.dependencies, runtimeExternalDependencies)
    },
    null,
    2
  )
);
await copyRuntimeExternalDependencies(runtimeExternalDependencies, path.join(appDirectory, 'node_modules'));
await installElectronNativeRuntime(appDirectory, electronPackage.version, runtimeNativeDependencies);

for (const fileName of ['README.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md']) {
  await cp(path.join(rootDirectory, fileName), path.join(packageDirectory, fileName));
}

const manifest = {
  appId: config.appId,
  productName: config.productName,
  version: rootPackage.version,
  platform: process.platform,
  arch: process.arch,
  formats: target.formats,
  packageType: 'unpacked',
  entrypoints: {
    main: 'resources/app/dist/main/main.js',
    preload: 'resources/app/dist/preload/preload.cjs',
    renderer: 'resources/app/dist/renderer/index.html'
  },
  privacyDefaults: {
    telemetry: false,
    syncProfileCreated: false,
    pluginEnabled: false
  }
};

await writeFile(path.join(packageDirectory, 'release-manifest.json'), JSON.stringify(manifest, null, 2));

const checksumFile = await generateChecksums({
  rootDirectory,
  packageDirectory,
  releaseDirectory: path.join(rootDirectory, config.releaseDirectory),
  label: `${process.platform}-${process.arch}`
});

console.log(`Packaged ${config.productName} to ${path.relative(rootDirectory, packageDirectory)}`);
console.log(`Checksums written to ${path.relative(rootDirectory, checksumFile)}`);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function pickDependencies(dependencies, names) {
  return Object.fromEntries(
    names.map((name) => {
      const version = dependencies[name];
      if (!version) {
        throw new Error(`Missing runtime dependency in desktop package: ${name}`);
      }

      return [name, version];
    })
  );
}

async function copyRuntimeExternalDependencies(names, destinationNodeModules) {
  await mkdir(destinationNodeModules, { recursive: true });
  const copied = new Set();

  for (const name of names) {
    await copyPackageDependency(name, requireFromDesktop, destinationNodeModules, copied);
  }
}

async function copyPackageDependency(name, requester, destinationNodeModules, copied) {
  const packageJsonPath = requester.resolve(`${name}/package.json`);
  const packageDirectory = path.dirname(packageJsonPath);
  const packageJson = await readJson(packageJsonPath);
  const packageKey = `${packageJson.name}@${packageJson.version}`;

  if (copied.has(packageKey)) {
    return;
  }

  copied.add(packageKey);
  const destinationDirectory = path.join(destinationNodeModules, ...packageJson.name.split('/'));

  await rm(destinationDirectory, { recursive: true, force: true });
  await mkdir(path.dirname(destinationDirectory), { recursive: true });
  await cp(packageDirectory, destinationDirectory, {
    recursive: true,
    dereference: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(packageDirectory, sourcePath);
      return relativePath === '' || !isNestedNodeModulesPath(relativePath);
    }
  });

  const packageRequire = createRequire(packageJsonPath);
  const dependencyNames = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  });

  for (const dependencyName of dependencyNames) {
    await copyPackageDependency(dependencyName, packageRequire, destinationNodeModules, copied);
  }
}

function isNestedNodeModulesPath(relativePath) {
  return relativePath === 'node_modules' || relativePath.startsWith(`node_modules${path.sep}`);
}

async function installElectronNativeRuntime(appDirectory, electronVersion, names) {
  const prebuildInstall = path.join(appDirectory, 'node_modules/prebuild-install/bin.js');

  for (const name of names) {
    const moduleDirectory = path.join(appDirectory, 'node_modules', ...name.split('/'));
    const result = await spawnForResult(
      'node',
      [
        prebuildInstall,
        '--runtime=electron',
        `--target=${electronVersion}`,
        '--disturl=https://electronjs.org/headers'
      ],
      { cwd: moduleDirectory }
    );

    if (result.code !== 0) {
      throw new Error(`Failed to install Electron native runtime for ${name}:\n${result.output}`);
    }
  }
}

function spawnForResult(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
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
