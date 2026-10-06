// The one switch that drives the 3D pipeline. When false, the SVG
// playfield renders alone. When true, an orthographic top-down GLView
// underlay renders each ship as its mapped GLB while the SVG layer
// above continues to draw bullets, pickups, particles, salvage rings,
// and the HUD.
export const RENDER_3D = true;
