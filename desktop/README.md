# Ocean Spore desktop shell (Windows x86-64 / native Linux x86-64)

An [Electron](https://www.electronjs.org/) shell that hosts the **unmodified game**: the same
`src/` that builds the Android APK is exported with `expo export --platform web` and loaded
from `app://game/`. There is no second implementation of the game; this folder contains
only the host (`main.js`, `preload.js`, `lib/`).

## Layout

| File | Role |
|---|---|
| `main.js` | The only privileged code: window, `app://` protocol, IPC, quit/flush. |
| `preload.js` | Frozen `window.hotAttic` bridge: save, prefs, fullscreen, quit, info. |
| `lib/saveStore.js` | Atomic, serialized save storage (tested in `src/__tests__/desktopSaves.test.ts`). |
| `lib/prefs.js` | Per-device preferences (fullscreen, button-prompt style); never part of the save. |
| `lib/paths.js` | Maps `app://` requests to files inside the export; rejects traversal. |
| `lib/smoke.js` | Launch smoke test used by `scripts/desktop-smoke.mjs`. |

## Security model

* `contextIsolation`, `sandbox`, no `nodeIntegration`; the page has no Node, `require`, or `process.versions.node`.
* Content Security Policy on every response: `default-src 'none'`, scripts/styles/images/media/connect from the app origin only. **No remote content is ever loaded**: the game is offline.
* All permission requests are denied; navigation away from `app://game/` and `window.open` are blocked.
* IPC handlers re-check that the sender frame is `app://game/…`; save payloads are validated as JSON of bounded size.
* Linux builds start through `ocean-spore.sh`, which keeps Chromium's sandbox ON. It falls back to `--no-sandbox` (with the reason on stderr) only when `OCEAN_SPORE_NO_SANDBOX=1`, when running as root (Chromium refuses its sandbox as root), or when there is no setuid `chrome-sandbox` and unprivileged user namespaces are unavailable. `OCEAN_SPORE_SANDBOX=required` makes it exit 78 instead of falling back; `OCEAN_SPORE_DRY_RUN=1` prints the decision. Verified: as a non-root user the packaged app runs with the renderer under seccomp (Seccomp: 2). Not verified: whether Steam's container permits user namespaces on a Deck. Alternative if it does not: ship `chrome-sandbox` setuid root (needs a root-owned install) or accept the documented fallback.

## Saves (documented locations and format)

* Same JSON schema and migration as Android (`src/state/saveSchema.ts`, schema version 2). The main process stores text; the renderer parses it, so the schema lives in one place.
* Location (per-user data directory, **outside the install directory**, untouched by updates):
  * Windows: `%APPDATA%\Ocean Spore\saves\ocean-spore-save.json`
  * Linux: `~/.config/Ocean Spore/saves/ocean-spore-save.json`
* Writes are `*.tmp` -> `fsync` -> rename, keeping the previous good file as `*.bak`; load order main -> `.bak`; a damaged file with no usable backup is moved to `*.corrupt`, never overwritten.
* Device preferences live beside it in `desktop-prefs.json` and are **never** synced (a future Steam Cloud must sync only `saves/`).
* Steam Cloud: **not implemented** (needs Steamworks credentials); the save directory is a single self-contained folder so a Cloud auto-cache path can point at it later.

## Steam / launching

* Linux: launch `ocean-spore.sh` (a Steam "non-Steam game" shortcut for Deck testing should point at it). Add `--fullscreen` for kiosk-style launch; F11 or the pause-menu toggle switches modes and the choice is remembered per device.
* `--smoke=<dir>` runs the automated launch test and exits; it is used only by `scripts/desktop-smoke.mjs` and writes only to the directory it is given.
* There is no Steamworks integration yet (no App ID or credentials): no Steam Input, Cloud, overlay keyboard or SteamPipe.

## Build and run locally

```
npm ci && npm ci --prefix desktop
node scripts/desktop-package.mjs --platform linux --out dist-desktop     # or windows | all
node scripts/desktop-smoke.mjs --packaged "dist-desktop/packages/Ocean Spore-linux-x64"
```

Produces `Ocean Spore Build N Linux.tar.gz` / `Ocean Spore Build N EXE.zip`. The smoke test
needs `xvfb` on a headless machine and uses software rendering, so its frame times show that
it works, not hardware performance.
