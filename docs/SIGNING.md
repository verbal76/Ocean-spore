# Android signing: read-only investigation (2026-10-12)

No keys, passwords or credentials were created, changed or exposed. The only
secret material involved is a public template keystore (below).

## Proven (measured on the actual files)

| Fact | Evidence |
|---|---|
| build-39, v40 and v41 are signed by the **same** certificate | `apksigner verify --print-certs` on all three: `CN=Android Debug`, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Scheme: **v2 only** (v1 and v3 false) | same output |
| That certificate is the **stock React Native / Expo template `debug.keystore`** | `expo prebuild` generates `android/app/debug.keystore` (store password `android`, alias `androiddebugkey`, valid 2013-12-31 to 2052-04-30); its SHA-256 equals the certificate above |
| The release build type is signed with that debug config | generated `android/app/build.gradle`: `release { signingConfig signingConfigs.debug }` (the template's own comment: "in production, you need to generate your own keystore") |
| No signing secrets exist in the repo or CI | no keystore is tracked (`.gitignore` blocks them); the only secrets referenced are `GITHUB_TOKEN` and `OCEAN` (Expo token, OTA publishing only); `eas.json` is not used by CI builds |
| Package id and version progression are compatible | `com.verbal76.oceanspore` in build-39 / v40 / v41; versionCode 1 -> 40 -> 41 (monotonic, enforced by `scripts/version.js` tests); `scripts/check-manifest.py` pins package, versionCode, target 36 and this certificate on every build |

**Therefore:** v41 (and v40) install as an in-place **update** over build-39 or each
other, keeping app data (same package, same certificate, higher versionCode).

## Not suitable for production

- The signing key is **public** (it ships in the template, with its password).
  Anyone can sign an APK with the same package id that Android will accept as an
  update to an installed Ocean Spore. Fine for owner-only sideload testing; not
  acceptable for distribution to other people.
- **Google Play will not accept it**: Play requires an upload key you control (and
  rejects debug-signed bundles). A Play release is necessarily signed with a
  different certificate than v40/v41.

## Consequences of moving to a real key (decisions, not done here)

- A different certificate means installed v40/v41 copies **cannot update in place**
  (Android blocks a signature mismatch): they must be uninstalled first, which
  removes local save data unless Android Auto Backup restores it (`allowBackup` is
  `true` in the manifest; restore behaviour is **not verified**).
- Key rotation (APK Signature Scheme v3 with a proof-of-rotation lineage) would let
  newer Android versions accept a new key over the old one, but v40/v41 are v2-only
  and devices below Android 9 (minSdk is 24) cannot take a rotation. **Assumption,
  untested here.** Because the old key is public, a lineage is technically
  possible, but it is the owner's choice whether it is worth it.
- For Play: use Play App Signing with an owner-held **upload key**. Whether the
  package name `com.verbal76.oceanspore` is already registered in a Play Console is
  **unknown** from the repository.
- OTA (expo-updates, channel `preview`, runtimeVersion 2.1.0) has **no code-signing
  certificate configured**; its integrity relies on the Expo account/token (`OCEAN`).
  Enabling Expo code signing is a native-config change (runtimeVersion bump) and an
  owner decision.

## Owner / device verification needed (cannot be settled from the repo)

1. Which devices currently have Ocean Spore installed and from which build
   (`build-39` was downloaded twice per the release page). To confirm a device's
   installed certificate: `adb shell dumpsys package com.verbal76.oceanspore`
   (look at the signing certificate / `signatures`), or install v41 over it and see
   that it updates without uninstalling.
2. Whether any distribution beyond the owner's own devices (testers, Play) is
   planned. If not, the debug certificate is an acceptable, documented risk.
3. Whether a Play Console exists for this package id.

Do not rotate or replace the signing identity without that decision.
