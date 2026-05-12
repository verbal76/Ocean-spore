// Build-trigger marker.
//   build #1-16 - see git history
//   build #17 (2026-05-12) - BULLSEYE: stack trace from #24 pointed
//                            at fn named 'reset' in bundle, which is
//                            renderer.resetState() being called every
//                            frame. three.js resetState iterates
//                            known textures and crashes on a default
//                            texture with image=undefined. Removed
//                            the call entirely. Also added
//                            expo-clipboard + COPY ALL button on
//                            BUILD INFO panel so user can paste
//                            diagnostics as text instead of burning
//                            screenshot credits per result post.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
