# Ocean Spore: standing project instructions

Hot Attic Games, Android (Expo SDK 54 / RN 0.81, legacy architecture). Package
`com.verbal76.oceanspore`. Version = `package.json` -> `oceanSpore.build`
(versionCode = versionName). APK name `OceanSpore-v<build>.apk`. Rollback
checkpoint: v40 = `e2712522338cc1600d52be9bc78d5e9a293eeae3`.

## GitHub Actions budget policy (STANDING OWNER DIRECTIVE)

Actions minutes are shared across the owner's projects and the monthly budget is
small. Before starting any hosted workflow ask: *does this need GitHub Actions,
or can I prove it locally?*

- Validate locally first: `npm run verify` (brand, audio drift, typecheck, asset
  integrity, lint, tests, version). Also `npx expo export --platform android`
  when bundling is in doubt. Debug locally, never by re-running CI.
- Nothing runs automatically on push or PR update. `android-build.yml` starts only
  on `workflow_dispatch` or the `publish-apk` PR label; `ci.yml` is called by the
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
- Every build must come from an explicit, approved SHA and record provenance
  (`build-provenance.json`, `release-manifest.json`). A multiplatform release uses
  the same SHA for all artifacts; never substitute a different SHA when one platform
  fails.
- Before discarding or deleting any branch, account for it in the ledger. A new
  remote branch with outside commits fails `scripts/check-source-line.py`
  (also part of `npm run verify`) until audited. Never delete branches or rewrite
  shared history without owner approval.
- OTA must keep its existing architecture (manual, gated by `runtimeVersion`) and
  stays traceable to its source SHA. Do not redesign without a concrete problem.
- Each repository is independent; do not touch other projects' repos.
