import * as THREE from 'three';
import {
  applySharedMaterials, bakeGeometryTransforms, bakeVertexColors, disposeTemplates,
  hasCachedTemplates, loadTemplates, releaseGpuResources, TemplateDeps, TEMPLATE_BASE_SIZE,
} from '../render3d/templates';
import { glbLoadStatus } from '../render3d/loadStatus';

function fakeModel(w = 2, h = 4, d = 6, offset = 10): THREE.Object3D {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial());
  mesh.position.set(offset, offset, offset);
  root.add(mesh);
  return root;
}

function makeDeps(opts: { failNames?: string[]; sampler?: boolean } = {}) {
  const calls = { models: 0 };
  const names = ['a', 'b', 'c'];
  const deps: TemplateDeps = {
    assets: Object.fromEntries(names.map((n) => [n, n])),
    loadModel: async (mod: string) => {
      calls.models++;
      await Promise.resolve();
      if (opts.failNames?.includes(mod)) throw new Error('boom ' + mod);
      return fakeModel();
    },
    loadSampler: async () => (opts.sampler === false ? null : () => [0.25, 0.5, 0.75] as [number, number, number]),
    diagSample: async () => 'diag',
  };
  return { deps, calls };
}

beforeEach(() => { disposeTemplates(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('template cache', () => {
  test('models are parsed once; later mounts reuse the cache (dock/undock, retry after death)', async () => {
    const { deps, calls } = makeDeps();
    const first = await loadTemplates(deps);
    expect(calls.models).toBe(3);
    const second = await loadTemplates(deps);
    const third = await loadTemplates(deps);
    expect(calls.models).toBe(3);                         // no reload
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(hasCachedTemplates()).toBe(true);
    expect(glbLoadStatus.loaded).toBe(3);
  });

  test('concurrent callers share one load', async () => {
    const { deps, calls } = makeDeps();
    const [a, b, c] = await Promise.all([loadTemplates(deps), loadTemplates(deps), loadTemplates(deps)]);
    expect(calls.models).toBe(3);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test('a partial failure is returned but NOT cached, so the next mount retries', async () => {
    const bad = makeDeps({ failNames: ['b'] });
    const partial = await loadTemplates(bad.deps);
    expect(Object.keys(partial.templates).sort()).toEqual(['a', 'c']);
    expect(glbLoadStatus.failed).toBe(1);
    expect(glbLoadStatus.firstError).toContain('b');
    expect(hasCachedTemplates()).toBe(false);
    const good = makeDeps();
    const full = await loadTemplates(good.deps);
    expect(Object.keys(full.templates).sort()).toEqual(['a', 'b', 'c']);
    expect(hasCachedTemplates()).toBe(true);
  });

  test('disposeTemplates (low memory) drops the cache; the next load rebuilds', async () => {
    const { deps, calls } = makeDeps();
    await loadTemplates(deps);
    disposeTemplates();
    expect(hasCachedTemplates()).toBe(false);
    await loadTemplates(deps);
    expect(calls.models).toBe(6);
  });

  test('works without a colormap sampler (flat tints)', async () => {
    const { deps } = makeDeps({ sampler: false });
    const set = await loadTemplates(deps);
    expect(set.haveColors).toBe(false);
  });
});

describe('baking', () => {
  test('geometry is flattened, centred on the origin and scaled to the target size', () => {
    const m = fakeModel(2, 4, 6, 10);
    bakeGeometryTransforms(m, TEMPLATE_BASE_SIZE);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(TEMPLATE_BASE_SIZE, 4);
    expect(centre.length()).toBeLessThan(1e-4);
  });

  test('vertex colours are baked from the sampler, one RGB triple per vertex', () => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    expect(bakeVertexColors(mesh, () => [0.1, 0.2, 0.3])).toBe(true);
    const col = geo.attributes.color;
    expect(col.count).toBe(geo.attributes.position.count);
    expect([col.getX(0), col.getY(0), col.getZ(0)].map((v) => +v.toFixed(2))).toEqual([0.1, 0.2, 0.3]);
  });

  test('geometry without UVs is skipped instead of throwing', () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    expect(bakeVertexColors(new THREE.Mesh(geo), () => [1, 1, 1])).toBe(false);
  });
});

describe('shared materials', () => {
  test('50 spawned entities use ONE material when colours are baked (was one per mesh per entity)', async () => {
    const { deps } = makeDeps();
    const set = await loadTemplates(deps);
    const mats = new Set<THREE.Material>();
    for (let i = 0; i < 50; i++) {
      const clone = set.templates.a.clone(true);
      applySharedMaterials(clone, 0xff0000 + i, set.haveColors);
      clone.traverse((o: any) => { if (o.isMesh) mats.add(o.material); });
    }
    expect(mats.size).toBe(1);
  });

  test('without baked colours there is one material per distinct tint, not per entity', async () => {
    const { deps } = makeDeps({ sampler: false });
    const set = await loadTemplates(deps);
    const mats = new Set<THREE.Material>();
    for (let i = 0; i < 40; i++) {
      const clone = set.templates.a.clone(true);
      applySharedMaterials(clone, i % 3 === 0 ? 0xff0000 : i % 3 === 1 ? 0x00ff00 : 0x0000ff, false);
      clone.traverse((o: any) => { if (o.isMesh) mats.add(o.material); });
    }
    expect(mats.size).toBe(3);
  });

  test('clones share geometry with the template (no per-entity vertex copies)', async () => {
    const { deps } = makeDeps();
    const set = await loadTemplates(deps);
    const tplGeo = (set.templates.a.children[0] as THREE.Mesh).geometry;
    const clone = set.templates.a.clone(true);
    expect((clone.children[0] as THREE.Mesh).geometry).toBe(tplGeo);
  });
});

describe('GPU release on unmount', () => {
  test('dispose is dispatched on cached geometry (unhooks the dead renderer) and CPU data survives', async () => {
    const { deps } = makeDeps();
    const set = await loadTemplates(deps);
    const geo = (set.templates.a.children[0] as THREE.Mesh).geometry;
    const onDispose = jest.fn();
    geo.addEventListener('dispose', onDispose);
    releaseGpuResources(set);
    expect(onDispose).toHaveBeenCalled();
    expect(geo.attributes.position.count).toBeGreaterThan(0);           // still renderable by the next renderer
    expect(hasCachedTemplates()).toBe(true);                            // cache itself is kept
  });

  test('releasing with no templates is a no-op', () => {
    expect(() => releaseGpuResources(null)).not.toThrow();
  });
});
