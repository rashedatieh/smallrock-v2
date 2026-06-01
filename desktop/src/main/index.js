import { app, BrowserWindow, ipcMain, clipboard, globalShortcut } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  getStore, getApiKey, setApiKey, hasApiKey, sanitizeModeConfigs,
} from './store.js';
import { initShortcut, unregisterAll } from './shortcut.js';
import { captureText, injectText } from './capture.js';
import { warmupKeyboard, shutdownKeyboard } from './keyboard.js';
import { createRewriteStream } from './gemini.js';
import { showOverlay, hideOverlay } from './overlay.js';
import { createTray } from './tray.js';
import { ensureAccessibilityPermission } from './permissions.js';
import { notifyError } from './notify.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const store = getStore();

const MIN_CHARS = 40;
const UNDO_WINDOW_MS = 30000;

// Renderer may only read/write these store keys. The API key is deliberately
// NOT here — it is handled through dedicated, encrypted key:* channels and is
// never returned to the renderer in plaintext (H-1).
const RENDERER_READABLE = new Set(['modeConfigs', 'shortcut', 'launchAtStartup']);
const RENDERER_WRITABLE = new Set(['modeConfigs', 'shortcut', 'launchAtStartup']);

let settingsWin = null;
let activeCancel = null;       // in-flight rewrite stream canceller
let testCancel = null;         // in-flight settings "test" canceller
let isRewriting = false;       // single-flight guard
let isTesting = false;         // single-flight guard for the test button
let undoState = null;          // { original, expiresAt }
let undoTimer = null;

const isDev = !app.isPackaged;

// Single-instance lock so the global shortcut isn't registered twice.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { openSettings(); });
}

app.on('ready', async () => {
  app.setAppUserModelId('com.smallrock.desktop');

  await ensureAccessibilityPermission();

  createTray(openSettings, () => { app.quit(); });

  const shortcut = store.get('shortcut');
  const registered = initShortcut(shortcut, handleRewrite);
  if (!registered) {
    notifyError(`Could not register the ${shortcut} shortcut. Another app may be using it. Change it in Settings.`);
  }

  if (process.platform === 'darwin') app.dock.hide();

  warmupKeyboard();
  openSettings();
});

app.on('window-all-closed', () => {
  // User chose: closing the window fully quits the app (nothing left in tray).
  app.quit();
});

// Full teardown — nothing keeps running once the app quits (C-1).
app.on('before-quit', () => {
  try { activeCancel?.(); } catch {}
  try { testCancel?.(); } catch {}
  activeCancel = null;
  testCancel = null;
  disarmUndo();
  unregisterAll();
  shutdownKeyboard();
});

// ─── Undo (global Esc, only registered while a rewrite is fresh) ──────────────
function armUndo(original) {
  undoState = { original, expiresAt: Date.now() + UNDO_WINDOW_MS };

  globalShortcut.register('Escape', async () => {
    if (!undoState) return;
    const text = undoState.original;
    disarmUndo();
    try {
      await injectText(text);
      showOverlay('Restored', 'info');
      setTimeout(hideOverlay, 1500);
    } catch (err) {
      notifyError('Undo failed: ' + err.message);
    }
  });

  clearTimeout(undoTimer);
  undoTimer = setTimeout(disarmUndo, UNDO_WINDOW_MS);
}

function disarmUndo() {
  undoState = null;
  clearTimeout(undoTimer);
  undoTimer = null;
  try { globalShortcut.unregister('Escape'); } catch {}
}

// ─── Settings window ─────────────────────────────────────────────────────────
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 820,
    height: 680,
    minWidth: 620,
    minHeight: 520,
    title: 'Small Rock — Settings',
    backgroundColor: '#0a0908',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../../dist-electron/preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  lockdownWindow(settingsWin);
  settingsWin.once('ready-to-show', () => settingsWin.show());

  // Only load a remote dev-server URL when genuinely running unpackaged (M-5).
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(process.env.VITE_DEV_SERVER_URL + 'settings/index.html');
  } else {
    settingsWin.loadFile(join(__dirname, '../../dist-electron/renderer/settings/index.html'));
  }

  // Closing the settings window quits the whole app. The overlay is a hidden
  // helper window that would otherwise keep the process alive, so we quit
  // explicitly rather than relying on window-all-closed.
  settingsWin.on('closed', () => {
    settingsWin = null;
    app.quit();
  });
}

// Block any navigation away from local content and deny all window.open (L-1).
function lockdownWindow(win) {
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev && process.env.VITE_DEV_SERVER_URL
      && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!url.startsWith('file://') && !allowed) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// ─── Rewrite flow ─────────────────────────────────────────────────────────────
