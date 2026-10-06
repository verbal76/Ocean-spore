// Live diagnostic counter for GLB asset loading + render-loop health.
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
  colormapDiag: '',
};
