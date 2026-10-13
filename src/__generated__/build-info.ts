// AUTO-GENERATED stub. The real values are written by
// scripts/write-build-info.mjs which runs in the APK + OTA workflows
// before bundling. The stub stays committed so local dev imports
// resolve without error - the script just overwrites in CI.
export interface BuildInfo {
  branch: string;
  commit: string;
  commitShort: string;
  dirty: boolean;
  builtAt: string;
  appVersion: string;
  androidVersionCode: number | null;
  buildId: string;
  otaId: string;
  buildNumber: string;
}
export const BUILD_INFO: BuildInfo = {
  branch: 'dev',
  commit: 'dev',
  commitShort: 'dev',
  dirty: false,
  builtAt: 'unbuilt',
  appVersion: '1.0.0',
  androidVersionCode: null,
  buildId: 'build dev (dev)',
  otaId: 'OTA dev @ unbuilt',
  buildNumber: 'dev',
};
