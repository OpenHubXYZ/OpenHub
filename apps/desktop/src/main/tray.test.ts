import { describe, expect, it, vi } from 'vitest';

import { createDesktopTray } from './tray';

describe('desktop tray', () => {
  it('creates a menu-bar tray for OpenHub with show and quit actions', () => {
    const setTemplateImage = vi.fn();
    const setTitle = vi.fn();
    const setToolTip = vi.fn();
    const setContextMenu = vi.fn();
    const show = vi.fn();
    const focus = vi.fn();
    const quit = vi.fn();
    const menu = { template: [] as unknown[] };
    const dependencies = {
      Tray: vi.fn().mockReturnValue({ setTitle, setToolTip, setContextMenu }),
      Menu: {
        buildFromTemplate: vi.fn((template: unknown[]) => {
          menu.template = template;
          return menu;
        })
      },
      nativeImage: {
        createFromPath: vi.fn().mockReturnValue({ setTemplateImage })
      },
      app: { quit }
    };

    const tray = createDesktopTray(dependencies, {
      iconPath: '/tmp/openhub-tray.png',
      mainWindow: { show, focus }
    });

    expect(dependencies.nativeImage.createFromPath).toHaveBeenCalledWith('/tmp/openhub-tray.png');
    expect(setTemplateImage).toHaveBeenCalledWith(true);
    expect(dependencies.Tray).toHaveBeenCalledWith({ setTemplateImage });
    expect(setTitle).toHaveBeenCalledWith('OpenHub');
    expect(setToolTip).toHaveBeenCalledWith('OpenHub');
    expect(setContextMenu).toHaveBeenCalledWith(menu);

    const labels = menu.template.map((item) => (item as { label?: string }).label);
    expect(labels).toContain('Show OpenHub');
    expect(labels).toContain('Quit OpenHub');
    expect(tray).toBeTruthy();
  });
});
