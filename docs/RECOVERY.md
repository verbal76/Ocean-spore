# Ocean Spore: recovery baseline

In October 2026 the repository's `main` branch held only a README, a logo and
workflows, which looked as if the game had never been written. It had: all
development lived on `working-branch-ocean-spore` and was never merged to
`main`. This file records exactly what was recovered and from where, so the
provenance is never lost again.

## Original APK (historical reference build)

| | |
|---|---|
| File | `ocean-spore-build-39.apk` (GitHub Release `build-39`) |
| SHA-256 | `6125bc006366f67feffcfec70e933f68ecbcd38eb989100379bc122d8e0a023f` |
| Package | `com.verbal76.oceanspore` |
| versionName / versionCode | `1.0.0` / `1` (every historical build had versionCode 1) |
| SDK | minSdk 24, targetSdk 34, compileSdk 35 |
| Engine | Expo SDK 52 / React Native 0.76.5 (Hermes bytecode v96), three.js 0.169 via expo-gl |
| Built from | `a3f17b61d38409dd2711f307a5a95e820fe6b986` (embedded in the bundle's build info) |
| Signing | Expo debug keystore |

Forensic result: every source string literal, all 151 numeric constants, the
ship/enemy/upgrade/captain tables and all named functions in the APK match
source commit `a3f17b6`. No source was lost. The APK shipped no custom icon
(stock Android robot) and no splash image.

## Source lineage

| Ref | SHA | Notes |
|---|---|---|
| `working-branch-ocean-spore` tip | `cd44482` | Latest game source (73 commits). 2 commits past the APK; those only ever reached devices via a failed OTA run |
| Source of build-39 APK | `a3f17b6` | Exact source of the APK the owner had installed |
| `claude/fix-ui-add-menus-3q8N7` tip | `44202cd` | 32 commits; all 3 unique commits are superseded (one, `resetState()`, was later removed as the real crash site) |
| `main` before resurrection | `4e1c377` | README, workflows, Hot Attic logo |
| Resurrection start | `a0f2ec3` | Recovered source + logo merged; no game code changed |

Local rollback tags used during the resurrection: `baseline/build-39-source`,
`baseline/working-branch-tip`, `baseline/claude-ui-tip`,
`baseline/main-before-resurrection`, `baseline/resurrection-start`.

## Facts established

- 27 GitHub Releases (`build-5`..`build-39`), none deleted; the numbering gaps
  are failed or cancelled runs. Release tags pointed at old `main` commits
  because no target commit was set; the release body holds the true source SHA.
- No credentials in git history (scanned all branches).
- Only 15 of ~76 GLBs are bundled in the game (7 ships, 7 enemies, boss).
  There is no audio and no font.
- 16 KB page-size: the original APK **fails**. 13 of 14 native libraries per
  64-bit ABI are 4 KB-aligned (`libhermes`, `libreactnative`, `libjsi`,
  `libexpo-gl`, ...). Reproduce with `python3 scripts/check-16kb.py <apk>`.
