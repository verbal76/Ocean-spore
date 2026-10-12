# Steam Deck / Steam Machine checklist (standard v2.0 sec. 12)

Reference: Valve's current pages (steamhardware/recommendations and /compat).
This game has **no desktop or Steam target yet**, so nothing here is implemented
or physically tested. Statuses: NOT STARTED / PENDING (needs hardware or
credentials). Valve Verified status is not claimed.

| # | Requirement | Status | Note |
|---|---|---|---|
| 12.1 | Complete controller functionality, no mandatory mouse/keyboard | NOT STARTED | game is touch-only |
| 12.2 | Automatic Steam on-screen keyboard | NOT STARTED | only text entry is the captain name; needs Steamworks |
| 12.3 | Mixed mouse + joystick input | NOT STARTED | n/a until input adapter exists (the game has no camera look control) |
| 12.4 | Optional camera sensitivity calibration | NOT APPLICABLE | 2D top-down view, no mouse-look camera |
| 12.5 | 1280x800, 16:10, 16:9, other ratios | NOT STARTED | portrait-only today |
| 12.6 | Graphics API (Vulkan preferred) | NOT STARTED | WebGL via expo-gl on Android; desktop path unproven |
| 12.7 | Portable codecs | OK (static) | audio is plain 16-bit WAV, no video |
| 12.8 | Per-device graphics settings | NOT STARTED | no graphics settings exist |
| 12.9 | Offline single-player | PARTIAL (Android) | no network calls in game code; update check fails gracefully (static evidence; untested offline) |
| 12.10 | No external launcher | OK by design | direct launch |
| 12.11 | Steam Deck performance measurements | PENDING hardware | none taken; no claim made |
| 12.12 | Suspend/resume, controller reconnection, extended play | PENDING hardware | Android background/resume handling exists and is unit/E2E-tested on web only |
| 13 | Controller glyph library | NOT STARTED | archive received, licence evidence recorded, nothing imported |
| 11 | Cloud saves | NOT STARTED | save schema is versioned and atomic; Steam Cloud needs Steamworks credentials |
