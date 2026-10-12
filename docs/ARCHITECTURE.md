# Architecture: one source of truth

**We are developing ONE GAME that runs on every supported target.** Every change
belongs to one authoritative product history; every supported platform builds from
that history; every abandoned branch is accounted for before valuable work is
discarded. (Standing owner policy; see `CLAUDE.md`.)

## Authoritative line

| | |
|---|---|
| Authoritative development line | `ccr-47defc1a-89uvnr` (PR #1 into `main`) |
| Why not `main` | `main` only ever held a README, the studio logo and workflows. The game itself lived on `working-branch-ocean-spore`, never merged. `main` is a strict ancestor of the line; it receives the game by owner-approved merge of PR #1. |
| Legacy `working-branch-ocean-spore` | Fully contained in the line (0 unique commits). **Never a build/release source**: it auto-publishes OTAs. |
| Machine-readable record | `docs/source-line.json` |

## Targets

One TypeScript/React Native codebase (Expo SDK 54). Currently supported target:
**android**. A Windows or other target has not been requested; if one is added it
must reuse `src/` (game world, progression, save format, audio manager) unchanged
and only add platform adapters. Existing platform seams, all isolated:

- input: `src/game/controls.ts` (pure logic) + touch wiring in `Game.tsx`; a
  keyboard/mouse adapter would feed the same `ControlState`
- rendering: `src/render3d/*` (expo-gl / three.js); simulation in `src/game/world.ts`
  has no rendering or platform imports
- audio: `src/audio/AudioManager.ts` is pure; `src/audio/index.ts` is the expo-audio adapter
- persistence: `src/state/*` (schema/migration are pure; storage is an adapter)
- native packaging: `app.json`, `plugins/`, and the CI build only

A fix to shared logic (`src/game`, `src/state`, `src/data`) applies to all targets
by construction. A fix to an adapter must be evaluated against the other targets.

## Build provenance

Every build records (`scripts/write-build-info.mjs` -> `build-provenance.json` and
the in-app About screen): exact commit SHA, branch/ref, app version + versionCode,
target platform, build configuration, `runtimeVersion`, build time, and
node/expo/react-native/three/expo-updates versions. Releases attach
`release-manifest.json` (`scripts/release-manifest.mjs`): one `sourceCommit` and
the SHA-256 of every platform artifact built from it. A coordinated multiplatform
release uses the same `sourceCommit` for every artifact; a failed platform is
never papered over with a different SHA.

## Enforcement (`scripts/check-source-line.py`)

Runs in `npm run verify`, in `ci.yml`, and before every APK build:

1. fails on a shallow checkout (ancestry cannot be proven; never silently skipped)
2. the built commit must descend from every baseline in `source-line.json`
   (build-39 source, original working-branch tip, pre-resurrection main, v40)
3. the build ref must not be a forbidden ref (`working-branch-ocean-spore`)
4. every remote branch with commits not in the built commit must be in the ledger
   at its recorded tip; a moved or new branch fails until re-audited
5. `release-manifest.mjs` fails if the tree built is not the requested SHA or is dirty

Release gates (manifest/permissions, 16 KB, signing identity, runtimeVersion for
OTA) are unchanged. Cost: the checks are local-first and add seconds to existing
jobs; no new workflow runs.

## OTA vs native

Unchanged: `eas-update.yml` is manual, CI-gated and requires the current
`runtimeVersion` (2.1.0). Bump `runtimeVersion` for any native/config change. OTA
bundles are built from the same line and carry `otaId` (commit + time) in
`BUILD_INFO`; OTA never creates a second history.

## Branch accounting

See `docs/BRANCH-LEDGER.md`. Do not delete a branch because it looks obsolete.
