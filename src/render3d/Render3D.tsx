import { GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import * as THREE from 'three';
import { BOSS, ENEMIES_BY_ID } from '../data/enemies';
import { SHIPS_BY_ID } from '../data/ships';
import { World } from '../game/world';
import { GLB_ASSETS } from './assets';
import { loadModel } from './assetLoader';
import { loadColormapSampler, colormapDiagSample, ColormapSampler } from './colormap';
import { glbLoadStatus } from './loadStatus';

interface Props {
  worldRef: { current: World };
}

function makeRenderer(gl: any): THREE.WebGLRenderer {
  const fakeCanvas: any = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    clientHeight: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
    ownerDocument: { defaultView: { devicePixelRatio: 1 } },
    parentElement: null,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  };
  const renderer = new THREE.WebGLRenderer({ canvas: fakeCanvas, context: gl });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  if ('outputColorSpace' in renderer) {
    (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}

function forceBasicMaterials(root: THREE.Object3D, fallbackColor: number, useVertexColor: boolean) {
  root.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.material = new THREE.MeshBasicMaterial({
        color: useVertexColor ? 0xffffff : new THREE.Color(fallbackColor),
        vertexColors: useVertexColor,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
        depthTest: true,
      });
      obj.visible = true;
      obj.frustumCulled = false;
    }
  });
}

function bakeVertexColors(obj: any, sampler: ColormapSampler): boolean {
  const geo = obj.geometry as THREE.BufferGeometry | undefined;
  if (!geo) return false;
  const uvAttr = geo.attributes.uv;
  if (!uvAttr) return false;
  const count = uvAttr.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    const [r, g, b] = sampler(u, v);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return true;
}

