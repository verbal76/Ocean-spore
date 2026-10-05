# Ocean Spore audio

## State
The recovered game (v40 and earlier) had **no audio at all**: no asset, no
dependency, no code, in any branch or release. Archaeology
(`/docs` history, all 99 commits, builds 5 and 18) found nothing to restore.
The design document asks for "cannon impacts, engine rumble, water splashes,
announcer hype, escalating music".

## What exists now
- 15 one-shot effects + one looping ambient bed (sea swell + engine rumble),
  **original and generated from code**: `python3 scripts/make-audio.py`
  (pure standard library, seeded, deterministic). No third-party audio, no
  licences to track. CI re-generates them and fails if `assets/audio` differs.
- `src/audio/AudioManager.ts` (pure, unit-tested): lazy voice pools, per-sound
  throttling, ambient loop, suspend on pause / harbor / background / loading,
  a persisted mute setting (pause menu: SOUND ON/OFF), and a hard rule that an
  audio failure can never break gameplay.
- The simulation emits events (`fire, hit, explode, explodeBoss, ram, damage,
  boss, pickup, crate, unlock, storm, dock, undock`); the game loop drains
  them into the manager. Game-over and unlock stings and UI taps are played
  from the UI.
- Native module: `expo-audio`. Its library manifest would add RECORD_AUDIO,
  foreground-service permissions and a microphone-type service; all of that is
  stripped (`android.blockedPermissions` + `plugins/with-trim-audio-manifest.js`)
  and `scripts/check-manifest.py` fails the build if any of it reaches the APK.

## Deliberately not done
- **Music** and an "announcer". Needs a licensed or commissioned source; the
  hooks are in place (`SoundId`, ambient channel). Do not import unlicensed
  tracks.
- Haptics (VIBRATE is already declared; the event queue is the hook).

## Owner-feel items (cannot be judged by automation)
Loudness balance, whether the cannon/explosion character fits the game, and
whether the ambient bed is pleasant or fatiguing over a long session.
