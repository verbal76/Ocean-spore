// Build-trigger marker. Bumping this comment fires a fresh APK
// build via the android-build.yml workflow without changing real
// behaviour - babel.config.js is in the path-trigger list and a
// touch here is the cheapest way to ask for a build on demand.
//   build #1 (2026-05-11) - initial pipeline + game skeleton
//   build #2 (2026-05-11) - complete src tree (world, Game, UI screens)
//   build #3 (2026-05-11) - HUD + title/over/shipyard screens + entry
//   build #4 (2026-05-11) - AI per-archetype: small flees, big charges;
//                            collision drops parts; salvage rings
//   build #5 (2026-05-11) - salvage tuning down; +cargo/fanboat/sniper
//                            enemies with own intents
//   build #6 (2026-05-11) - 3D scaffold (deps + Render3D + GLB mapping),
//                            gated behind RENDER_3D flag (still off)
//   build #7 (2026-05-11) - pin three to 0.166.0 to match expo-three
//                            8.0.0 peer-dep range (was 0.169.0, ERESOLVE)
//   build #8 (2026-05-11) - drop expo-three (stale, pulled old
//                            expo-modules-core; broke expo-font gradle
//                            plugin chain). Inline tiny custom renderer.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
