import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyRuntimeExternalDependencies, installElectronNativeRuntime } from './electron-native-runtime.mjs';
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
await copyRuntimeExternalDependencies(runtimeExternalDependencies, path.join(appDirectory, 'node_modules'), requireFromDesktop);
await installElectronNativeRuntime({
  appDirectory,
  electronVersion: electronPackage.version,
  names: runtimeNativeDependencies
});

for (const fileName of ['README.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md']) {
  await cp(path.join(rootDirectory, fileName), path.join(packageDirectory, fileName));
}

const appBundle = process.platform === 'darwin' ? await createDarwinAppBundle(packageDirectory, appDirectory) : null;

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
  appBundle: appBundle ? path.relative(packageDirectory, appBundle) : null,
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

async function createDarwinAppBundle(packageDirectory, appDirectory) {
  const electronPackageDirectory = path.dirname(requireFromDesktop.resolve('electron/package.json'));
  const sourceBundle = path.join(electronPackageDirectory, 'dist/Electron.app');
  const bundleDirectory = path.join(packageDirectory, `${config.productName}.app`);
  const bundleResourcesDirectory = path.join(bundleDirectory, 'Contents/Resources');
  const bundledAppDirectory = path.join(bundleResourcesDirectory, 'app');
  const iconPath = path.join(bundleResourcesDirectory, 'OpenHub.icns');

  await rm(bundleDirectory, { recursive: true, force: true });
  await cp(sourceBundle, bundleDirectory, { recursive: true, dereference: true });
  await rm(bundledAppDirectory, { recursive: true, force: true });
  await cp(appDirectory, bundledAppDirectory, { recursive: true });
  await createIcns(path.join(rootDirectory, 'apps/desktop/public/icon.png'), iconPath);

  const plistPath = path.join(bundleDirectory, 'Contents/Info.plist');
  await setPlistString(plistPath, 'CFBundleName', config.productName);
  await setPlistString(plistPath, 'CFBundleDisplayName', config.productName);
  await setPlistString(plistPath, 'CFBundleIdentifier', config.appId);
  await setPlistString(plistPath, 'CFBundleShortVersionString', rootPackage.version);
  await setPlistString(plistPath, 'CFBundleVersion', rootPackage.version);
  await setPlistString(plistPath, 'CFBundleIconFile', 'OpenHub');

  return bundleDirectory;
}

async function createIcns(sourcePng, iconPath) {
  const iconsetDirectory = path.join(packageDirectory, 'OpenHub.iconset');
  const sizes = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ];

  await rm(iconsetDirectory, { recursive: true, force: true });
  await mkdir(iconsetDirectory, { recursive: true });

  for (const [fileName, size] of sizes) {
    const result = await spawnForResult(
      'sips',
      ['-z', String(size), String(size), sourcePng, '--out', path.join(iconsetDirectory, fileName)],
      { cwd: rootDirectory }
    );

    if (result.code !== 0) {
      throw new Error(`Failed to create app icon size ${size}:\n${result.output}`);
    }
  }

  const result = await spawnForResult('iconutil', ['-c', 'icns', iconsetDirectory, '-o', iconPath], {
    cwd: rootDirectory
  });
  await rm(iconsetDirectory, { recursive: true, force: true });

  if (result.code !== 0) {
    throw new Error(`Failed to create app icon:\n${result.output}`);
  }
}

async function setPlistString(plistPath, key, value) {
  const setResult = await spawnForResult('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath], {
    cwd: rootDirectory
  });

  if (setResult.code === 0) {
    return;
  }

  const addResult = await spawnForResult('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plistPath], {
    cwd: rootDirectory
  });

  if (addResult.code !== 0) {
    throw new Error(`Failed to update ${key} in app bundle Info.plist:\n${setResult.output}\n${addResult.output}`);
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
