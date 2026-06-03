import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appInfo, desktopShellContract, parseIpcRequest } from '@theopenhub/shared';

import { createMainWindowOptions } from './window-options';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

function resolvePreloadPath(): string {
  return path.join(currentDirectory, '../preload/preload.cjs');
}

function registerIpcHandlers(): void {
  ipcMain.handle(desktopShellContract.appInfo.channel, (_event, payload: unknown) => {
    parseIpcRequest(desktopShellContract.appInfo.channel, payload);
    return appInfo;
  });
}

async function createMainWindow(): Promise<void> {
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

registerIpcHandlers();

await app.whenReady();
await createMainWindow();

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
