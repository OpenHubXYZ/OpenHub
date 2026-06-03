import { contextBridge, ipcRenderer } from 'electron';

import { desktopShellContract, parseIpcResponse } from '@theopenhub/shared';
import type {
  AppInfo,
  DesktopWorkspaceState,
  ImportedSkillResult,
  InstallPlan,
  InstallResult,
  LibraryScanResult,
  LibrarySkillSummary,
  PluginsState,
  SecurityScanResult,
  SyncStartupPlan
} from '@theopenhub/shared';

const api = {
  async getAppInfo(): Promise<AppInfo> {
    const payload = await ipcRenderer.invoke(desktopShellContract.appInfo.channel, {});
    return parseIpcResponse(desktopShellContract.appInfo.channel, payload);
  },

  async listLibrarySkills(): Promise<LibrarySkillSummary[]> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryList.channel, {});
    return parseIpcResponse(desktopShellContract.libraryList.channel, payload);
  },

  async scanAgentRoots(): Promise<LibraryScanResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.libraryScan.channel, {});
    return parseIpcResponse(desktopShellContract.libraryScan.channel, payload);
  },

  async getWorkspaceState(): Promise<DesktopWorkspaceState> {
    const payload = await ipcRenderer.invoke(desktopShellContract.workspaceState.channel, {});
    return parseIpcResponse(desktopShellContract.workspaceState.channel, payload);
  },

  async importLocalFolder(folderPath: string): Promise<ImportedSkillResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.importLocalFolder.channel, { folderPath });
    return parseIpcResponse(desktopShellContract.importLocalFolder.channel, payload);
  },

  async createInstallPlan(input: {
    skillId: string;
    targetRoot: string;
    agentCode: string;
    agentDisplayName: string;
    adapterVersion: string;
    scope: string;
  }): Promise<InstallPlan> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installCreatePlan.channel, input);
    return parseIpcResponse(desktopShellContract.installCreatePlan.channel, payload);
  },

  async applyInstallPlan(plan: InstallPlan): Promise<InstallResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.installApplyPlan.channel, { plan });
    return parseIpcResponse(desktopShellContract.installApplyPlan.channel, payload);
  },

  async scanSkill(skillId: string): Promise<SecurityScanResult> {
    const payload = await ipcRenderer.invoke(desktopShellContract.securityScan.channel, { skillId });
    return parseIpcResponse(desktopShellContract.securityScan.channel, payload);
  },

  async getSyncStartupPlan(): Promise<SyncStartupPlan> {
    const payload = await ipcRenderer.invoke(desktopShellContract.syncStartupPlan.channel, {});
    return parseIpcResponse(desktopShellContract.syncStartupPlan.channel, payload);
  },

  async getPluginCenterState(): Promise<PluginsState> {
    const payload = await ipcRenderer.invoke(desktopShellContract.pluginsCenterState.channel, {});
    return parseIpcResponse(desktopShellContract.pluginsCenterState.channel, payload);
  }
};

contextBridge.exposeInMainWorld('theOpenHub', api);