async function handleRewrite(mode) {
  if (isRewriting) {
    console.log('[SmallRock] already rewriting, ignoring trigger');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    notifyError('No API key set. Opening Settings…');
    openSettings();
    return;
  }

  const modeConfigs = store.get('modeConfigs');
  const config = modeConfigs?.find((c) => c.id === mode) ?? modeConfigs?.[0];
  if (!config) {
    notifyError('Mode configuration not found.');
    return;
  }

  disarmUndo();
  isRewriting = true;
  const prevClipboard = clipboard.readText();
  showOverlay(`${config.name} rewrite…`, 'info');

  let text;
  try {
    text = await captureText(prevClipboard);
  } catch (err) {
    finish();
    notifyError('Could not read the active field: ' + err.message);
    return;
  }

  if (!text || text.trim().length < MIN_CHARS) {
    finish();
    showOverlay(`Type a bit more first (need ${MIN_CHARS}+ chars)`, 'warn');
    setTimeout(hideOverlay, 2500);
    restoreClipboard(prevClipboard);
    return;
  }

  const original = text;
  let accumulated = '';
  const { emitter, cancel } = createRewriteStream(text, config.systemPrompt, apiKey);
  activeCancel = cancel;

  emitter.on('chunk', (chunk) => { accumulated += chunk; });

  emitter.on('done', async () => {
    activeCancel = null;
    if (!accumulated) {
      finish();
      notifyError('Gemini returned an empty response. Try again.');
      restoreClipboard(prevClipboard);
      return;
    }
    try {
      await injectText(accumulated);
      armUndo(original);
      hideOverlay();
      showOverlay('Done — Esc to undo', 'info');
      setTimeout(hideOverlay, 2500);
    } catch (err) {
      notifyError('Could not paste the rewrite: ' + err.message);
    } finally {
      finish();
      restoreClipboard(prevClipboard);
    }
  });

  emitter.on('error', (msg) => {
    activeCancel = null;
    finish();
    notifyError(msg);
    restoreClipboard(prevClipboard);
  });

  function finish() {
    isRewriting = false;
    hideOverlay();
  }
}

function restoreClipboard(prev) {
  setTimeout(() => {
    try { clipboard.writeText(prev); } catch {}
  }, 2000);
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
// Bounded store access — renderer can never read or overwrite the API key here.
ipcMain.handle('store:get', (_event, key) => {
  if (!RENDERER_READABLE.has(key)) throw new Error(`store:get '${key}' not permitted`);
  return store.get(key);
});

ipcMain.handle('store:set', (_event, key, value) => {
  if (!RENDERER_WRITABLE.has(key)) throw new Error(`store:set '${key}' not permitted`);
  if (key === 'modeConfigs') {
    store.set('modeConfigs', sanitizeModeConfigs(value));
  } else {
    store.set(key, value);
  }
});

ipcMain.handle('store:getAll', () => ({
  modeConfigs: store.get('modeConfigs'),
  shortcut:    store.get('shortcut'),
  hasKey:      hasApiKey(),   // boolean only — never the key itself
}));

// Dedicated, encrypted key channels.
ipcMain.handle('key:set', (_event, value) => { setApiKey(value); return { ok: true }; });
ipcMain.handle('key:status', () => ({ hasKey: hasApiKey() }));

// Settings "Save & Test" — uses the stored key in-process; never receives it
// from the renderer. Single-flight + cancellable on quit (M-4).
ipcMain.handle('rewrite:test', async (_event, { text, modeId }) => {
  if (isTesting) return { ok: false, error: 'A test is already running.' };

  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: 'No API key configured.' };

  const modeConfigs = store.get('modeConfigs');
  const config = modeConfigs?.find((c) => c.id === modeId) ?? modeConfigs?.[0];
  if (!config) return { ok: false, error: 'Mode config not found.' };

  // Bound the test input so the renderer can't trigger a huge request.
  const safeText = String(text ?? '').slice(0, 2000);

  isTesting = true;
  return new Promise((resolve) => {
    let accumulated = '';
    const { emitter, cancel } = createRewriteStream(safeText, config.systemPrompt, apiKey);
    testCancel = cancel;
    const settle = (result) => { isTesting = false; testCancel = null; resolve(result); };
    emitter.on('chunk', (c) => { accumulated += c; });
    emitter.on('done', () => settle({ ok: true, text: accumulated }));
    emitter.on('error', (msg) => settle({ ok: false, error: msg }));
  });
});
