import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function generateChecksums({ rootDirectory, packageDirectory, releaseDirectory, label }) {
  await mkdir(releaseDirectory, { recursive: true });
  const files = await listFiles(packageDirectory);
  const lines = [];

  for (const filePath of files) {
    const hash = createHash('sha256').update(await readFile(filePath)).digest('hex');
    lines.push(`${hash}  ${path.relative(rootDirectory, filePath).replaceAll(path.sep, '/')}`);
  }

  const checksumFile = path.join(releaseDirectory, `checksums-${label}.sha256`);
  await writeFile(checksumFile, `${lines.sort().join('\n')}\n`);
  return checksumFile;
}

export async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
