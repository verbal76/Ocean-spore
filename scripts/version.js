// Single source of truth for Ocean Spore's version identity.
//
//   package.json  "oceanSpore": { "build": N }   <- the one number you bump
//
//   versionCode = N     strictly increasing; Android upgrades require it to rise
//   versionName = "N"   what Settings and the About screen show
//   APK file    = Ocean Spore Build N APK.apk      (studio standard v2.0 sec. 7)
//   Windows     = Ocean Spore Build N EXE.zip
//   Linux       = Ocean Spore Build N Linux.tar.gz
//   Release     = "Ocean Spore Build N", immutable tag build-N
//
// History: GitHub Releases build-5 .. build-39 (the last shipped to a device
// was build-39, versionCode 1 -- every historical build reported versionCode 1).
// The first resurrection candidate is therefore 40. Bump N deliberately for
// every APK that reaches the owner; CI run numbers do NOT drive the version
// (they also count failed, cancelled and test runs).
//
// BUILD_NUMBER in the environment overrides the committed value (local
// experiments only; CI does not set it).

const GAME_TITLE = 'Ocean Spore';
const LAST_HISTORICAL_BUILD = 39;

function parseBuildNumber(raw) {
  const n = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isInteger(n) || n < 1 || n > 2100000000) {
    throw new Error(`Invalid build number: ${JSON.stringify(raw)}`);
  }
  return n;
}

function resolveVersion(rawBuildNumber) {
  const build = parseBuildNumber(rawBuildNumber);
  return {
    versionName: String(build),
    versionCode: build,
    buildNumber: build,
    gameTitle: GAME_TITLE,
    apkFileName: `${GAME_TITLE} Build ${build} APK.apk`,
    exeFileName: `${GAME_TITLE} Build ${build} EXE.zip`,
    linuxFileName: `${GAME_TITLE} Build ${build} Linux.tar.gz`,
    releaseTitle: `${GAME_TITLE} Build ${build}`,
    releaseTag: `build-${build}`,
  };
}

function currentVersion(env = process.env) {
  const pkg = require('../package.json');
  const raw = env.BUILD_NUMBER || (pkg.oceanSpore && pkg.oceanSpore.build);
  return resolveVersion(raw);
}

module.exports = { GAME_TITLE, LAST_HISTORICAL_BUILD, parseBuildNumber, resolveVersion, currentVersion };

// `node scripts/version.js apk-name|exe-name|linux-name|version-name|version-code|release-title|release-tag|game-title`, for CI steps.
if (require.main === module) {
  const v = currentVersion();
  const what = process.argv[2];
  const out = {
    'apk-name': v.apkFileName, 'exe-name': v.exeFileName, 'linux-name': v.linuxFileName, 'version-name': v.versionName, 'version-code': v.versionCode,
    'release-title': v.releaseTitle, 'release-tag': v.releaseTag, 'game-title': v.gameTitle,
  }[what];
  if (out === undefined) { console.error('usage: version.js apk-name|exe-name|linux-name|version-name|version-code|release-title|release-tag|game-title'); process.exit(2); }
  console.log(out);
}
