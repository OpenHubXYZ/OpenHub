import { PRODUCT_NAME } from '@theopenhub/shared';

export interface TrayImage {
  setTemplateImage?(isTemplate: boolean): void;
}

export interface TrayHandle {
  setTitle?(title: string): void;
  setToolTip(text: string): void;
  setContextMenu(menu: unknown): void;
  on?(eventName: 'click', listener: () => void): void;
}

export interface TrayDependencies<Image extends TrayImage = TrayImage> {
  Tray: new (image: Image) => TrayHandle;
  Menu: {
    buildFromTemplate(template: TrayMenuItem[]): unknown;
  };
  nativeImage: {
    createFromPath(path: string): Image;
  };
  app: {
    quit(): void;
  };
  platform?: NodeJS.Platform;
}

export interface TrayWindow {
  show(): void;
  focus(): void;
}

export interface TrayMenuItem {
  label?: string;
  enabled?: boolean;
  type?: 'separator';
  click?: () => void;
}

export function createDesktopTray<Image extends TrayImage>(
  dependencies: TrayDependencies<Image>,
  options: { iconPath: string; mainWindow: TrayWindow }
): TrayHandle {
  const image = dependencies.nativeImage.createFromPath(options.iconPath);

  if ((dependencies.platform ?? process.platform) === 'darwin') {
    image.setTemplateImage?.(true);
  }

  const tray = new dependencies.Tray(image);
  const showMainWindow = (): void => {
    options.mainWindow.show();
    options.mainWindow.focus();
  };

  if ((dependencies.platform ?? process.platform) === 'darwin') {
    tray.setTitle?.(PRODUCT_NAME);
  }
  tray.setToolTip(PRODUCT_NAME);
  tray.setContextMenu(
    dependencies.Menu.buildFromTemplate([
      { label: PRODUCT_NAME, enabled: false },
      { type: 'separator' },
      { label: `Show ${PRODUCT_NAME}`, click: showMainWindow },
      { label: `Quit ${PRODUCT_NAME}`, click: () => dependencies.app.quit() }
    ])
  );
  tray.on?.('click', showMainWindow);

  return tray;
}
