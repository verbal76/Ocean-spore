const { resolveVersion, parseBuildNumber, currentVersion } = require('../../scripts/version');

describe('version identity', () => {
  test('CI build 40 on the 1.1 line', () => {
    expect(resolveVersion('1.1.0', 40)).toEqual({
      versionName: '1.1.40', versionCode: 40, buildNumber: 40,
      apkFileName: 'OceanSpore-v1.1.40.apk',
    });
  });

  test('accepts the run number as a string (from the environment)', () => {
    expect(resolveVersion('1.1.0', '41').versionCode).toBe(41);
  });

  test('versionCode strictly increases with the build number (installable upgrades)', () => {
    const codes = [40, 41, 99, 100, 1000].map((b) => resolveVersion('1.1.0', b).versionCode);
    expect([...codes].sort((a, b) => a - b)).toEqual(codes);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('local builds are clearly marked dev with versionCode 1', () => {
    const v = resolveVersion('1.1.0', undefined);
    expect(v.versionName).toBe('1.1.0-dev');
    expect(v.versionCode).toBe(1);
    expect(v.apkFileName).toBe('OceanSpore-v1.1.0-dev.apk');
  });

  test('rejects garbage build numbers instead of shipping a bad versionCode', () => {
    for (const bad of ['abc', '0', '-3', '1.5', 3e9]) expect(() => parseBuildNumber(bad)).toThrow();
  });

  test('rejects an unusable base version', () => {
    expect(() => resolveVersion('latest', 1)).toThrow();
  });

  test('APK file name never uses a generic name and contains game + version', () => {
    const n = resolveVersion('2.0.0', 7).apkFileName;
    expect(n).toMatch(/^OceanSpore-v\d+\.\d+\.\d+\.apk$/);
    expect(n).not.toMatch(/app-(debug|release)|android|build\.apk/);
  });

  test('currentVersion follows BUILD_NUMBER / GITHUB_RUN_NUMBER', () => {
    expect(currentVersion({ GITHUB_RUN_NUMBER: '52' }).versionCode).toBe(52);
    expect(currentVersion({ BUILD_NUMBER: '60', GITHUB_RUN_NUMBER: '52' }).versionCode).toBe(60);
  });
});
