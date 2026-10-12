# Ocean Spore: standing project instructions

Hot Attic Games, Android (Expo SDK 54 / RN 0.81, legacy architecture). Package
`com.verbal76.oceanspore`. Version = `package.json` -> `oceanSpore.build`
(versionCode = versionName). Release names follow the studio standard:
`Ocean Spore Build <N> APK.apk`, release `Ocean Spore Build <N>`, tag `build-<N>`.
Rollback
checkpoint: v40 = `e2712522338cc1600d52be9bc78d5e9a293eeae3`.

## Studio standard

`docs/HOT_ATTIC_GAMES_MASTER_STANDARD.md` (v2.0, extracted from the owner's .doc) is
the studio-wide contract: three platforms (Android, Windows, Linux) from one source
line, one build number, one GitHub Release, Steam Deck/Machine requirements, safe
updates, no accidental publishing. Project-specific restrictions below still win.
Doc map (equivalents of the standard's required files): `docs/PLATFORM_SUPPORT.md`,
`docs/UPDATES.md`, `docs/RELEASING.md` (= RELEASES), `docs/STEAM_HARDWARE_CHECKLIST.md`,
`docs/BRANCH-LEDGER.md`, `docs/ASSET-LICENSES.md` + `docs/THIRD-PARTY-LICENSES.md`
(= THIRD_PARTY_ASSETS). **Windows and Linux are required by the standard and are
NOT implemented**: adding them (engine/shell, input adapters, glyphs, Steam) is a
major scope change that needs explicit owner approval.

## GitHub Actions budget policy (STANDING OWNER DIRECTIVE)

Actions minutes are shared across the owner's projects and the monthly budget is
small. Before starting any hosted workflow ask: *does this need GitHub Actions,
or can I prove it locally?*

- Validate locally first: `npm run verify` (brand, audio drift, typecheck, asset
  integrity, lint, tests, version). Also `npx expo export --platform android`
  when bundling is in doubt. Debug locally, never by re-running CI.
- Nothing runs automatically on push or PR update. `android-build.yml` starts only
  on `workflow_dispatch` (inputs: platform, source_sha, build_number, destination) or
  the `publish-apk` PR label; `ci.yml` is called by the
  build and OTA workflows (and manual dispatch); `prune-artifacts.yml` is manual.
- Docs/research/bookkeeping changes use zero Actions minutes.
- Do not build an APK/AAB/EXE unless it is genuinely needed for physical testing
  or release. Do not rebuild the same SHA when a verified artifact exists. Do not
  re-run a workflow just to see whether a failure was intermittent.
- Appropriate uses: final validation of a release candidate, the APK the owner
  needs, OTA publication and its gates, platform-specific checks that cannot be
  reproduced locally.
- Release safety is NOT negotiable to save minutes: the manifest/permission gate,
  16 KB gate, signing identity check and runtimeVersion confirmation stay.
- Keep it cheap: path filters, `concurrency` cancellation, npm cache, short
  artifact retention. Batch fixes locally into one push before triggering a build.

## Release and OTA rules

- Never publish to Google Play. Never publish an OTA unless the owner explicitly
  authorizes it (`eas-update.yml` is manual, CI-gated, requires the runtimeVersion).
- Do NOT use or merge into `working-branch-ocean-spore` (it auto-publishes OTAs).
- Bump `runtimeVersion` in `app.json` whenever native code/config changes
  (currently 2.1.0).
- GitHub Releases are pre-release internal APKs, published only when authorized.
- Signing: the historical debug certificate (`fac61745...3b9c`) preserves upgrades
  over build-39. Do not rotate it casually; production signing is recorded debt.
- Preserve: target SDK 36, 16 KB compatibility, adaptive icon, trimmed
  permissions (see `scripts/check-manifest.py`), stable package id, and the HAG
  launch flow (canonical logo SHA is enforced by `scripts/check-brand.py`).
- Environment quirk: the session integration token cannot dispatch workflows or
  push tags; the `publish-apk` label (clear, then re-add) is the working trigger.

## One authoritative source (STANDING OWNER POLICY)

We are developing ONE GAME that runs on every supported target (currently Android).
One authoritative, continuously integrated codebase; platforms are build targets,
not versions. Full detail: `docs/ARCHITECTURE.md`; machine-readable record:
`docs/source-line.json`; branch accounting: `docs/BRANCH-LEDGER.md`.

- Authoritative line: `ccr-47defc1a-89uvnr` (PR #1 into `main`). Branches are
  temporary workspaces for isolating changes; they must start from the line, have a
  purpose, and be integrated after validation. Never keep a per-platform or
  per-agent copy of the app. Parallel agents must not maintain separate
  implementations.
- Shared behavior (`src/game`, `src/state`, `src/data`, audio manager) is
  platform-neutral. Platform differences (touch vs keyboard, native packaging,
  rendering backend) live in adapters and are documented. A fix on one platform
  must be evaluated against every supported platform.
- Every release build comes from an explicit, approved **full SHA**. The guard
  (`scripts/check-source-line.py --release`) requires `HEAD == approved SHA`, that
  SHA on the authorized line (`docs/source-line.json` `authoritativeLine.branches`),
  a manifest/APK that name the same SHA, manifest + `checksums.sha256` matching the
  packaged files, and a build number with no existing `build-N`/`vN` tag or release. Builds record provenance
  (`build-provenance.json`, `release-manifest.json`). A multiplatform release uses
  the same SHA for all artifacts; never substitute a different SHA.
- Branch accounting is a separate, **non-blocking** audit
  (`scripts/audit-branches.py`; `npm run audit:branches` for strict periodic
  review). Account for a branch in `docs/BRANCH-LEDGER.md` before discarding it;
  an unrelated branch never blocks a release. Never delete branches or rewrite
  shared history without owner approval.
- OTA must keep its existing architecture (manual, gated by `runtimeVersion`) and
  stays traceable to its source SHA. Do not redesign without a concrete problem.
- Each repository is independent; do not touch other projects' repos.

## Known release blockers (owner decisions; see the docs)

- Signing: releases use the public template debug key. Fine for owner sideload,
  not for distribution or Play. `docs/SIGNING.md`.
- Asset licensing: the bundled GLBs/colormap have no licence record.
  `docs/ASSET-LICENSES.md`. Do not publish publicly until resolved.
