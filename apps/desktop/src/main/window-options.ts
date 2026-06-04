import type { BrowserWindowConstructorOptions } from 'electron';
import { PRODUCT_NAME } from '@theopenhub/shared';

export function createMainWindowOptions(preloadPath: string, iconPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f7f8fb',
    title: PRODUCT_NAME,
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}
