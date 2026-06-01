import { globalShortcut } from 'electron';

const TAP_WINDOW_MS = 500;
let tapCount = 0;
let tapTimer = null;

export function initShortcut(shortcutKey, onReady) {
  const registered = globalShortcut.register(shortcutKey, () => {
    tapCount += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      const mode = Math.min(tapCount, 3);
      tapCount = 0;
      onReady(mode);
    }, TAP_WINDOW_MS);
  });

  if (!registered) {
    console.warn('[SmallRock-desktop] Failed to register shortcut:', shortcutKey);
  } else {
    console.log('[SmallRock-desktop] Shortcut registered:', shortcutKey);
  }

  return registered;
}

export function unregisterShortcut(shortcutKey) {
  globalShortcut.unregister(shortcutKey);
}

export function unregisterAll() {
  globalShortcut.unregisterAll();
}
