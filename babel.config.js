// Build-trigger marker.
//   build #1-19 - see git history
//   build #20 (2026-05-12) - vertex-color bake + geometry transforms
//   build #21 (2026-05-12) - OTAs not landing, rebake APK with src fixes
//   build #22 (2026-05-12) - sRGB->linear conversion in colormap sampler
//   build #23 (2026-05-12) - bow-aligned bullet spawn + 1.5x saturation
//   build #24 (2026-05-12) - bundled APK: wakes, rowing-boat yaw fix,
//                            mini-boss tier, camera zoom, stable ids,
//                            real OTA channel fix.
//   build #25 (2026-05-12) - boat handling: wake stern, fwd/lat decomp,
//                            bullets inherit ship velocity.
//   build #26 (2026-05-12) - heavy-boat physics: lateral grip flip,
//                            speed-dependent turn, AI lead + capped turn,
//                            recoil, hit feedback, speed-zoom, pause btn.
//   build #27 (2026-05-12) - rebuild: prior babel push fired the APK
//                            before world.ts/Game.tsx code changes landed.
//   build #28 (2026-05-12) - lead-dev technical-report fixes:
//                            CRITICAL:
//                            - physical muzzle offsets (local ship space
//                              rotated to world). SPREAD: 3 cannons at
//                              +/-size*0.7 with fan angles. TWIN: 2 at
//                              +/-size*0.6 parallel. Muzzle flashes per
//                              cannon, not centerline.
//                            - wake sampling on distance OR angle change
//                              > 0.08 rad. Cap 24. WakePoint.angle added.
//                            - recoil AFTER bullet spawn. Pre-recoil ship
//                              velocity captured for all bullets in volley.
//                            HIGH:
//                            - rudder steering: joystick.y = throttle,
//                              joystick.x = rudder. Ship turns via rudder
//                              force, not target-heading snap.
//                            MEDIUM:
//                            - camera velocity look-ahead 0.18s.
//                            - shake decay 10/s -> 14/s.
//                            UI:
//                            - touch coords pageX/Y -> locationX/Y
//                              (Android status-bar offset fix).
//                            - hitbox padding +20 -> +36 large,
//                              +16 -> +28 small.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
