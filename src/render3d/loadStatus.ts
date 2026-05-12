// Live diagnostic counter for GLB asset loading + render-loop health.
// Render3D updates these fields as templates load (or fail) and as the
// render loop runs, so the About overlay can surface enough info to
// triage 'why is the 3D layer empty?' without needing logcat.
export const glbLoadStatus = {
  total: 0,
  loaded: 0,
  failed: 0,
  firstError: '',
  renderError: '',
  renderStack: '',
  renderFrames: 0,
  initError: '',
  drawBufW: 0,
  drawBufH: 0,
  sceneChildren: 0,
  texturesStripped: 0,
};
