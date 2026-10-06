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
