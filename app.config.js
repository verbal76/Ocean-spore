// Dynamic Expo config layered over app.json. Version identity comes from
// scripts/version.js so versionName, versionCode, the APK file name and the
// in-game About screen can never disagree.
const { currentVersion } = require('./scripts/version');

module.exports = ({ config }) => {
  const v = currentVersion();
  return {
    ...config,
    version: v.versionName,
    android: { ...config.android, versionCode: v.versionCode },
  };
};
