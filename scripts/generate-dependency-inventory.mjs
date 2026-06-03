import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(rootDirectory, 'config/desktop-packaging.json'), 'utf8'));
const releaseDirectory = path.join(rootDirectory, config.releaseDirectory);
const workspacePackages = [
  'package.json',
  'apps/desktop/package.json',
  'packages/adapters/package.json',
  'packages/core/package.json',
  'packages/db/package.json',
  'packages/shared/package.json'
];

const packages = [];
for (const packagePath of workspacePackages) {
  const manifest = JSON.parse(await readFile(path.join(rootDirectory, packagePath), 'utf8'));
  packages.push({
    path: packagePath,
    name: manifest.name,
    version: manifest.version,
    dependencies: manifest.dependencies ?? {},
    devDependencies: manifest.devDependencies ?? {}
  });
}

const inventory = {
  generatedAt: new Date().toISOString(),
  packageManager: JSON.parse(await readFile(path.join(rootDirectory, 'package.json'), 'utf8')).packageManager,
  lockfile: 'pnpm-lock.yaml',
  packages
};

await mkdir(releaseDirectory, { recursive: true });
const outputPath = path.join(releaseDirectory, 'dependency-inventory.json');
await writeFile(outputPath, JSON.stringify(inventory, null, 2));

console.log(`Dependency inventory written to ${path.relative(rootDirectory, outputPath)}`);
