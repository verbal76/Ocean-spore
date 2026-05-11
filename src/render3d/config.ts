// The one switch that drives the 3D pipeline. When false, the SVG
// playfield renders alone (current behaviour). When true, an
// orthographic top-down GLView underlay renders each ship as its
// mapped GLB while the SVG layer above continues to draw bullets,
// pickups, particles, and the HUD.
//
// To activate the 3D pass: flip this to true and commit. The babel
// build marker bump in the same commit fires a fresh APK build.
export const RENDER_3D = false;
