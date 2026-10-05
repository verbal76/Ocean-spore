import { GLB_ASSETS } from './assets';
import { loadModel } from './assetLoader';
import { colormapDiagSample, loadColormapSampler } from './colormap';
import type { TemplateDeps } from './templates';

// The real asset registry, GLB loader and colormap sampler. Kept apart from
// templates.ts so the cache logic stays free of native/asset imports.
export const realTemplateDeps: TemplateDeps = {
  assets: GLB_ASSETS as Record<string, unknown>,
  loadModel,
  loadSampler: loadColormapSampler,
  diagSample: colormapDiagSample,
};
