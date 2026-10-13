import * as THREE from 'three';
import type { ColormapSampler } from './colormap';
import { glbLoadStatus } from './loadStatus';

// Baked model templates, cached for the life of the app.
//
// Parsing the GLBs, normalising their geometry and baking vertex colours is
// pure JS work that does not depend on the GL context, so it is done once and
// the result survives Render3D unmounting (game over, new run, resume after
// the Android GL surface was lost). Only the GPU side is released.

export const TEMPLATE_BASE_SIZE = 50;

export interface TemplateSet {
  templates: Record<string, THREE.Object3D>;
  /** true when the colormap sampler was available and colours are baked. */
  haveColors: boolean;
}

export interface TemplateDeps {
  assets: Record<string, unknown>;
  loadModel: (mod: any) => Promise<THREE.Object3D>;
  loadSampler: () => Promise<ColormapSampler | null>;
  diagSample: () => Promise<string>;
}

export function bakeVertexColors(obj: any, sampler: ColormapSampler): boolean {
  const geo = obj.geometry as THREE.BufferGeometry | undefined;
  if (!geo) return false;
  const uvAttr = geo.attributes.uv;
  if (!uvAttr) return false;
  const count = uvAttr.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [r, g, b] = sampler(uvAttr.getX(i), uvAttr.getY(i));
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return true;
}

// Flattens the node hierarchy into world-space geometry and scales/centres the
// model so its largest dimension equals targetSize.
export function bakeGeometryTransforms(inner: THREE.Object3D, targetSize: number) {
  inner.updateMatrixWorld(true);
  const captured: { geometry: THREE.BufferGeometry; material: any }[] = [];
  inner.traverse((obj: any) => {
    if (obj.isMesh && obj.geometry) {
      const g = obj.geometry.clone();
      g.applyMatrix4(obj.matrixWorld);
      captured.push({ geometry: g, material: obj.material });
    }
  });

  while (inner.children.length > 0) inner.remove(inner.children[0]);
  for (const c of captured) {
    const m = new THREE.Mesh(c.geometry, c.material);
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    inner.add(m);
  }

  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0.001 ? targetSize / maxDim : 1;

  const mat = new THREE.Matrix4()
    .makeTranslation(-center.x * scale, -center.y * scale, -center.z * scale)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  inner.traverse((obj: any) => {
    if (obj.isMesh && obj.geometry) {
      obj.geometry.applyMatrix4(mat);
      obj.geometry.computeBoundingBox();
      obj.geometry.computeBoundingSphere();
    }
  });
}

// ---------------------------------------------------------------------------
// Shared materials. Every clone used to get its own MeshBasicMaterial per mesh
// (never disposed). With baked vertex colours the tint is unused, so ONE
// material serves every entity; without them, one per distinct tint.

let vertexColorMaterial: THREE.MeshBasicMaterial | null = null;
const tintMaterials = new Map<number, THREE.MeshBasicMaterial>();

function basicMaterial(color: number, vertexColors: boolean): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: vertexColors ? 0xffffff : color,
    vertexColors,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

export function entityMaterial(tint: number, haveColors: boolean): THREE.MeshBasicMaterial {
  if (haveColors) return (vertexColorMaterial ??= basicMaterial(0xffffff, true));
  let m = tintMaterials.get(tint);
  if (!m) { m = basicMaterial(tint, false); tintMaterials.set(tint, m); }
  return m;
}

/** Point every mesh under root at the shared material (no per-entity allocation). */
export function applySharedMaterials(root: THREE.Object3D, tint: number, haveColors: boolean) {
  const material = entityMaterial(tint, haveColors);
  root.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.material = material;
      obj.visible = true;
      obj.frustumCulled = false;
    }
  });
}

// ---------------------------------------------------------------------------

let cached: TemplateSet | null = null;
let inflight: Promise<TemplateSet> | null = null;

/**
 * Load (or reuse) the baked templates. Concurrent callers share one load. A
 * partial failure is returned but NOT cached, so the next mount retries.
 */
export function loadTemplates(deps: TemplateDeps): Promise<TemplateSet> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  const names = Object.keys(deps.assets);
  glbLoadStatus.total = names.length;
  glbLoadStatus.loaded = 0;
  glbLoadStatus.failed = 0;
  glbLoadStatus.firstError = '';

  inflight = (async () => {
    try {
      const sampler = await deps.loadSampler();
      glbLoadStatus.colormapDiag = await deps.diagSample();
      const templates: Record<string, THREE.Object3D> = {};

      await Promise.all(
        names.map(async (name) => {
          try {
            const inner = await deps.loadModel(deps.assets[name]);
            bakeGeometryTransforms(inner, TEMPLATE_BASE_SIZE);
            if (sampler) inner.traverse((obj: any) => { if (obj.isMesh) bakeVertexColors(obj, sampler); });
            templates[name] = inner;
            glbLoadStatus.loaded += 1;
          } catch (err: any) {
            glbLoadStatus.failed += 1;
            const msg = err && err.message ? String(err.message) : String(err);
            if (!glbLoadStatus.firstError) glbLoadStatus.firstError = `${name}: ${msg.slice(0, 60)}`;
            console.warn('[Render3D] Failed to load GLB', name, err);
          }
        }),
      );

      const set: TemplateSet = { templates, haveColors: !!sampler };
      if (glbLoadStatus.failed === 0) cached = set;
      return set;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Release the GPU side only. Geometry and material objects register dispose
 * listeners on whichever renderer drew them, which would otherwise keep every
 * dead renderer alive; dispose() unhooks them. The CPU data stays valid, so
 * the next renderer simply uploads it again.
 */
export function releaseGpuResources(set: TemplateSet | null) {
  if (set) {
    for (const tpl of Object.values(set.templates)) {
      tpl.traverse((obj: any) => { if (obj.isMesh && obj.geometry) obj.geometry.dispose(); });
    }
  }
  vertexColorMaterial?.dispose();
  for (const m of tintMaterials.values()) m.dispose();
}

/** Drop everything (low-memory warning / tests). The next mount reloads. */
export function disposeTemplates() {
  releaseGpuResources(cached);
  cached = null;
  inflight = null;
  vertexColorMaterial = null;
  tintMaterials.clear();
}

export function hasCachedTemplates(): boolean {
  return cached !== null;
}
