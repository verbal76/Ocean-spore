# Update architecture (actual implementation, standard v2.0 sec. 10)

| Identifier | Where |
|---|---|
| Game build number | `package.json` `oceanSpore.build` (= versionCode = versionName) |
| Source SHA | `build-provenance.json`, `build-manifest.json`, `BUILD_INFO` embedded in the bundle, About screen |
| Native runtime compatibility id | `runtimeVersion` in `app.json` (currently **2.1.0**) |
| Update channel | `preview` (request header in `app.json`) |
| Update id | About screen (`OTA`, `SOURCE embedded / over-the-air`) |

**Identifiers are separate on purpose:** the native build number (`oceanSpore.build`, the number in
`Ocean Spore Build N`) changes only when a native package is built; an OTA revision is identified
by its Expo update id (About screen: `OTA`) plus `BUILD_INFO.otaId` (commit + time). An OTA never
consumes or changes a native build number, and a native build number is never reused.

## Android

Mechanism: **expo-updates** (Expo's service, `u.expo.dev`), checked on load with
`fallbackToCacheTimeout: 0`: the game starts immediately from the embedded or last
cached bundle and never waits on the network (offline start is by design; not yet
tested on a device). Over the air can deliver **JS and bundled assets only**.
A new APK (and a `runtimeVersion` bump) is required for any native code,
native module, permission or `app.json` native-config change.

Publishing (`eas-update.yml`) is **manual only**, runs `ci.yml` first, requires the
current `runtimeVersion` to be retyped, only exposes the Expo token to the publish
step, and since 2026-10-12 only publishes the exact dispatched commit when it is on
the authorized source line (same guard as APK builds). It never creates a native
build; a GitHub Release never publishes an OTA.

Not in place / unverified: Expo **code signing** (updates are authenticated by TLS
and the Expo account only), explicit rollback drills, interrupted-download
recovery beyond expo-updates' own behaviour. Safe fallback is the embedded bundle.

## Windows / Linux

Desktop builds contain no updater (no OTA): a new numbered build replaces the folder. For
Steam they would ship through **SteamPipe** (not set up: needs an App ID and credentials);
no custom binary updater will be built. The window never waits on the network: it loads only
its own files. Saves live in the per-user data directory (docs: `desktop/README.md`), outside
the install folder, so replacing the game never touches progress.

## Saves across updates

`src/state/persistence.ts`: versioned schema, atomic temp-file + move with a
`.bak`, corrupt-file quarantine; updates never touch the save file.
