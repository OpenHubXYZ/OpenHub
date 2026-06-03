/// <reference types="vite/client" />

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

declare global {
  interface Window {
    theOpenHub?: {
      getAppInfo(): Promise<AppInfo>;
      listLibrarySkills(): Promise<LibrarySkillSummary[]>;
      scanAgentRoots(): Promise<LibraryScanResult>;
      getWorkspaceState(): Promise<DesktopWorkspaceState>;
      importLocalFolder(folderPath: string): Promise<ImportedSkillResult>;
      createInstallPlan(input: {
        skillId: string;
        targetRoot: string;
        agentCode: string;
        agentDisplayName: string;
        adapterVersion: string;
        scope: string;
      }): Promise<InstallPlan>;
      applyInstallPlan(plan: InstallPlan): Promise<InstallResult>;
      scanSkill(skillId: string): Promise<SecurityScanResult>;
      getSyncStartupPlan(): Promise<SyncStartupPlan>;
      getPluginCenterState(): Promise<PluginsState>;
    };
  }
}

export {};
