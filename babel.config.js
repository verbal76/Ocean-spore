// Build-trigger marker.
//   build #1-16 - see git history
//   build #17 (2026-05-12) - removed renderer.resetState() + COPY ALL btn
//   build #18 (2026-05-12) - debug cube removed, ships scale bumped
//                            after #25 confirmed pipeline works
//                            (FRAMES: 160, SCENE: 6, no RENDER ERR).
//                            Ships render where the cube was - the
//                            cube was occluding them at the player
//                            spawn point. TEMPLATE_BASE_SIZE 30 -> 50.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
