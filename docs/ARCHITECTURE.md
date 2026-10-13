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

One TypeScript/React Native codebase (Expo SDK 54). Supported targets: **android**, **windows** and **linux** (Electron shell hosting the web export of the
same `src/`; see `docs/PLATFORM_SUPPORT.md`). Platform adapters are isolated:

- input: `src/game/controls.ts` (pure logic) + touch wiring in `Game.tsx`; a
  keyboard/mouse adapter would feed the same `ControlState`
- rendering: `src/render3d/*` (expo-gl / three.js); simulation in `src/game/world.ts`
  has no rendering or platform imports
- audio: `src/audio/AudioManager.ts` is pure; `src/audio/index.ts` is the expo-audio adapter
- persistence: `src/state/*` (schema/migration are pure; storage is an adapter)
- native packaging: `app.json`, `plugins/` (Android) and `desktop/` (Windows/Linux) plus the CI build only
- desktop: `src/input/*` (action layer), `*.web.ts(x)` adapters, `desktop/` shell (see `desktop/README.md`)

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

## Enforcement: two separate responsibilities

**1. Release authorization** (`scripts/check-source-line.py`, gating). A release is
built from an **explicit, approved, full 40-hex commit SHA** (the `source_sha` input of
the manual dispatch). In `--release` mode it fails unless:

- the checkout `HEAD` is exactly that SHA (a branch name or short SHA is rejected;
  a branch tip is never substituted),
- that SHA is the tip of, or an ancestor of, a branch listed in
  `authoritativeLine.branches` (so recovery/maintenance builds from an earlier
  commit on the line work; commits outside the line are rejected),
- the clone is not shallow (lineage must be provable) and the build ref is not
  forbidden (`working-branch-ocean-spore`).

It never looks at unrelated branches. The manifest step (`release-manifest.mjs`)
additionally proves the **APK's own JS bundle embeds the approved SHA**, and
`--verify-manifest` re-checks that `release-manifest.json` names the same SHA in
the build job and again in the release job before publishing. To change which
branches are authorized (e.g. add `main` after PR #1 merges), edit
`authoritativeLine.branches` in a reviewed commit; no history is rewritten.
Historical SHAs live in `historicalBaselines` as permanent audit evidence only.

**2. Branch audit** (`scripts/audit-branches.py`, reporting). Lists every origin
branch as contained / ledgered / MOVED / UNACCOUNTED and checks the historical
baselines are still reachable. It exits 0 (warnings only; `::warning::` in
Actions) so an unrelated experimental branch can never block a release;
`npm run audit:branches` runs it with `--strict` for periodic development reviews.

Release gates (manifest/permissions, 16 KB, signing identity, runtimeVersion for
OTA) are unchanged, and nothing here adds workflow runs.

## OTA vs native

Unchanged: `eas-update.yml` is manual, CI-gated and requires the current
`runtimeVersion` (2.1.0). Bump `runtimeVersion` for any native/config change. OTA
bundles are built from the same line and carry `otaId` (commit + time) in
`BUILD_INFO`; OTA never creates a second history.

## Branch accounting

See `docs/BRANCH-LEDGER.md`. Do not delete a branch because it looks obsolete.
