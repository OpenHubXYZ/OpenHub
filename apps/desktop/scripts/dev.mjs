import { spawn } from 'node:child_process';
import { build, createServer } from 'vite';
import electronPath from 'electron';

await build({ configFile: 'vite.main.config.ts' });
await build({ configFile: 'vite.preload.config.ts' });

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

const electron = spawn(electronPath, ['.'], {
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
