import { clipboard } from 'electron';
import { sendKeySequence } from './keyboard.js';

// Capture/inject text in the currently-focused Windows app via clipboard.
// All keystrokes go through the persistent PowerShell host (keyboard.js),
// so each operation is a single warm stdin round-trip — no process spawn.

const SELECT_DELAY_MS = 60;   // let the app register Ctrl+A before we copy/paste
const COPY_DELAY_MS   = 90;   // let the OS clipboard populate after Ctrl+C

/**
 * Selects all text in the focused field and returns it.
 * Returns '' if nothing was captured (app didn't support it / empty field).
 * @param {string} prevClipboard - clipboard contents to compare against
 */
export async function captureText(prevClipboard) {
  await sendKeySequence([
    { keys: '^a', delayAfterMs: SELECT_DELAY_MS },
    { keys: '^c', delayAfterMs: COPY_DELAY_MS },
  ]);

  const captured = clipboard.readText();
  if (!captured || captured === prevClipboard) return '';
  return captured;
}

/**
 * Replaces the focused field's contents with `text` via clipboard paste.
 */
export async function injectText(text) {
  clipboard.writeText(text);
  // Small settle so the clipboard write lands before paste.
  await new Promise((r) => setTimeout(r, 40));

  await sendKeySequence([
    { keys: '^a', delayAfterMs: SELECT_DELAY_MS },
    { keys: '^v', delayAfterMs: 60 },
  ]);
}
