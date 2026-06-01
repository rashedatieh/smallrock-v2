# Small Rock — Browser Extension

A Manifest V3 browser extension that rewrites your rough prompts into structured,
AI-ready prompts before you send them. Press **Ctrl+M** in any supported chat box.

← Back to [main README](../README.md)

---

## Features

- **Multi-mode** — Ctrl+M ×1 Quick · ×2 Technical · ×3 Planning (tap within 500ms)
- **15 supported sites** out of the box, plus optional "all sites" permission
- **In-place rewriting** with live streaming and an 80ms-throttled smooth reveal
- **Undo** — Esc or Ctrl+Z within 30 seconds
- **Editable modes** — name + system prompt per mode, with reset-to-default
- **Dark, animated UI** — WebGL2 shader background, glassmorphism settings page
- **Privacy-first** — your own Gemini key, stored in `chrome.storage.local`, no telemetry

---

## Supported sites

ChatGPT (`chatgpt.com`, `chat.openai.com`), Claude (`claude.ai`), Gemini
(`gemini.google.com`), Grok (`grok.com`, `x.com/i/grok`), Perplexity, Copilot,
Mistral, Poe, You.com, Phind, DeepSeek, Kagi Assistant, HuggingChat.

Need another site? Grant the optional "on all sites" permission at
`chrome://extensions` → Small Rock → **Details** → **Site access** → **On all sites**.

---

## Build & install (development)

**Requirements:** Node.js 18+, pnpm 9+.

```bash
cd extension
pnpm install
pnpm build          # outputs to extension/dist/
```

Then load it:

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`)
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `extension/dist/` folder
5. The Settings page opens automatically — paste your [Gemini key](https://aistudio.google.com/apikey) and click **Save & Test**

For iterative development, use watch mode and click the reload icon on the
extension card after changes:

```bash
pnpm dev            # vite build --watch
```

---

## Usage

1. Open any supported AI site
2. Click into the chat input and type a rough prompt (40+ characters)
3. Press **Ctrl+M** (Win/Linux) or **Cmd+M** (Mac)
   - Tap **once** → Quick · **twice** → Technical · **three times** → Planning
4. The text is replaced in place as it streams in (~1–2s)
5. Press **Send**
6. To undo: **Esc** or **Ctrl+Z** within 30 seconds

---

## How text replacement works

Three injection strategies, chosen by editor type:

| Editor | Sites | Strategy |
|--------|-------|----------|
| React-controlled `<textarea>` | ChatGPT | Native prototype `value` setter + dispatched `input`/`change` so React's controlled component updates |
| ProseMirror | Claude | `document.execCommand('insertText')` to fire a real `beforeinput` the editor consumes |
| Generic `contenteditable` | Gemini & others | Same `execCommand` path → synthetic `paste` → `textContent` fallback |

This is the most framework-sensitive part of the codebase. See
[`public/content.js`](public/content.js) (`replaceText`).

---

## Architecture

| File | Role |
|------|------|
| `public/manifest.json` | MV3 manifest — permissions, content-script matches, `Ctrl+M` command |
| `public/background.js` | Service worker — multi-tap router, Gemini SSE streaming + one-shot fallback (vanilla, zero deps) |
| `public/content.js` | Shortcut handler, editor detection, text injection, undo, toast (vanilla) |
| `src/popup/` | React toolbar popup — status + mode chips |
| `src/options/` | React settings page — API key + 3 mode editors |
| `src/shared/` | `WebGLBackground.jsx`, `defaults.js` (default prompts), `tokens.css` |
| `vite.config.js` | Multi-page build; `public/` copied verbatim, `src/` bundled |

**Why `background.js` / `content.js` live in `public/`:** MV3 service workers and
content scripts run in restricted contexts. Keeping them as plain vanilla JS
(copied verbatim by Vite, never bundled) avoids module/CSP pitfalls. Only the
popup and options UI are React, bundled by Vite.

### Message flow

```
Ctrl+M ×N ─► background.js (debounce 500ms → mode)
          ─► chrome.tabs.sendMessage(TRIGGER_REWRITE, mode)
          ─► content.js: capture text, open Port "rewrite-stream"
          ─► background.js: fetch Gemini SSE, stream CHUNK messages
          ─► content.js: accumulate, throttled replaceText, DONE → save undo
```

---

## Configuration

Open the extension **Settings** (popup → Settings, or the options page):

- **Gemini API Key** — paste, then **Save** or **Save & Test**
- **Rewrite Modes** — edit each mode's name + system prompt; **Ctrl+Enter** saves; **Reset to default** restores

Stored in `chrome.storage.local`:

```js
{
  geminiKey: string,
  modeConfigs: [{ id: 1|2|3, name: string, systemPrompt: string }]
}
```

---

## Tuning

| Want to change | Where |
|----------------|-------|
| Model | `GEMINI_MODEL` in `public/background.js` (`gemini-2.5-flash` default) |
| Min input length | `MIN_CHARS` in `public/content.js` (default 40) |
| Undo window | `UNDO_WINDOW_MS` in `public/content.js` (default 30000) |
| Tap window | `TAP_WINDOW_MS` in `public/background.js` (default 500) |
| Default prompts | `src/shared/defaults.js` (and the inlined copy in `background.js`) |
| Shortcut | `manifest.json` → `commands` + rebind at `chrome://extensions/shortcuts` |

Reload the extension at `chrome://extensions` after editing `public/` files.

---

## Troubleshooting

**Nothing happens on Ctrl+M** — Most common cause: the extension was loaded while
the tab was already open. Hard-refresh the tab (`Ctrl+Shift+R`), click into the
input, type 40+ chars, try again.

**Verify the content script loaded** — Open DevTools (F12) → Console → refresh.
You should see `[SmallRock] content script loaded on …`.

**Shortcut not bound** — Visit `chrome://extensions/shortcuts`; if `Ctrl+M` is
blank or taken, rebind it there.

**"No API key set"** — Open Settings, paste your key, Save.

**"Gemini 400: API_KEY_INVALID"** — Generate a fresh key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey).

**Text appears but Send stays disabled** — The site's framework didn't pick up the
change. Open an issue with any `[SmallRock]` console lines and the focused
element's HTML.

---

← Back to [main README](../README.md) · [Security](../SECURITY.md) · [MIT License](../LICENSE)
