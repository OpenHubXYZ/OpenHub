import { contextBridge, ipcRenderer } from 'electron';

import { desktopShellContract, parseIpcResponse } from '@theopenhub/shared';
import type { AppInfo, LibrarySkillSummary } from '@theopenhub/shared';

const api = {
  async getAppInfo(): Promise<AppInfo> {
    const payload = await ipcRenderer.invoke(desktopShellContract.appInfo.channel, {});
    return parseIpcResponse(desktopShellContract.appInfo.channel, payload);
  },

  async listLibrarySkills(): Promise<LibrarySkillSummary[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryList.channel, {});
    return parseIpcResponse(desktopShellContract.libraryList.channel, payload);
  }
};

contextBridge.exposeInMainWorld('theOpenHub', api);
