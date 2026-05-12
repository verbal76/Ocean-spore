// Build-trigger marker.
//   build #1-18 - see git history
//   build #19 (2026-05-12) - manual colormap.png decode via upng-js.
//                            Hermes has no Image constructor so
//                            three.js TextureLoader fails; we read
//                            the PNG bytes ourselves and build a
//                            DataTexture from raw RGBA. Attached as
//                            MeshBasicMaterial.map so Kenney's UVs
//                            sample the palette properly. Ships now
//                            show multi-colored skins instead of
//                            flat tints.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
