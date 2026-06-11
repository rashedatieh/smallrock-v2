# Contributing to Small Rock

Thanks for your interest in Small Rock.

## Contribution policy

Small Rock is an **owner-maintained project**. It is open source under the
[MIT License](LICENSE), so you are free to **use, download, run, fork, and modify**
it for your own purposes.

**Contributions to this repository, however, are accepted by the maintainer's
invitation/permission only.**

- ✅ **Use it, download it, fork it, build your own version** — all permitted by the MIT license.
- 💬 **Found a bug or have an idea?** Open an [issue](../../issues) to discuss it first.
- 🔒 **Please do not open unsolicited pull requests.** Changes are reviewed and merged
  only by the maintainer ([@rashedatieh](https://github.com/rashedatieh)), and only
  after the change has been agreed in an issue. Drive-by or unsolicited PRs may be
  closed without review.
- 🔑 **Direct push access is restricted to the maintainer.** All merges require the
  maintainer's approval (see [`.github/CODEOWNERS`](.github/CODEOWNERS)).

If you'd like to contribute, reach out via an issue first — thank you for respecting this.

---

## Project layout

This is a monorepo with two independent packages:

- **`extension/`** — Manifest V3 browser extension (Vite + React + vanilla MV3 scripts)
- **`desktop/`** — Electron desktop companion (electron-vite + React)

Each has its own `package.json` and is built independently. See each package's
`README.md` for build and run instructions.

---

## Prerequisites

- Node.js 18+
- pnpm 9+
- A free [Gemini API key](https://aistudio.google.com/apikey) for manual testing

---

## Getting started

```bash
# Extension
cd extension && pnpm install && pnpm build

# Desktop
cd ../desktop && pnpm install && pnpm dev
```

---

## Development guidelines

- **Keep it small.** Prefer the simplest solution that works. No new dependency
  unless it clearly earns its place — the extension's MV3 scripts are intentionally
  dependency-free.
- **Match the surrounding style.** Vanilla JS stays vanilla; React stays React.
  Follow existing naming, comment density, and file organization.
- **Immutability and explicit error handling** are preferred throughout.
- **Security is a feature.** Never introduce a path where user text enters a shell
  command, never load remote content into a renderer, never weaken
  `contextIsolation`/`sandbox`/CSP. See [SECURITY.md](SECURITY.md).
- **Files stay focused** — extract modules rather than growing large files.

---

## The fragile parts (read before touching)

- **Extension text injection** — `extension/public/content.js` `replaceText`.
  Three editor families, three strategies. Test on ChatGPT (React), Claude
  (ProseMirror), and Gemini (contenteditable) before changing.
- **Desktop keyboard host** — `desktop/src/main/keyboard.js`. The persistent
  PowerShell process and its serialized command protocol. Keep the SendKeys token
  allowlist strict.
- **Teardown path** — `desktop/src/main/index.js` `before-quit`. Everything must
  be cancelled/unregistered on quit.

---

## Testing your change

There is no automated test suite yet; verify manually:

**Extension**
1. `pnpm build`, reload at `chrome://extensions`
2. Test all three tap modes on at least ChatGPT, Claude, and Gemini
3. Confirm Esc/Ctrl+Z undo works
4. Check the DevTools console for `[SmallRock]` errors

**Desktop**
1. `pnpm dev`
2. Test all three tap modes in a real Windows app
3. Confirm closing the window leaves zero `smallrock-desktop.exe` processes
4. Confirm errors surface as native notifications

---

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Planning mode keyboard hint to popup
fix: restore clipboard after failed inject
docs: clarify desktop build on WSL
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

---

## Pull requests

> Per the **Contribution policy** above, only open a PR after the change has been
> agreed with the maintainer in an issue. Unsolicited PRs may be closed.

Once a change is agreed:

1. Branch from `main`
2. Keep the PR focused on one change
3. Describe what changed and how you tested it
4. Update the relevant README / CHANGELOG if behavior changed

---

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE).
