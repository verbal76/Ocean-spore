// Build-trigger marker. Bumping this comment fires a fresh APK
// build via the android-build.yml workflow without changing real
// behaviour - babel.config.js is in the path-trigger list and a
// touch here is the cheapest way to ask for a build on demand.
//   build #1 (2026-05-11) - initial pipeline + game skeleton
//   build #2 (2026-05-11) - complete src tree (world, Game, UI screens)
//   build #3 (2026-05-11) - HUD + title/over/shipyard screens + entry
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
