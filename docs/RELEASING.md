# Releasing Ocean Spore

## Version identity (single source: `scripts/version.js`)

| | |
|---|---|
| `package.json` `oceanSpore.build` | the one number you bump (currently 40) |
| versionName | the build number as text, e.g. `40` |
| versionCode | the build number, strictly increasing |
| APK file | `OceanSpore-v<build>.apk`, e.g. `OceanSpore-v40.apk` |
| Derived from | history: releases build-5..build-39 (last device build 39, versionCode 1) so the first candidate is 40. CI run numbers do NOT drive it (they count failed/test runs). Bump deliberately for every APK that reaches the owner |

CI verifies the built APK's package id, versionCode and versionName match
before uploading it, and records the file's SHA-256 in the run summary.

## Building an APK

Push or open a PR: `APK Build (GitHub-hosted)` runs typecheck, tests, a bundle
export, then Gradle, and attaches `OceanSpore-v<ver>.apk` as a workflow
artifact (14 days). Nothing is published automatically.

To publish a GitHub Release: Actions -> APK Build -> Run workflow ->
`publish = true`. The tag is `v<versionName>` and points at the built commit.

## OTA updates (`eas-update.yml`)

Manual only. Run it from the Actions tab and retype the `runtimeVersion` from
`app.json` (currently `2.0.0`); a mismatch aborts, so an update can't be sent
across a native boundary. **Bump `runtimeVersion` whenever native code or
native config changes** (SDK upgrade, new native module, permission change).
Old `1.0.0` installs never receive updates built for runtime `2.0.0`.

## Signing (owner decision required)

Release APKs are signed with Expo's bundled **debug keystore**: fine for
sideloading and for installing over earlier builds, **not acceptable for
Google Play**. Before any Play submission an upload keystore must be created,
stored as repository secrets, and wired into the Gradle signing config. Never
commit keystores (`*.jks`, `*.keystore` are git-ignored).

## 16 KB page-size

`scripts/check-16kb.py` checks every native library. It is report-only in CI
while the project is on Expo SDK 52 / React Native 0.76 (which fails); set
`ENFORCE_16KB: 'true'` in `android-build.yml` once the SDK upgrade lands.

## Local checks

    npm ci
    npm run typecheck
    npm test
