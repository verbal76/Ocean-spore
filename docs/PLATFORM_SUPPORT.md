# Platform support (actual state, studio standard v2.0)

The standard requires three targets from one source line: Android APK, Windows
x86-64 (ZIP) and native Linux x86-64 (TAR.GZ, Steam Deck / Steam Machine
suitable). Status as of 2026-10-12 at the time of writing:

| Target | State | Evidence |
|---|---|---|
| Android | **Implemented.** Expo SDK 54 / RN 0.81, `ccr` line, v41 pre-release | `OceanSpore-v41.apk` (SHA-256 `544ebaa2...`), CI-built; **not yet device-tested** |
| Windows x86-64 | **Not implemented** (required by the standard) | no build, no packaging, no adapter in the repo |
| Linux x86-64 | **Not implemented** (required by the standard) | same |

`build --platform android|windows|linux|all` is `APK Build` -> *Run workflow*
(`platform` input). `windows`, `linux` and `all` fail immediately with an explicit
message; nothing is skipped silently.

## Shared vs platform code today

Shared and platform-neutral: `src/game` (world, simulation, TouchController is
pure), `src/state` (save schema/migration), `src/data`, `src/audio/AudioManager`.
Android/RN adapters: touch wiring in `Game.tsx`, `src/render3d` (expo-gl + three),
`src/audio/index.ts` (expo-audio), `src/state/persistence.ts` (expo-file-system),
expo-updates, `app.json`, `plugins/`.

## Feasibility assessment for Windows/Linux (a proposal, NOT started; needs owner approval)

The standard says not to rely on an Android-only architecture without a realistic
desktop path, and to keep the current engine unless it is a major limitation.
Evidence available:

- The JS game already runs in a browser engine: the Expo **web** export was driven
  in Chromium during development (multi-touch and audio end-to-end scripts passed;
  three.js renders through WebGL). That is the same engine Electron embeds, so
  **one codebase -> desktop shell** is plausible.
- Realistic path (recommended): wrap the web export in an **Electron** shell
  (Windows ZIP + Linux TAR.GZ from the same SHA), reusing 100% of `src/game`,
  `src/state`, `src/data`. Steamworks (Steam Input, Cloud, on-screen keyboard)
  via `steamworks.js`. `react-native-windows` is not a path (no Linux).
- Not proven and required first: an Electron package actually launching on
  Windows/Linux (nobody has built it), WebGL performance on Steam Deck hardware,
  and the items below.

Work the standard implies for desktop (all RED until approved; none done):

1. Gamepad + keyboard/mouse input adapter feeding the existing `ControlState`,
   and controller-navigable menus (the game is touch-only today).
2. Controller glyph mapping from the studio `Source.zip` (CC0 1.0 per the pack's
   publisher page; see `docs/ASSET-LICENSES.md`).
3. Landscape layouts: 1280x800 / 16:10 / 16:9. The game is portrait-only today
   (`app.json` orientation); `buildLayout` takes any size but the menus were
   designed for portrait.
4. Desktop persistence: `documentDirectory` is null on web, so saves do not
   persist there today; needs a filesystem/localStorage adapter (same schema).
5. Steam Cloud, offline behaviour, suspend/resume, launcher-free start, graphics
   settings, SteamPipe packaging; all need Steamworks access and hardware.

See docs/STEAM_HARDWARE_CHECKLIST.md for requirement-by-requirement status.
