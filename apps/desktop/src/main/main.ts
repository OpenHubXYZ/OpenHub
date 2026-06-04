import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { PRODUCT_NAME, desktopShellContract } from '@theopenhub/shared';

import { createDesktopRuntime } from './desktop-runtime';
import { runDesktopReleaseSmoke } from './release-smoke';
import { createDesktopTray, type TrayHandle } from './tray';
import { createMainWindowOptions } from './window-options';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

type ElectronModule = typeof import('electron');
type BrowserWindowInstance = InstanceType<ElectronModule['BrowserWindow']>;

const desktopTrays: TrayHandle[] = [];

function resolvePreloadPath(): string {
  return path.join(currentDirectory, '../preload/preload.cjs');
}

function resolveIconPath(): string {
  return path.join(currentDirectory, 'icon.png');
}

function resolveTrayIconPath(): string {
  return path.join(currentDirectory, 'tray-icon.png');
}

function registerIpcHandlers(
  ipcMain: ElectronModule['ipcMain'],
  dataDirectory: string,
  homeDirectory?: string
): void {
  const runtime = createDesktopRuntime({
    dataDirectory,
    ...(homeDirectory ? { homeDirectory } : {})
  });

  for (const contract of Object.values(desktopShellContract)) {
    ipcMain.handle(contract.channel, (_event, payload: unknown) => runtime.dispatch(contract.channel, payload));
  }
}

async function createMainWindow(BrowserWindow: ElectronModule['BrowserWindow']): Promise<BrowserWindowInstance> {
  const mainWindow = new BrowserWindow(createMainWindowOptions(resolvePreloadPath(), resolveIconPath()));
  const showMainWindow = (): void => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  };

  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.webContents.once('did-finish-load', showMainWindow);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return mainWindow;
  }

  await mainWindow.loadFile(path.join(currentDirectory, '../renderer/index.html'));
  return mainWindow;
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
  app.setName(PRODUCT_NAME);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createApplicationWindow(electron, app);
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

    if (isWindowSmokeMode()) {
      const dataDirectory = await resolveReleaseSmokeDataDirectory(process.argv);
      registerIpcHandlers(ipcMain, dataDirectory, process.env.OPENHUB_HOME_DIR);
      app.dock?.setIcon(electron.nativeImage.createFromPath(resolveIconPath()));
      await runWindowSmokeAndExit(electron, app);
      return;
    }

    registerIpcHandlers(
      ipcMain,
      process.env.OPENHUB_DATA_DIR ? path.resolve(process.env.OPENHUB_DATA_DIR) : app.getPath('userData'),
      process.env.OPENHUB_HOME_DIR ? path.resolve(process.env.OPENHUB_HOME_DIR) : undefined
    );
    app.dock?.setIcon(electron.nativeImage.createFromPath(resolveIconPath()));
    await createApplicationWindow(electron, app);
  };

  if (app.isReady()) {
    void start();
  } else {
    app.on('ready', () => {
      void start();
    });
  }
}

async function createApplicationWindow(
  electron: ElectronModule,
  app: ElectronModule['app']
): Promise<BrowserWindowInstance> {
  const mainWindow = await createMainWindow(electron.BrowserWindow);
  desktopTrays.splice(
    0,
    desktopTrays.length,
    createDesktopTray(
      {
        Tray: electron.Tray,
        Menu: electron.Menu,
        nativeImage: electron.nativeImage,
        app,
        platform: process.platform
      },
      {
        iconPath: resolveTrayIconPath(),
        mainWindow
      }
    )
  );
  return mainWindow;
}

function isReleaseSmokeMode(): boolean {
  return process.argv.includes('--release-smoke');
}

function isWindowSmokeMode(): boolean {
  return process.argv.includes('--window-smoke');
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

async function runWindowSmokeAndExit(
  electron: ElectronModule,
  app: ElectronModule['app']
): Promise<void> {
  try {
    const mainWindow = await createApplicationWindow(electron, app);
    await waitForRendererReady(mainWindow);
    await waitForWindowVisible(mainWindow);

    const result = {
      status: 'passed',
      title: mainWindow.getTitle(),
      visible: mainWindow.isVisible(),
      windowCount: electron.BrowserWindow.getAllWindows().length,
      url: mainWindow.webContents.getURL()
    };

    if (result.title !== PRODUCT_NAME) {
      throw new Error(`Expected window title ${PRODUCT_NAME}, received ${result.title}`);
    }
    if (!result.visible) {
      throw new Error('Expected packaged window to be visible');
    }
    if (result.windowCount !== 1) {
      throw new Error(`Expected one packaged window, received ${result.windowCount}`);
    }
    if (!result.url.endsWith('/dist/renderer/index.html')) {
      throw new Error(`Expected packaged renderer URL, received ${result.url}`);
    }

    console.log(JSON.stringify({ windowSmoke: result }));
    app.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    app.exit(1);
  }
}

async function waitForRendererReady(mainWindow: BrowserWindowInstance): Promise<void> {
  const deadline = Date.now() + 15000;
  let lastError = 'renderer did not report a ready state';

  while (Date.now() < deadline) {
    try {
      const readyState = (await mainWindow.webContents.executeJavaScript(
        'document.readyState',
        true
      )) as string;
      if (readyState === 'interactive' || readyState === 'complete') {
        return;
      }
      lastError = `document.readyState=${readyState}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for renderer ready state: ${lastError}`);
}

async function waitForWindowVisible(mainWindow: BrowserWindowInstance): Promise<void> {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
    }
    if (!mainWindow.isDestroyed() && mainWindow.isVisible()) {
      return;
    }

    await delay(100);
  }

  throw new Error('Timed out waiting for packaged window visibility');
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
