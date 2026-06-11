import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const isDev = !app.isPackaged;

let overlayWin = null;

export function getOrCreateOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWin = new BrowserWindow({
    width: 300,
    height: 80,
    x: width - 320,
    y: height - 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../../dist-electron/preload/overlay.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlayWin.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev && process.env.VITE_DEV_SERVER_URL
      && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!url.startsWith('file://') && !allowed) event.preventDefault();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    overlayWin.loadURL(process.env.VITE_DEV_SERVER_URL + 'overlay/index.html');
  } else {
    overlayWin.loadFile(join(__dirname, '../../dist-electron/renderer/overlay/index.html'));
  }

  overlayWin.on('closed', () => { overlayWin = null; });

  return overlayWin;
}

export function showOverlay(message, kind = 'info') {
  const win = getOrCreateOverlay();
  win.webContents.send('overlay:update', { message, kind });
  win.showInactive();
}

export function hideOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.hide();
  }
}
