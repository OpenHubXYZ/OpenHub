/// <reference types="vite/client" />

import type { AppInfo, LibrarySkillSummary } from '@theopenhub/shared';

declare global {
  interface Window {
    theOpenHub?: {
      getAppInfo(): Promise<AppInfo>;
      listLibrarySkills(): Promise<LibrarySkillSummary[]>;
    };
  }
}

export {};
