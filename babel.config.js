// Build-trigger marker.
//   build #1-19 - see git history
//   build #20 (2026-05-12) - bake vertex colors (no texture upload)
//                            + bake geometry transforms (fixes
//                            ~ship-width bullet offset). Two fixes
//                            in one commit:
//                            (a) sample colormap.png at each vertex
//                                UV at template load, write 'color'
//                                attribute. vertexColors:true; no
//                                texture binding at all.
//                            (b) bake scale+center into each Mesh's
//                                geometry buffer. No wrapper Group;
//                                place() transforms inner directly
//                                so wrapper.scale doesn't multiply
//                                the centering offset.
//                            COLORMAP diag row in About: shows
//                            decoded WxH plus first 16 RGBA bytes.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