function bakeGeometryTransforms(inner: THREE.Object3D, targetSize: number) {
  // FIRST PASS: collect every Mesh in the GLB hierarchy with its
  // fully-resolved world transform. This handles GLBs that have
  // nested Groups (very common for Kenney's pack - e.g. a "boat"
  // root Group containing a "hull" sub-Group containing the actual
  // Mesh). If we just applyMatrix4(mesh.matrixWorld) and reset
  // mesh.position, the parent Group's transform still applies on
  // render and we get double-translated geometry. Build #28's
  // bullet-offset bug was this exact issue.
  inner.updateMatrixWorld(true);
  type Captured = { geometry: THREE.BufferGeometry; material: any };
  const captured: Captured[] = [];
  inner.traverse((obj: any) => {
    if (obj.isMesh && obj.geometry) {
      const g = obj.geometry.clone();
      g.applyMatrix4(obj.matrixWorld);
      captured.push({ geometry: g, material: obj.material });
    }
  });

  // Remove all existing children from inner. Re-attach the captured
  // meshes directly as flat children of inner, each with identity
  // transforms. After this, inner is a flat container of meshes
  // whose geometries are in inner-world coordinates.
  while (inner.children.length > 0) {
    inner.remove(inner.children[0]);
  }
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

export function Render3D({ worldRef }: Props) {
  const { width: sw, height: sh } = Dimensions.get('window');
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startedRef.current = false;
    };
  }, []);

  async function onContextCreate(gl: any) {
    if (startedRef.current) return;
    startedRef.current = true;

    glbLoadStatus.total = Object.keys(GLB_ASSETS).length;
    glbLoadStatus.loaded = 0;
    glbLoadStatus.failed = 0;
    glbLoadStatus.firstError = '';
    glbLoadStatus.renderError = '';
    glbLoadStatus.renderStack = '';
    glbLoadStatus.renderFrames = 0;
    glbLoadStatus.initError = '';
    glbLoadStatus.drawBufW = gl && gl.drawingBufferWidth ? gl.drawingBufferWidth : 0;
    glbLoadStatus.drawBufH = gl && gl.drawingBufferHeight ? gl.drawingBufferHeight : 0;
    glbLoadStatus.sceneChildren = 0;
    glbLoadStatus.colormapDiag = '';

    try {
      const renderer = makeRenderer(gl);
      renderer.setClearColor(0x062238, 1);

      const scene = new THREE.Scene();

      const camera = new THREE.OrthographicCamera(
        -sw / 2, sw / 2, sh / 2, -sh / 2, 0.1, 4000
      );
      camera.position.set(0, 800, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 1.1));
      const dir = new THREE.DirectionalLight(0xffffff, 0.7);
      dir.position.set(50, 200, 50);
      scene.add(dir);

      const templates: Record<string, THREE.Object3D> = {};
      const TEMPLATE_BASE_SIZE = 50;

      const sampler = await loadColormapSampler();
      glbLoadStatus.colormapDiag = await colormapDiagSample();

      await Promise.all(
        Object.entries(GLB_ASSETS).map(async ([name, mod]) => {
          try {
            const inner = await loadModel(mod);

            bakeGeometryTransforms(inner, TEMPLATE_BASE_SIZE);

            if (sampler) {
              inner.traverse((obj: any) => {
                if (obj.isMesh) bakeVertexColors(obj, sampler);
              });
            }

            templates[name] = inner;
            glbLoadStatus.loaded += 1;
          } catch (err: any) {
            glbLoadStatus.failed += 1;
            const msg = err && err.message ? String(err.message) : String(err);
            if (!glbLoadStatus.firstError) {
              glbLoadStatus.firstError = `${name}: ${msg.slice(0, 60)}`;
            }
            console.warn('[Render3D] Failed to load GLB', name, err);
          }
        })
      );

      const haveColors = !!sampler;
      const active = new Map<string, THREE.Object3D>();
      const fallbackGeo = new THREE.SphereGeometry(15, 8, 6);

      function place(
        key: string, modelName: string, x: number, y: number,
        angle: number, worldSize: number, tintColor: number
      ) {
        let mesh = active.get(key);
        if (!mesh) {
          const tpl = templates[modelName];
          if (tpl) {
            mesh = tpl.clone(true);
            forceBasicMaterials(mesh, tintColor, haveColors);
          } else {
            mesh = new THREE.Mesh(
              fallbackGeo,
              new THREE.MeshBasicMaterial({ color: 0xff3030 })
            );
            mesh.frustumCulled = false;
          }
          mesh.visible = true;
          scene.add(mesh);
          active.set(key, mesh);
        }
        mesh.position.set(x, 0, y);
        mesh.rotation.y = -angle + Math.PI / 2;
        // Render at ~3.33x the data-defined worldSize so the ship is
        // visually punchy on the orthographic viewport. Builds #25-26
        // used scale=worldSize/15 with TEMPLATE_BASE_SIZE=50 giving
        // rendered max-dim = 50 * worldSize/15 = 3.33*worldSize.
        // Build #28 accidentally collapsed that to 1*worldSize when
        // the formula changed to worldSize/TEMPLATE_BASE_SIZE.
        mesh.scale.setScalar(worldSize / 15);
      }

      function hexToInt(hex: string): number {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex);
        return m ? parseInt(m[1], 16) : 0xffffff;
      }

      function reap(keepKeys: Set<string>) {
        for (const [key, mesh] of active) {
          if (!keepKeys.has(key)) {
            scene.remove(mesh);
            active.delete(key);
          }
        }
      }

      function render() {
        if (!mountedRef.current) return;
        const w = worldRef.current;
        if (!w) {
          requestAnimationFrame(render);
          return;
        }

        try {
          camera.position.x = w.camera.x;
          camera.position.z = w.camera.y;
          camera.lookAt(w.camera.x, 0, w.camera.y);
          camera.up.set(0, 0, -1);

          const keep = new Set<string>();

          const ps = SHIPS_BY_ID[w.player.classId];
          if (ps) {
            place('player', ps.model, w.player.pos.x, w.player.pos.y,
              w.player.angle, w.player.size, hexToInt(ps.color));
            keep.add('player');
          }

          for (let i = 0; i < w.enemies.length; i++) {
            const e = w.enemies[i];
            const arch = e.isBoss ? BOSS : ENEMIES_BY_ID[e.archetype];
            if (!arch?.model) continue;
            const key = 'e' + i;
            place(key, arch.model, e.pos.x, e.pos.y, e.angle, e.size, hexToInt(e.color));
            keep.add(key);
          }

          reap(keep);

          glbLoadStatus.sceneChildren = scene.children.length;

          renderer.render(scene, camera);
          gl.endFrameEXP();
          glbLoadStatus.renderFrames += 1;
        } catch (err: any) {
          if (!glbLoadStatus.renderError) {
            const msg = err && err.message ? String(err.message) : String(err);
            glbLoadStatus.renderError = msg.slice(0, 80);
            const stack = err && err.stack ? String(err.stack) : '';
            glbLoadStatus.renderStack = stack.slice(0, 240);
          }
          console.warn('[Render3D] frame error', err);
        }
        requestAnimationFrame(render);
      }

      render();
    } catch (err: any) {
      const msg = err && err.message ? String(err.message) : String(err);
      glbLoadStatus.initError = msg.slice(0, 80);
      console.warn('[Render3D] init error', err);
    }
  }

  return (
    <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
  );
}
