import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateChecksums } from './release-utils.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = await readJson(path.join(rootDirectory, 'config/desktop-packaging.json'));
const rootPackage = await readJson(path.join(rootDirectory, 'package.json'));
const desktopPackage = await readJson(path.join(rootDirectory, 'apps/desktop/package.json'));
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
      dependencies: desktopPackage.dependencies
    },
    null,
    2
  )
);

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
