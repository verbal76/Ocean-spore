// expo-audio's Android library manifest declares things this game never uses:
// RECORD_AUDIO, foreground-service permissions, and two services (lock-screen
// media controls and a MICROPHONE-type recording service). Ocean Spore only
// plays short effects, so strip all of it. Permissions are removed through
// app.json `android.blockedPermissions`; this plugin removes the services.
// scripts/check-manifest.py verifies the result on the BUILT APK in CI.

const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICES = [
  'expo.modules.audio.service.AudioRecordingService',
  'expo.modules.audio.service.AudioControlsService',
];

function withTrimAudioManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    const app = manifest.application && manifest.application[0];
    if (!app) return cfg;
    app.service = app.service || [];
    for (const name of SERVICES) {
      const existing = app.service.find((s) => s.$ && s.$['android:name'] === name);
      if (existing) {
        existing.$['tools:node'] = 'remove';
      } else {
        app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
      }
    }
    return cfg;
  });
}

module.exports = withTrimAudioManifest;
