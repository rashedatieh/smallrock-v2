import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let tray = null;

export function createTray(openSettings, quit) {
  const iconPath = join(__dirname, '../../src/assets/icons/tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // Fallback: 1×1 transparent pixel so Tray doesn't throw
    icon = nativeImage.createEmpty();
  }
  const trayIcon = process.platform === 'darwin'
    ? icon.resize({ width: 22, height: 22 })
    : icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Small Rock — Prompt Rewriter');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Small Rock',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: openSettings,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: quit,
    },
  ]);

  tray.setContextMenu(menu);

  if (process.platform !== 'darwin') {
    tray.on('double-click', openSettings);
  }

  return tray;
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
