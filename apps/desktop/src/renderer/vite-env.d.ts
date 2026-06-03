/// <reference types="vite/client" />

import type { AppInfo } from '@theopenhub/shared';

declare global {
  interface Window {
    theOpenHub?: {
      getAppInfo(): Promise<AppInfo>;
    };
  }
}

export {};
