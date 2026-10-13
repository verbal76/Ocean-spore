const { resolveVersion, parseBuildNumber, currentVersion, LAST_HISTORICAL_BUILD } = require('../../scripts/version');
const pkg = require('../../package.json');

describe('version identity', () => {
  test('build 40: versionName, versionCode, names and tag all agree (studio standard naming)', () => {
    expect(resolveVersion(40)).toEqual({
      versionName: '40', versionCode: 40, buildNumber: 40, gameTitle: 'Ocean Spore',
      apkFileName: 'Ocean Spore Build 40 APK.apk', exeFileName: 'Ocean Spore Build 40 EXE.zip',
      linuxFileName: 'Ocean Spore Build 40 Linux.tar.gz', releaseTitle: 'Ocean Spore Build 40', releaseTag: 'build-40',
    });
  });

  test('the committed build number continues the release history (never goes backwards)', () => {
    expect(LAST_HISTORICAL_BUILD).toBe(39);                 // GitHub Release build-39
    expect(pkg.oceanSpore.build).toBeGreaterThan(LAST_HISTORICAL_BUILD);
    expect(currentVersion({}).versionCode).toBe(pkg.oceanSpore.build);
  });

  test('versionCode is strictly greater than the historical APK (versionCode 1)', () => {
    expect(currentVersion({}).versionCode).toBeGreaterThan(1);
  });

  test('versionCode strictly increases with the build number (installable upgrades)', () => {
    const codes = [40, 41, 99, 100, 1000].map((b) => resolveVersion(b).versionCode);
    expect([...codes].sort((a, b) => a - b)).toEqual(codes);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('accepts the number as a string (environment override)', () => {
    expect(resolveVersion('41').versionCode).toBe(41);
    expect(currentVersion({ BUILD_NUMBER: '60' }).apkFileName).toBe('Ocean Spore Build 60 APK.apk');
  });

  test('rejects garbage so a bad versionCode can never ship', () => {
    for (const bad of ['abc', '0', '-3', '1.5', 3e9, undefined, '', null]) {
      expect(() => parseBuildNumber(bad)).toThrow();
    }
  });

  test('APK file name is "Game Title Build NN APK.apk": human readable, no hashes/branches/CI ids', () => {
    const v = resolveVersion(7);
    expect(v.apkFileName).toBe('Ocean Spore Build 7 APK.apk');
    expect(v.apkFileName).not.toMatch(/app-(debug|release)|[0-9a-f]{7,}|artifact/);
    expect(v.releaseTitle).toBe('Ocean Spore Build 7');           // no extra classification in the title
    expect(v.releaseTag).toBe('build-7');
  });
});
