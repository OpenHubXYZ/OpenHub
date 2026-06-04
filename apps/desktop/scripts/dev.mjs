import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import electronPath from 'electron';

import { prepareDevElectronNativeRuntime } from '../../../scripts/electron-native-runtime.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, '../../..');
const desktopPackagePath = path.join(rootDirectory, 'apps/desktop/package.json');
const requireFromDesktop = createRequire(desktopPackagePath);
const electronPackage = JSON.parse(
  await import('node:fs/promises').then(({ readFile }) =>
    readFile(requireFromDesktop.resolve('electron/package.json'), 'utf8')
  )
);
const runtimeExternalDependencies = ['better-sqlite3'];
const runtimeNativeDependencies = ['better-sqlite3'];

await build({ configFile: 'vite.main.config.ts' });
await build({ configFile: 'vite.preload.config.ts' });
await prepareDevElectronNativeRuntime({
  rootDirectory,
  desktopPackagePath,
  mainDistDirectory: path.join(rootDirectory, 'apps/desktop/dist/main'),
  electronVersion: electronPackage.version,
  runtimeExternalDependencies,
  runtimeNativeDependencies
});

const server = await createServer({
  configFile: 'vite.renderer.config.ts',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false
  }
});

await server.listen();

const urls = server.resolvedUrls?.local ?? [];
const devServerUrl = urls[0];

if (!devServerUrl) {
  throw new Error('Vite dev server did not expose a local URL');
}

const electronArgs = ['.'];
if (process.env.OPENHUB_REMOTE_DEBUGGING_PORT) {
  electronArgs.unshift(`--remote-debugging-port=${process.env.OPENHUB_REMOTE_DEBUGGING_PORT}`);
}

const electron = spawn(electronPath, electronArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devServerUrl
  }
});

const shutdown = async () => {
  electron.kill();
  await server.close();
};

electron.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
