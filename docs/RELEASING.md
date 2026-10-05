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
`publish = true`, or add the **`publish-apk`** label to the pull request, which builds the PR
head commit and publishes the same way (other labels do nothing). The release is marked **pre-release**; the tag is
`v<versionName>` and points at the built commit.

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

`scripts/check-16kb.py` checks every native library (ELF LOAD alignment and
zip alignment). It is **blocking** in CI: the 64-bit ABIs must be fully
16 KB-ready. The original SDK 52 build failed 13 of 14 libraries per ABI; the
SDK 54 / RN 0.81 / NDK 27 build passes 13/13 on arm64-v8a and x86_64.

## Local checks

    npm ci
    npm run typecheck
    npm test

## Signing debt (release debt, not a defect)

Every build since build-5 is signed with the **historical Android debug
certificate** (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`).
That is deliberate for owner/internal sideload testing: it is what lets a new
build install over build-39 and keep its data. It is **not** an acceptable
public-distribution key. Do not rotate it casually: a different certificate
cannot update an installed build (the owner would have to uninstall and lose
local data). `scripts/check-manifest.py` pins this certificate in CI so a
rotation can only happen on purpose. Before Google Play: create an upload key,
store it as repository secrets, wire it into Gradle signing, and plan the
one-time transition deliberately.

## OTA policy

- No OTA has ever been published from this resurrection work.
- `eas-update.yml` is manual-only, requires retyping the current
  `runtimeVersion` (now `2.1.0`), and is gated by CI.
- **`working-branch-ocean-spore` still carries the OLD `eas-update.yml` that
  publishes an OTA on every push.** Never push there. When the resurrection
  merges, the manual-only workflow replaces it. Bump `runtimeVersion` whenever
  native code or config changes (it was bumped 1.0.0 -> 2.0.0 for the SDK 54
  stack and 2.0.0 -> 2.1.0 for the audio module).

## CI gates on every build

typecheck, lint (0 warnings), unit + simulation tests, bundled-asset integrity
(vs the original APK), Hot Attic logo integrity, audio-vs-generator, Android
bundle export, then on the APK: package/version/target SDK/permission allowlist/
no foreground or microphone service/portrait/not debuggable/signing certificate
(`check-manifest.py`) and 16 KB page-size (`check-16kb.py`).
