# Changelog

All notable changes to Small Rock are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Security

- Upgraded Electron 31 → 42 (current stable; Electron 31 is end-of-life) to pick
  up all upstream Chromium/Node security fixes flagged by Dependabot.
- Upgraded Vite 5 → 7 and `@vitejs/plugin-react` 4 → 5 in both packages,
  resolving the published `vite` and `esbuild` dev-server advisories.
- Upgraded electron-vite 2 → 4 and electron-builder 25 → 26 (pulls a patched
  `tar`, clearing the high-severity transitive alerts).

### Added

- GitHub Actions CI: every push and PR builds the extension (Ubuntu) and the
  desktop app bundle (Windows).
- Dependabot version updates (weekly) for both npm packages and GitHub Actions.

## [2.0.0] — 2026-06-01

The v2 release: a premium UI, multi-mode rewriting, expanded site support, and a
brand-new Windows desktop companion.

### Added

- **Multi-mode rewriting** — tap the shortcut 1× (Quick), 2× (Technical), or 3×
  (Planning); each mode has a fully editable system prompt.
- **Windows desktop app** (`desktop/`) — an Electron tray app that brings Ctrl+M
  prompt rewriting to *any* Windows application via global shortcut and
  clipboard-based capture/replace, with a live overlay and native error
  notifications.
- **Premium UI** — popup and settings rebuilt in React with an animated WebGL2
  shader background and a dark, glassmorphism design system.
- **Configurable modes** — edit each mode's name and system prompt in Settings;
  reset to default per mode.
- **Expanded site support** — 15 AI sites out of the box (ChatGPT, Claude, Gemini,
  Grok, Perplexity, Copilot, Mistral, Poe, You.com, Phind, DeepSeek, Kagi,
  HuggingChat) plus an optional "all sites" permission.

### Security

- Desktop API key **encrypted at rest** via Windows DPAPI (`safeStorage`); never
  returned to the renderer.
- Renderers hardened: `sandbox`, `contextIsolation`, strict CSP, navigation
  lockdown, bounded IPC allowlist.
- **Full teardown on quit** — closing the desktop app aborts in-flight requests,
  unregisters shortcuts, and kills the keyboard host; no orphan processes.
- Strict SendKeys token allowlist — no command-injection path; user text travels
  only through the clipboard.

### Changed

- Extension popup/options migrated from static HTML to a Vite + React build.
- `background.js` / `content.js` remain dependency-free vanilla JS, copied
  verbatim into the build (MV3-safe).

---

## [0.1.0] — initial

- Browser extension: Ctrl+M rewrites the active chat input via Gemini, with
  streaming, in-place replacement, and a 30-second undo window. Supported
  ChatGPT, Claude, and Gemini.
