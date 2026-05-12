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
//   build #7 (2026-05-11) - pin three to 0.166.0
//   build #8 (2026-05-11) - drop expo-three
//   build #9 (2026-05-11) - persistent player memory
//   build #10 (2026-05-11) - RENDER_3D=true + multi-touch dispatcher
//   build #11 (2026-05-12) - fresh APK with every OTA fix
//   build #12 (2026-05-12) - GLB visibility fix bundle
//   build #13 (2026-05-12) - navigator.userAgent polyfill
//   build #14 (2026-05-12) - aggressive diagnostics (yellow clear,
//                            FRAMES/DRAW BUF/SCENE counters)
//   build #15 (2026-05-12) - strip GLB texture refs from materials
//   build #16 (2026-05-12) - stack trace capture + SKIP_GLB_SHIPS
//                            diagnostic flag to isolate cube vs ship
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
