// Build-trigger marker.
//   build #1-19 - see git history
//   build #20 (2026-05-12) - bake vertex colors (no texture upload)
//                            + bake geometry transforms.
//   build #21 (2026-05-12) - OTAs not landing on the device. Bumping
//                            this marker to fire android-build.yml
//                            so the new APK bakes in everything that
//                            was OTA-only:
//                            - af5ded2: flatten Mesh hierarchy in
//                              bake (fixes bullet ~ship-width offset)
//                              + restore scale=worldSize/15 (fixes
//                              tiny ship)
//                            - 0bf440f: colormap sampler v-flip
//                              removed (top-left of palette is black;
//                              flipping mapped low UVs to bottom,
//                              also black). Plus expanded COLORMAP
//                              diag with uv(.014) sample bytes.
//                            APK build pulls latest src at gradle
//                            time so everything ships embedded.
//   build #22 (2026-05-12) - sRGB->linear convert vertex colors in
//                            colormap sampler. Renderer outputs sRGB
//                            so feeding it raw byte/255 (sRGB) double-
//                            encoded the gamma, lifting midtones and
//                            making the Kenney palette look washed
//                            out. Pre-converting at sample time lands
//                            the output back on original sRGB bytes.
//   build #23 (2026-05-12) - bow-aligned bullet spawn + saturation 1.5x
//                            on vertex-color bake. Bullets now spawn at
//                            size*1.6 forward (~bow tip) instead of a
//                            fixed 14 units; same for enemy bullets.
//                            Saturation pushes each sample away from
//                            its gray average so the Kenney palette
//                            reads as colorful, not muted.
//   build #24 (2026-05-12) - bundled APK with everything since #32:
//                            - wake trails behind every ship
//                            - rowing-boat (boat-row-*) yaw fix
//                            - mini-boss/elite enemy tier
//                            - camera zoom-out on large ships
//                            - stable enemy ids (mesh-swap fix)
//                            - stable bullet/pickup ids (key-reuse fix)
//                            - OTA channel via updates.requestHeaders
//                              (real fix; CHANNEL was blank on #32)
//                            New APK is the carrier for all of the
//                            above so they don't depend on OTAs.
//   build #25 (2026-05-12) - boat handling refinements bundled:
//                            - wake stern offset now size*(5/3),
//                              spacing 0.5, cap 20 (smoother curves,
//                              anchored to visible stern)
//                            - forward/lateral velocity decomposition
//                              for player (snappy throttle k=4,
//                              slow lateral decay k=1.2-2.7 with
//                              stern drag scaling on turn rate) =
//                              arcade speedboat carve feel
//                            - bullets inherit 30% of ship velocity
//                              (carried by the boat, not fired into
//                              static air)
//   build #26 (2026-05-12) - "make the boats feel like boats" pass:
//                            - lateral grip flipped HIGH baseline
//                              (k=4 straight) and LOW during turns
//                              (k=1.5) - hull bites water going
//                              straight, slides during a carve
//                            - forward k 4 -> 2.5 (mass / inertia)
//                            - coast damp 0.6 -> 0.3 (boats glide)
//                            - speed-dependent turning: 30% rate
//                              at rest, 100% at full speed (rudder
//                              needs water flow)
//                            - AI: predictive lead 0.3s + per-arch
//                              capped turn (no more frame-snap)
//                              + fwd/lat decomposition for enemies
//                            - per-shot recoil (10 units backward)
//                            - muzzle flash particles at bow
//                            - stronger hit feedback (more particles,
//                              shake on every connect)
//                            - speed-based camera zoom-out (sells
//                              the "going fast" feel)
//                            - pause button widened, "PAUS E" wrap
//                              fixed
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
