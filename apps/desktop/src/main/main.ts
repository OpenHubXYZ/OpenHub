import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { desktopShellContract } from '@theopenhub/shared';

import { createDesktopRuntime } from './desktop-runtime';
import { runDesktopReleaseSmoke } from './release-smoke';
import { createMainWindowOptions } from './window-options';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

type ElectronModule = typeof import('electron');

function resolvePreloadPath(): string {
  return path.join(currentDirectory, '../preload/preload.cjs');
}

function registerIpcHandlers(ipcMain: ElectronModule['ipcMain'], dataDirectory: string): void {
  const runtime = createDesktopRuntime({ dataDirectory });

  for (const contract of Object.values(desktopShellContract)) {
    ipcMain.handle(contract.channel, (_event, payload: unknown) => runtime.dispatch(contract.channel, payload));
  }
}

async function createMainWindow(BrowserWindow: ElectronModule['BrowserWindow']): Promise<void> {
  const mainWindow = new BrowserWindow(createMainWindowOptions(resolvePreloadPath()));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  await mainWindow.loadFile(path.join(currentDirectory, '../renderer/index.html'));
}

if (isReleaseSmokeMode() && process.env.ELECTRON_RUN_AS_NODE === '1') {
  await runReleaseSmokeAndExit('process');
} else {
  await runElectronApp();
}

async function runElectronApp(): Promise<void> {
  const electronModule = await import('electron');
  const electron = (electronModule.default ?? electronModule) as ElectronModule;
  const { app, BrowserWindow, ipcMain } = electron;

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow(BrowserWindow);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  const start = async (): Promise<void> => {
    if (isReleaseSmokeMode()) {
      await runReleaseSmokeAndExit('electron', app);
      return;
    }

    registerIpcHandlers(ipcMain, app.getPath('userData'));
    await createMainWindow(BrowserWindow);
  };

  if (app.isReady()) {
    void start();
  } else {
    app.on('ready', () => {
      void start();
    });
  }
}

function isReleaseSmokeMode(): boolean {
  return process.argv.includes('--release-smoke');
}

async function runReleaseSmokeAndExit(
  exitMode: 'electron' | 'process',
  app?: ElectronModule['app']
): Promise<void> {
  try {
    const result = await runDesktopReleaseSmoke({
      dataDirectory: await resolveReleaseSmokeDataDirectory(process.argv)
    });
    console.log(JSON.stringify({ releaseSmoke: result }));
    exitReleaseSmoke(exitMode, 0, app);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    exitReleaseSmoke(exitMode, 1, app);
  }
}

function exitReleaseSmoke(
  exitMode: 'electron' | 'process',
  code: number,
  app?: ElectronModule['app']
): void {
  if (exitMode === 'process') {
    process.exit(code);
  }

  if (!app) {
    process.exit(code);
  }

  app.exit(code);
}

async function resolveReleaseSmokeDataDirectory(argv: string[]): Promise<string> {
  const inlineValue = argv
    .find((argument) => argument.startsWith('--smoke-data-dir='))
    ?.slice('--smoke-data-dir='.length);
  if (inlineValue) {
    return path.resolve(inlineValue);
  }

  const argumentIndex = argv.indexOf('--smoke-data-dir');
  const nextValue = argumentIndex >= 0 ? argv[argumentIndex + 1] : undefined;
  if (nextValue) {
    return path.resolve(nextValue);
  }

  return mkdtemp(path.join(tmpdir(), 'theopenhub-release-smoke-'));
}
