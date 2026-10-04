// Single source of truth for Ocean Spore's version identity.
//
//   package.json "version"  -> major.minor line, e.g. "1.1.0" => "1.1"
//   build number            -> CI run number (GITHUB_RUN_NUMBER / BUILD_NUMBER)
//
//   versionName = "<major>.<minor>.<build>"   e.g. 1.1.40
//   versionCode = <build>                     monotonic; Android upgrades need it to rise
//   APK file    = OceanSpore-v<versionName>.apk
//
// Local builds (no build number) get "<major>.<minor>.0-dev" / versionCode 1.
// Used by app.config.js, scripts/write-build-info.mjs and the CI workflows.

const GAME_FILE_NAME = 'OceanSpore';

function parseBuildNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 2100000000) {
    throw new Error(`Invalid build number: ${JSON.stringify(raw)}`);
  }
  return n;
}

function resolveVersion(baseVersion, rawBuildNumber) {
  const m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(String(baseVersion));
  if (!m) throw new Error(`package.json version must be MAJOR.MINOR[.PATCH], got ${baseVersion}`);
  const line = `${m[1]}.${m[2]}`;
  const build = parseBuildNumber(rawBuildNumber);
  const versionName = build === null ? `${line}.0-dev` : `${line}.${build}`;
  return {
    versionName,
    versionCode: build === null ? 1 : build,
    buildNumber: build,
    apkFileName: `${GAME_FILE_NAME}-v${versionName}.apk`,
  };
}

function currentVersion(env = process.env) {
  const pkg = require('../package.json');
  return resolveVersion(pkg.version, env.BUILD_NUMBER || env.GITHUB_RUN_NUMBER);
}

module.exports = { GAME_FILE_NAME, parseBuildNumber, resolveVersion, currentVersion };

// `node scripts/version.js apk-name|version-name|version-code`, for CI steps.
if (require.main === module) {
  const v = currentVersion();
  const what = process.argv[2];
  const out = { 'apk-name': v.apkFileName, 'version-name': v.versionName, 'version-code': v.versionCode }[what];
  if (out === undefined) { console.error('usage: version.js apk-name|version-name|version-code'); process.exit(2); }
  console.log(out);
}
