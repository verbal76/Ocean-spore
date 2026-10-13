# Android physical-device checklist (Build 42)

Status: **NOT TESTED on a physical phone.** Build 41 and Build 42 have only passed CI,
the manifest/16 KB gates and unit tests. Do not call either validated until this list is done.
Install over Build 39+ (same debug-cert identity `fac61745...3b9c`, package `com.verbal76.oceanspore`).

| # | Check | What to look for | Result |
|---|-------|------------------|--------|
| 1 | Startup | HAG logo, studio card, title screen; no crash, no black screen | |
| 2 | Upgrade | Installs over the previous build; existing save and captain name intact | |
| 3 | Touch movement | Joystick steers smoothly, no stuck direction after lifting a finger | |
| 4 | Firing | Fire button shoots; hold works; no input lag | |
| 5 | Weapon switch | Switching weapons changes the weapon and HUD | |
| 6 | Auto-fire | Toggle works and persists as before | |
| 7 | Docking | Dock/undock, shop and upgrades work, parts are spent correctly | |
| 8 | Pause/resume | Pause menu opens, game is frozen, resume continues exactly | |
| 9 | Audio | Music, effects and the sound toggle work; no stutter | |
| 10 | Save persistence | Force-stop, relaunch: progress, ships, high score are kept | |
| 11 | Background/foreground | Home, wait 30 s, return: game paused or intact, audio sane | |
| 12 | UI readability | HUD and menus legible in portrait on your screen size | |
| 13 | Performance | Steady frame rate in a busy fight; note device model | |

## Known risks introduced by the desktop work (all desktop code is excluded from the APK)

* `src/render3d/assetBytes` was split into native and `.web` variants (model loading path).
* The HUD was refactored into fragments; `Game.tsx` and `App.tsx` have guarded desktop branches.
* The Android bundle grew by about 7.8 KB; `scripts/check-android-isolation.mjs` proves no
  desktop code or glyph assets are in it.
* Dev-dependencies were added (no runtime effect on the APK).

If any item fails, record the device, Android version and what happened, and report it; the
rollback checkpoint is v40 (`e2712522338cc1600d52be9bc78d5e9a293eeae3`).
