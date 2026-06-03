import { contextBridge, ipcRenderer } from 'electron';

import { desktopShellContract, parseIpcResponse } from '@theopenhub/shared';
import type { AppInfo } from '@theopenhub/shared';

const api = {
  async getAppInfo(): Promise<AppInfo> {
    const payload = await ipcRenderer.invoke(desktopShellContract.appInfo.channel, {});
    return parseIpcResponse(desktopShellContract.appInfo.channel, payload);
  }
};

contextBridge.exposeInMainWorld('theOpenHub', api);
