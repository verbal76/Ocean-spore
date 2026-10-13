# Platform support (actual state, studio standard v2.0)

Three targets from one source line (`src/` is shared; nothing is forked):

| Target | Output | Configured | Built (locally) | Launched | Physically tested |
|---|---|---|---|---|---|
| Android | `Ocean Spore Build N APK.apk` | yes (Expo SDK 54) | yes (v41 CI-built) | no | **no** |
| Windows x86-64 | `Ocean Spore Build N EXE.zip` | yes (Electron 44.7.0, `desktop/`) | yes: PE32+ x86-64 executable, 154 MB zip | **no** (no Windows machine) | **no** |
| Linux x86-64 | `Ocean Spore Build N Linux.tar.gz` | yes (same shell) | yes: ELF x86-64, 121 MB tar.gz | **yes**, packaged build, Xvfb + software GL | **no** (no Steam Deck / physical PC) |

`build --platform android|windows|linux|all` is the manual **Native Build** workflow
(`.github/workflows/android-build.yml`, inputs `platform`, `source_sha`, `build_number`,
`destination`). It has never been run on GitHub; each part was validated locally (below).

## How the targets share code

* Shared, platform-neutral: `src/game` (world, simulation, controls math), `src/state`
  (save schema), `src/data`, `src/audio/AudioManager`, `src/render3d` (three.js).
* Platform adapters use Metro's platform extensions, so **Android bundles never include a
  desktop file**: `src/state/persistence(.web).ts`, `src/render3d/assetBytes(.web).ts`,
  `src/platform/{desktopLayer,exit}(.web).ts`, `src/desktop/{PromptBar,MenuFrame}(.web).tsx`.
  Desktop-only branches in shared files (`Game.tsx`, `App.tsx`, `SplashScreen.tsx`,
  `CaptainScreen.tsx`) are guarded by `DESKTOP` (`Platform.OS === 'web'`) or by no-op
  defaults, and Android's behavior is unchanged (`viewScale` is 1; touch controls and
  portrait layout are untouched).
* Desktop input is a shared action layer (`src/input/*`) that feeds the **same** sim fields
  (`dx`, `dy`, `fire`) and tap actions the touch controller feeds; a unit test proves a
  full-deflection key/stick equals a full touch drag.

## Desktop features (implemented and locally verified)

| Area | State |
|---|---|
| Launch in a window, rendering, 15/15 GLB models, audio, clean exit | Verified on the packaged Linux build (smoke test) |
| Keyboard: WASD/arrows move, Space/J fire, E/Q weapon, R auto, F dock, Esc/P pause | Unit-tested + smoke-driven |
| Gamepad (standard mapping, Xbox/PlayStation/Switch/Steam Deck): stick/D-pad, A/RT fire, X/RB weapon, Y/LB auto, B dock, Start pause | Unit-tested with fake pads; **no real controller tested** |
| Controller/keyboard-only menus (focus navigation over every screen, Esc/B back, pause menu) | Keyboard verified in the smoke test; pad paths unit-tested |
| Button prompts from the CC0 glyph pack, auto-detected family, manual override (pause menu), anti-flicker | Glyph rendering seen in screenshots; detection unit-tested |
| Landscape: menus keep their portrait proportion, gameplay camera scaled so the visible field never exceeds a phone's | Unit-tested; screenshots at 1280x800 |
| Saves: durable, atomic, backups, corruption handling, outside the install dir | Unit-tested against real files; save written/read in the packaged smoke test |
| Fullscreen: F11, pause-menu toggle, remembered per device | Implemented; **not exercised under a real window manager** |
| Focus loss / controller unplug while playing: release input and pause | Unit-tested |

## Electron proof-of-concept evaluation (local, Linux, Xvfb + software rendering)

Evidence from `scripts/desktop-smoke.mjs` on the packaged Linux build (Electron 44.7.0 /
Chromium 152). Software GL (SwiftShader) in a virtual display, so frame numbers are a
floor, **not** hardware performance. Nothing here was measured on a Steam Deck.

| Question | Result |
|---|---|
| Launches in a desktop window; same gameplay code, no duplication | Yes: the web export of the shared `src/`; 0 game files in `desktop/` |
| Rendering initialises; assets load | Yes: WebGL context, 15/15 GLB models, colormap, audio files, glyphs, all from `app://` |
| Audio | Initialised (autoplay allowed by the shell); audible output not verifiable here |
| Clean exit; saves flushed | Yes (`exit=0`, save present) |
| Startup | Page loaded in ~0.15-0.25 s; first 3D frames ~1.0-1.3 s after starting a run |
| Frame pacing (software GL, 1280x800) | avg 26-30 ms (33-39 fps), p95 43-56 ms, p99 93-129 ms: dominated by CPU rasterising; real GPUs are far faster, unmeasured |
| Memory (working set, 5 processes) | ~735 MB total, of which ~238 MB is the software GPU process; ~500 MB for browser+renderer+utilities |
| Input | Keyboard and a (fake) standard gamepad both verified through the real renderer; no physical pad |
| Packaging complexity | Low: `@electron/packager` + tar/zip; no installer, no Wine; 121 MB (Linux) / 154 MB (Windows) archives |
| Steam Deck suitability | Plausible (Chromium/ANGLE runs on Vulkan on SteamOS; ~0.5 GB RAM; 2D-ish low-poly scene) but **unproven**: needs real hardware for frame pacing, thermals, battery and suspend/resume |
| Material architectural problem? | None found. Costs: ~120-150 MB per package, Chromium memory, and the Linux launcher's conditional sandbox fallback (sandbox is ON for a normal user; see desktop/README.md) |

**Recommendation:** continue with Electron. Revisit only if real-hardware tests show
unacceptable frame pacing or memory (alternatives would be a Godot/Unity port, which is an
engine migration and needs your approval).

## Not done / needs hardware, credentials or an owner decision

* Windows execution, any physical-device or Steam Deck test, real-GPU frame pacing.
* Steamworks: Steam Input, Steam Cloud, on-screen keyboard, SteamPipe (no App ID or credentials; nothing was faked).
* Windows code signing / SmartScreen reputation; Linux packaging is a plain tar.gz.
* Landscape art direction beyond the centered portrait menu column is an owner aesthetic call.

See `docs/STEAM_HARDWARE_CHECKLIST.md`, `docs/UPDATES.md` and `desktop/README.md`.

## Layout checks (Build 42, Linux packaged app under Xvfb, software rendering)

Run as a non-root user with the Chromium sandbox active (renderer Seccomp: 2).
Window 1280x800 (default) and a 1280x720 display: pause menu and HUD fit with margin, no
clipping. A 1920x1080 display only exercised the default 1280x800 window (the window does not
grow to fill the display); a larger window/fullscreen layout was last viewed in the earlier
round and has NOT been re-verified for Build 42. Gamepad disconnect is covered by unit tests
only. Windows: package structure and PE type verified in CI; **never launched**.
Nothing was tested on physical hardware, and no Steam Deck claim is made.
