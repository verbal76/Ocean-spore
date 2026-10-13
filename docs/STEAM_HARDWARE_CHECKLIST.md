# Steam Deck / Steam Machine checklist (standard v2.0 sec. 12)

Reference: Valve's current pages (steamhardware/recommendations and /compat). Valve Verified
status is not claimed. "Implemented" means code exists and was tested **without** the real
hardware or Steamworks; "Verified" below means exercised in the packaged Linux build under a
virtual display. Everything hardware-dependent stays PENDING until performed.

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 12.1 | Complete controller functionality, no mandatory mouse/keyboard | IMPLEMENTED, pad paths untested on hardware | Title, ship select, captain (roll a name), play, pause, settings (prompts/fullscreen/sound), harbor, game over, quit: all reachable with D-pad/stick + A/B/Start. A fake standard pad drove pause/menu/play in the packaged smoke test |
| 12.2 | Automatic Steam on-screen keyboard | PENDING (Steamworks) | The captain-name screen has its own on-screen keyboard (controller-navigable) and rolls a random name; the Steam keyboard API is not integrated |
| 12.3 | Mixed mouse + joystick input | IMPLEMENTED (n/a for look) | The game has no mouse-look camera; pad and keyboard can be used together (keyboard has priority for movement, fire is OR); mouse never locks out a pad |
| 12.4 | Optional camera sensitivity calibration | NOT APPLICABLE | Top-down view, no mouse-look |
| 12.5 | 1280x800, 16:10, 16:9, other ratios | IMPLEMENTED | Gameplay camera scales so the view never exceeds a phone's extent (unit-tested for 1280x800, 1920x1080, 3440x1440...); menus centered. Screenshots at 1280x800 only; other sizes are by calculation |
| 12.6 | Graphics API (Vulkan preferred) | PENDING | Chromium/ANGLE chooses the backend; Vulkan not confirmed on Deck |
| 12.7 | Portable codecs | OK | 16-bit PCM WAV, no video |
| 12.8 | Per-device graphics settings | NOT STARTED | No graphics settings exist (single fixed quality); device prefs (fullscreen, prompt style) are stored locally and never synced |
| 12.9 | Offline single-player | IMPLEMENTED | The shell loads no remote content; no network code; saves are local. First launch on a fresh Steam account untested |
| 12.10 | No external launcher | OK | Direct launch (Linux wrapper script only adds a flag) |
| 12.11 | Steam Deck performance | PENDING hardware | Only software-GL numbers exist (docs/PLATFORM_SUPPORT.md); no claim made |
| 12.12 | Suspend/resume, controller reconnection, extended play | PARTIAL | Focus loss, hidden window and controller unplug release input and pause (unit-tested); real suspend/resume untested |
| 13 | Controller glyph library | IMPLEMENTED | 78 PNGs imported from `Source.zip` (Xbox/Steam Deck ABXY, PS5, PS4, Switch, keyboard), auto-detected family, manual override in the pause menu, anti-flicker; CC0 evidence = publisher page (`assets/glyphs/LICENSE.md`). Xbox Start/Menu has no glyph in the pack, shown as text |
| 11 | Cloud saves | PENDING (Steamworks) | Save folder is self-contained for a future Cloud path; no Steam API integrated |
| - | Steam Input default configuration | PENDING | Standard-gamepad input works without a Steam Input config; a Valve-reviewed default layout needs a Steamworks App ID |
| - | SteamPipe packaging | PENDING | tar.gz / zip are for GitHub playtests; SteamPipe depots need an App ID and credentials |
