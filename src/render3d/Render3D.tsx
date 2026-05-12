import { GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import * as THREE from 'three';
import { BOSS, ENEMIES_BY_ID } from '../data/enemies';
import { SHIPS_BY_ID } from '../data/ships';
import { World } from '../game/world';
import { GLB_ASSETS } from './assets';
import { loadModel } from './assetLoader';
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
  const renderer = new THREE.WebGLRenderer({
    canvas: fakeCanvas,
    context: gl,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  // Defensive: set output color space explicitly. MeshBasicMaterial
  // doesn't depend on it, but if any GLB material happens to slip
  // through with vertex colors, sRGB output matches Kenney's intent.
  if ('outputColorSpace' in renderer) {
    (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}

function forceBasicMaterials(root: THREE.Object3D, fallbackColor: number) {
  root.traverse((obj: any) => {
    if (obj.isMesh) {
      const old = obj.material;
      const color =
        old && old.color && typeof old.color.clone === 'function'
          ? old.color.clone()
          : new THREE.Color(fallbackColor);
      const useVertexColors = !!(old && old.vertexColors);
      obj.material = new THREE.MeshBasicMaterial({
        color,
        vertexColors: useVertexColors,
        side: THREE.DoubleSide,
        // Force opaque + depth-tested so a stray transparent flag in
        // the source GLB can't accidentally make the ship invisible.
        transparent: false,
        depthWrite: true,
        depthTest: true,
      });
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
    };
  }, []);

  async function onContextCreate(gl: any) {
    if (startedRef.current) return;
    startedRef.current = true;

    const renderer = makeRenderer(gl);
    renderer.setClearColor(0x062238, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(
      -sw / 2,
      sw / 2,
      sh / 2,
      -sh / 2,
      0.1,
      4000
    );
    camera.position.set(0, 800, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(50, 200, 50);
    scene.add(dir);

    const templates: Record<string, THREE.Object3D> = {};
    const TEMPLATE_BASE_SIZE = 30;

    // Reset diagnostic counters so the About overlay shows fresh
    // numbers each time the playfield mounts.
    glbLoadStatus.total = Object.keys(GLB_ASSETS).length;
    glbLoadStatus.loaded = 0;
    glbLoadStatus.failed = 0;
    glbLoadStatus.firstError = '';

    await Promise.all(
      Object.entries(GLB_ASSETS).map(async ([name, mod]) => {
        try {
          const inner = await loadModel(mod);
          const box = new THREE.Box3().setFromObject(inner);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0.001) inner.scale.setScalar(TEMPLATE_BASE_SIZE / maxDim);
          box.setFromObject(inner);
          const center = box.getCenter(new THREE.Vector3());
          inner.position.sub(center);

          // Wrap the centered inner in an outer Group so place() can
          // set position/rotation/scale on the wrapper without
          // overwriting the inner's centering offset. Previously
          // clone.position.set(x,0,y) discarded the (-center) shift,
          // leaving the geometry off-pivot by up to half the model's
          // size - which on Kenney boats whose GLB pivots sit at one
          // corner was enough to push the ship out of the ortho
          // frustum entirely. The Group keeps centering pristine.
          const wrapper = new THREE.Group();
          wrapper.add(inner);
          templates[name] = wrapper;
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

    const active = new Map<string, THREE.Object3D>();
    const fallbackGeo = new THREE.SphereGeometry(15, 8, 6);

    function place(
      key: string,
      modelName: string,
      x: number,
      y: number,
      angle: number,
      worldSize: number,
      tintColor: number
    ) {
      let mesh = active.get(key);
      if (!mesh) {
        const tpl = templates[modelName];
        if (tpl) {
          mesh = tpl.clone(true);
          // Tint with the ship's defined color so even if the GLB has
          // no per-mesh color (or it loads as black), the unit is at
          // least visible in its data-defined hue. Vertex colors,
          // when present, get the tint multiplied in by three.js.
          forceBasicMaterials(mesh, tintColor);
        } else {
          mesh = new THREE.Mesh(
            fallbackGeo,
            new THREE.MeshBasicMaterial({ color: 0xff3030 })
          );
        }
        scene.add(mesh);
        active.set(key, mesh);
      }
      mesh.position.set(x, 0, y);
      mesh.rotation.y = -angle + Math.PI / 2;
      const scale = worldSize / 15;
      mesh.scale.setScalar(scale);
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

      camera.position.x = w.camera.x;
      camera.position.z = w.camera.y;
      camera.lookAt(w.camera.x, 0, w.camera.y);
      camera.up.set(0, 0, -1);

      const keep = new Set<string>();

      const ps = SHIPS_BY_ID[w.player.classId];
      if (ps) {
        place(
          'player',
          ps.model,
          w.player.pos.x,
          w.player.pos.y,
          w.player.angle,
          w.player.size,
          hexToInt(ps.color)
        );
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

      // expo-gl shares the GL context with the OS-level GLView surface,
      // which mutates GL state between frames (binds, clear color,
      // viewport, etc.). three.js caches its own snapshot of "what the
      // GPU is set to" and skips redundant calls, so if outside code
      // changes the state the renderer will draw with wrong settings -
      // sometimes resulting in completely empty frames (no ships).
      // resetState() clears three.js's cache so it re-pushes everything
      // on the next render. This is the documented fix for invisible
      // meshes inside an Expo GLView.
      if (typeof (renderer as any).resetState === 'function') {
        (renderer as any).resetState();
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
      requestAnimationFrame(render);
    }

    render();
  }

  return (
    <GLView
      style={StyleSheet.absoluteFill}
      onContextCreate={onContextCreate}
    />
  );
}
