import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateChecksums } from './release-utils.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(rootDirectory, 'config/desktop-packaging.json'), 'utf8'));
const packagesDirectory = path.join(rootDirectory, config.unpackedDirectory);
const packageNames = await readdir(packagesDirectory);
const currentPackageName = packageNames
  .filter((name) => name.includes(`${process.platform}-${process.arch}`))
  .sort()
  .at(-1);

if (!currentPackageName) {
  throw new Error(`No package found for ${process.platform}-${process.arch}`);
}

const checksumFile = await generateChecksums({
  rootDirectory,
  packageDirectory: path.join(packagesDirectory, currentPackageName),
  releaseDirectory: path.join(rootDirectory, config.releaseDirectory),
  label: `${process.platform}-${process.arch}`
});

console.log(`Checksums written to ${path.relative(rootDirectory, checksumFile)}`);
