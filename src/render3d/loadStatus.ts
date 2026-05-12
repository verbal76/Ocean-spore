// Live diagnostic counter for GLB asset loading + render-loop health.
// Render3D updates these fields as templates load (or fail) and as the
// render loop runs, so the About overlay can surface 'X/Y models
// loaded', the first failure message, the first render-loop crash,
// and a heartbeat frame counter - no logcat needed to diagnose why
// the 3D layer is empty.
export const glbLoadStatus = {
  total: 0,
  loaded: 0,
  failed: 0,
  firstError: '',
  renderError: '',
  renderFrames: 0,
};
