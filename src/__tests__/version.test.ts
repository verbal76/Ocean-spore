const { resolveVersion, parseBuildNumber, currentVersion, LAST_HISTORICAL_BUILD } = require('../../scripts/version');
const pkg = require('../../package.json');

describe('version identity', () => {
  test('build 40: versionName, versionCode and APK name all agree', () => {
    expect(resolveVersion(40)).toEqual({
      versionName: '40', versionCode: 40, buildNumber: 40, apkFileName: 'OceanSpore-v40.apk',
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
    expect(currentVersion({ BUILD_NUMBER: '60' }).apkFileName).toBe('OceanSpore-v60.apk');
  });

  test('rejects garbage so a bad versionCode can never ship', () => {
    for (const bad of ['abc', '0', '-3', '1.5', 3e9, undefined, '', null]) {
      expect(() => parseBuildNumber(bad)).toThrow();
    }
  });

  test('APK file name is <GameName>-v<Version>.apk and never a generic name', () => {
    const n = resolveVersion(7).apkFileName;
    expect(n).toMatch(/^OceanSpore-v\d+\.apk$/);
    expect(n).not.toMatch(/app-(debug|release)|android|build\.apk|artifact/);
  });
});
