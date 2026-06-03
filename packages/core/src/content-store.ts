import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StoredBlob {
  hash: string;
  size: number;
  storagePath: string;
}

export interface ContentStore {
  writeBlob(content: string | Buffer): Promise<StoredBlob>;
  readBlob(hash: string): Promise<Buffer>;
  resolveBlobPath(hash: string): string;
}

export function createContentStore(rootDirectory: string): ContentStore {
  return {
    async writeBlob(content) {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      const hash = createHash('sha256').update(buffer).digest('hex');
      const storagePath = resolveBlobPath(rootDirectory, hash);

      await mkdir(path.dirname(storagePath), { recursive: true });
      await writeFile(storagePath, buffer, { flag: 'wx' }).catch((error: unknown) => {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EEXIST') {
          return;
        }

        throw error;
      });

      return {
        hash,
        size: buffer.byteLength,
        storagePath
      };
    },

    readBlob(hash) {
      return readFile(resolveBlobPath(rootDirectory, hash));
    },

    resolveBlobPath(hash) {
      return resolveBlobPath(rootDirectory, hash);
    }
  };
}

function resolveBlobPath(rootDirectory: string, hash: string): string {
  return path.join(rootDirectory, hash.slice(0, 2), hash);
}
