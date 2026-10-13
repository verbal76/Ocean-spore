// Expo config plugin: declare .glb (and .gltf) as no-compress in the
// generated android/app/build.gradle. By default Android's aapt
// compresses unknown binary extensions when packaging the APK, which
// silently corrupts GLB binaries as they're read back via
// FileSystem.readAsStringAsync. With this patch, .glb / .gltf assets
// ship as raw bytes and three.js's GLTFLoader.parse() can decode them.
//
// Modern AGP (8.x in Expo SDK 52) prefers the `androidResources`
// block over the deprecated `aaptOptions`. Both forms accept noCompress.

const { withAppBuildGradle } = require('@expo/config-plugins');

const PATCH_MARKER = '// expo-config-plugin: no-compress-glb';
const PATCH = `\n    ${PATCH_MARKER}\n    androidResources {\n        noCompress 'glb'\n        noCompress 'gltf'\n    }`;

function withNoCompressGlb(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      // Skip silently on non-groovy (Kotlin DSL) - the project uses
      // groovy in Expo SDK 52's prebuild template.
      return config;
    }
    const contents = config.modResults.contents;
    if (contents.includes(PATCH_MARKER)) {
      return config;
    }
    // Insert right after the top-level `android {` declaration so the
    // androidResources block lives inside the android extension.
    const patched = contents.replace(
      /(android\s*\{)/,
      `$1${PATCH}`
    );
    if (patched === contents) {
      throw new Error(
        'with-no-compress-glb: could not find `android {` block in build.gradle'
      );
    }
    config.modResults.contents = patched;
    return config;
  });
}

module.exports = withNoCompressGlb;
