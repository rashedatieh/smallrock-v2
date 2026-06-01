# Security

Small Rock is built privacy-first. This document describes the threat model, the
security posture of both products, and the results of the internal security
audit performed for v2.

---

## Reporting a vulnerability

If you discover a security issue, please **do not open a public issue**. Email the
maintainer with details and reproduction steps, and allow reasonable time for a
fix before public disclosure.

---

## Privacy guarantees

- **One network destination.** The only outbound network call in the entire
  codebase is to `https://generativelanguage.googleapis.com` (Google's Gemini
  API). There are no other servers, ever.
- **No telemetry, analytics, crash reporting, or auto-update phone-home.**
- **Your text is never stored or logged** beyond the in-memory undo buffer.
- **Your API key never leaves your machine** except as the authenticated
  parameter on the Gemini request you initiate.

---

## Where your API key lives

| Product | Storage | Protection |
|---------|---------|------------|
| Browser extension | `chrome.storage.local` | Per-browser, never synced; sandboxed to the extension origin |
| Windows desktop | `electron-store` (`%APPDATA%`) | **Encrypted at rest** with Windows DPAPI via Electron `safeStorage`; never returned to the renderer in plaintext |

---

## Desktop app threat model & hardening

The desktop app interacts with other applications (clipboard + simulated
keystrokes), so it received the most scrutiny. Audit verdict: **no backdoors, no
command-injection path, full teardown on close.**

### Verified properties

- **No command injection.** Your text travels **only** through the OS clipboard
  (`clipboard.readText` / `writeText`). It never enters a shell command string.
  The only values interpolated into the PowerShell host are a strict allowlist of
  SendKeys tokens (`^a`, `^c`, `^v`) — validated before use, so injection is
  impossible by construction.
- **Full teardown on quit.** `before-quit` aborts any in-flight Gemini request,
  cancels in-flight test calls, disarms the undo shortcut, unregisters all global
  shortcuts, and kills the PowerShell keyboard host. The host also exits on
  stdin-EOF if the app is force-killed, so no orphan process survives. Closing
  the window quits the app entirely.
- **Encrypted secret at rest.** The Gemini key is encrypted with DPAPI; the
  legacy plaintext value (if any) is migrated and scrubbed on first read.
- **Hardened renderers.** Both windows run with `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true`. A strict Content-Security-Policy
  (`script-src 'self'`, `object-src 'none'`, `base-uri 'none'`) is set on every
  renderer page. `will-navigate` and `setWindowOpenHandler` block any navigation
  away from local content.
- **Bounded IPC.** The preload exposes a minimal `contextBridge` surface. The
  renderer can read/write only allowlisted store keys
  (`modeConfigs`, `shortcut`, `launchAtStartup`) and can never read the API key
  back — it only learns whether one exists.
- **No remote content in production.** The dev-server URL is gated behind
  `app.isPackaged`, so a packaged build never loads a remote URL even if an
  environment variable is injected.
- **Input clamping.** System prompts are length-capped and test inputs are bounded
  to prevent pathological API usage.

### Known limitations / recommendations

- **Electron version.** The app currently pins Electron 31. Those renderer CVEs
  are exploited through malicious *web* content; this app loads only local,
  sandboxed, CSP-locked content with no remote navigation, so they are not
  practically exploitable in this threat model. Upgrading to the latest Electron
  stable is nonetheless the recommended hardening follow-up.
- **Code signing.** Distributed binaries are unsigned by default (SmartScreen
  will warn). For wider distribution, sign with an OV/EV certificate and enable
  `forceCodeSigning`.
- **Build-time dependencies.** Some `electron-builder` transitive dev-dependencies
  carry advisories that apply only during packaging, not to the shipped app.

---

## Browser extension posture

- **Permissions:** `storage` only, plus host access to the Gemini API. Content
  scripts run on an explicit list of AI sites; universal access is **optional**
  and user-granted.
- **No `innerHTML`, no `eval`, no dynamic script injection.** Rewritten text is
  written as text (`insertText` / value setter), never as HTML.
- **No third-party JavaScript.** The service worker and content script are
  dependency-free vanilla JS; only the settings/popup UI uses React (bundled
  locally, never loaded from a CDN).

---

## Responsible use

Small Rock sends whatever text is in your focused field to Google's Gemini API
when you press the shortcut. Don't trigger it on text you aren't comfortable
sending to Google under [their API terms](https://ai.google.dev/gemini-api/terms).
