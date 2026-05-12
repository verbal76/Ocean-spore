// Live diagnostic counter for GLB asset loading. Render3D updates
// these fields as templates load (or fail) so the About overlay can
// surface 'X/Y models loaded' and the first failure message - no
// logcat needed to diagnose why ships render as red spheres.
export const glbLoadStatus = {
  total: 0,
  loaded: 0,
  failed: 0,
  firstError: '',
};
