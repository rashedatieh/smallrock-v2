# Small Rock — Windows Desktop App

An Electron tray app that brings the same Ctrl+M prompt-rewriting experience to
**any** Windows application — Claude desktop, ChatGPT desktop, Notion, VS Code,
your email client, anywhere you can type.

← Back to [main README](../README.md)

---

## Features

- **System-wide shortcut** — Ctrl+M works in any focused Windows app
- **Multi-mode** — ×1 Quick · ×2 Technical · ×3 Planning (tap within 500ms)
- **Clipboard-based capture/replace** — selects the field, rewrites, pastes back, restores your clipboard
- **Live overlay** — a frameless status pill shows progress; native toast notifications on errors
- **Undo** — Esc within 30 seconds restores the original text
- **Editable modes** — name + system prompt per mode, with reset-to-default
- **Encrypted key storage** — API key encrypted at rest via Windows DPAPI (`safeStorage`)
- **Closed = everything off** — quitting tears down every process, shortcut, and request

---

## Requirements

- **Windows 10 or 11**
- **Node.js** 18+ and **pnpm** 9+ (to build/run from source)
- A free [Gemini API key](https://aistudio.google.com/apikey)

---

## Run from source (development)

```bash
cd desktop
pnpm install
pnpm dev
```

`electron-vite` compiles the main/preload/renderer and launches the app with the
Settings window open. Paste your Gemini key, **Save & Test**, then press Ctrl+M in
any app.

> **First run on a fresh clone:** `pnpm install` must be allowed to run the
> `electron` and `esbuild` post-install scripts. This repo's `package.json`
> already lists them under `pnpm.onlyBuiltDependencies`, so a normal
> `pnpm install` works. If your pnpm still prompts, run `pnpm approve-builds`
> once and select both.

---

## Build a distributable app

```bash
cd desktop

# 1. Compile main + preload + renderer
pnpm build:app

# 2. Package an unpacked Windows app (no installer)
pnpm pack:win
#    → dist/win-unpacked/smallrock-desktop.exe

# Or a full NSIS installer + portable exe:
pnpm build
#    → release/  (Small Rock Setup x.y.z.exe, etc.)
```

Run the result:

```
desktop/dist/win-unpacked/smallrock-desktop.exe
```

> The build is **unsigned** by default, so Windows SmartScreen shows
> "Windows protected your PC". Click **More info → Run anyway**. To ship signed
> binaries, provide a code-signing certificate and set `forceCodeSigning: true`
> in `electron-builder.config.js`.

> **Building on Linux/WSL:** the packaging step works, but the final code-signing
> sub-step needs `wine`. Run with `CSC_IDENTITY_AUTO_DISCOVERY=false` — the
> `win-unpacked` app is produced before the signing step, so the `.exe` is fully
> usable even though that last step errors.

---

## Usage

1. Launch the app — the Settings window opens and a tray icon appears
2. Paste your Gemini key → **Save & Test**
3. Switch to any Windows app, click into a text field, type 40+ characters
4. Press **Ctrl+M** (×1 Quick · ×2 Technical · ×3 Planning)
5. The overlay shows progress; the field is replaced with the rewrite
6. **Esc** within 30 seconds to undo

---

## Lifecycle

Small Rock for desktop is designed so **closing the window fully quits the app**:

```
Close window  →  app.quit()  →  Ctrl+M unregistered
                              →  PowerShell keyboard host killed
                              →  any in-flight Gemini request aborted
                              →  zero smallrock-desktop.exe processes remain
```

This is deliberate: when the app is closed, nothing keeps running in the
background. The tradeoff is that the shortcut only works while the app is open —
relaunch the `.exe` to use it again.

To confirm a clean shutdown: Task Manager → Details → there should be **no**
`smallrock-desktop.exe` after you close the window.

---

## How it works

```
Ctrl+M ×N
  └─ shortcut.js     globalShortcut + 500ms multi-tap debounce → mode
  └─ index.js        single-flight guard; save clipboard; show overlay
  └─ capture.js      Ctrl+A, Ctrl+C via the persistent PowerShell host
  └─ gemini.js       stream the rewrite from Gemini (SSE, abortable)
  └─ capture.js      write result to clipboard, Ctrl+A, Ctrl+V
  └─ index.js        arm Esc-undo for 30s; restore clipboard
```

### Why a persistent PowerShell host?

Spawning `powershell.exe` per keystroke costs ~200–500ms each. `keyboard.js`
keeps **one** PowerShell process alive (preloaded with `System.Windows.Forms`)
and streams commands over stdin — so after warmup, keystroke injection is
effectively zero-overhead. The host is warmed at launch, auto-respawns if it
hangs (4s timeout), and dies on stdin-EOF if the app is force-killed (no orphan).

---

## Architecture

| File | Role |
|------|------|
| `src/main/index.js` | App lifecycle, IPC, rewrite orchestration, teardown |
| `src/main/shortcut.js` | Global shortcut + multi-tap debounce |
| `src/main/keyboard.js` | Persistent PowerShell host (warm, serialized, auto-respawn) |
| `src/main/capture.js` | Clipboard capture/inject via the keyboard host |
| `src/main/gemini.js` | Gemini SSE streaming (Node fetch, abortable, 15s timeout) |
| `src/main/store.js` | `electron-store` + encrypted key (DPAPI), mode config sanitizing |
| `src/main/overlay.js` | Frameless always-on-top status pill |
| `src/main/tray.js` | System tray icon + menu |
| `src/main/notify.js` | Native OS error notifications |
| `src/main/permissions.js` | macOS Accessibility prompt (no-op on Windows) |
| `src/preload/*` | Minimal `contextBridge` IPC surface |
| `src/renderer/settings/` | React settings window (key + 3 mode editors) |
| `src/renderer/overlay/` | React status overlay |
| `src/renderer/shared/` | Shared WebGL background + design tokens |

---

## Configuration

Open **Settings** (it opens on launch, or via the tray icon):

- **Gemini API Key** — encrypted at rest; the renderer never reads it back
- **Rewrite Modes** — edit each mode's name + system prompt; **Reset** restores defaults

Stored via `electron-store` in `%APPDATA%\smallrock-desktop\`:

```js
{
  geminiKeyEnc: string,   // DPAPI-encrypted, base64 — never plaintext
  modeConfigs: [{ id, name, systemPrompt }],
  shortcut: 'CmdOrCtrl+M',
  launchAtStartup: boolean
}
```

---

## Tuning

| Want to change | Where |
|----------------|-------|
| Model | `GEMINI_MODEL` in `src/main/gemini.js` |
| Min input length | `MIN_CHARS` in `src/main/index.js` (default 40) |
| Undo window | `UNDO_WINDOW_MS` in `src/main/index.js` (default 30000) |
| Tap window | `TAP_WINDOW_MS` in `src/main/shortcut.js` (default 500) |
| Default prompts | `DEFAULT_MODES` in `src/main/store.js` |
| Capture/paste timing | `SELECT_DELAY_MS` / `COPY_DELAY_MS` in `src/main/capture.js` |

---

## Troubleshooting

**Ctrl+M does nothing** — Make sure the app window is open (closing it quits the
app). Confirm the field has 40+ characters of selectable text. Check Action
Center for any error toast.

**"Could not register the Ctrl+M shortcut"** — Another app holds the global
shortcut. Quit the conflicting app, or change `shortcut` in the store.

**Text isn't captured** — The target app must support Ctrl+A / Ctrl+C in the
focused field. Some custom editors don't; click directly in the text field first.

**Build signing error on WSL/Linux** — Expected; the `.exe` is built before
signing. See [Build a distributable app](#build-a-distributable-app).

**Stuck/old version still responding to Ctrl+M** — A previous instance is still
running. Quit it: Task Manager → end `smallrock-desktop.exe`, or
`taskkill /F /IM smallrock-desktop.exe /T`.

---

← Back to [main README](../README.md) · [Security](../SECURITY.md) · [MIT License](../LICENSE)
