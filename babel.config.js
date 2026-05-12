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
//   build #9 (2026-05-11) - persistent player memory: unlocked ships,
//                            high score, lifetime totals saved to
//                            expo-file-system
//   build #10 (2026-05-11) - RENDER_3D=true + multi-touch root dispatcher
//                            + PAUSE relocation + canvas-mock additions
//   build #11 (2026-05-12) - fresh APK on demand: bundles every fix
//                            from the failed OTAs (MeshBasicMaterial,
//                            red sphere fallback, Buffer.from, no
//                            world border, 6000x6000 world,
//                            noCompress plugin, tap-on-start, About
//                            overlay, gear icon)
//   build #12 (2026-05-12) - GLB visibility fix bundle (tint, force
//                            visible, no-cull, recompute bounds,
//                            magenta debug marker), startedRef reset
//                            on unmount, PAUSE button overlap fix
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
