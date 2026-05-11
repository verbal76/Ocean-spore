import { GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import * as THREE from 'three';
import { BOSS, ENEMIES_BY_ID } from '../data/enemies';
import { SHIPS_BY_ID } from '../data/ships';
import { World } from '../game/world';
import { GLB_ASSETS } from './assets';
import { loadModel } from './assetLoader';

interface Props {
  worldRef: { current: World };
}

// Tiny replacement for expo-three's Renderer. All it does is feed a
// real WebGL context (from expo-gl) into three.js's WebGLRenderer
// while mocking the DOM canvas interface that three.js touches at
// construction time.
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
  return renderer;
}

// Convert every Mesh under root to MeshBasicMaterial so it renders
// at full brightness regardless of lighting. The Kenney models have
// embedded materials we don't always preserve color info from
// during a clone(true), and PBR materials look dark without an
// HDRI / environment map. Basic-material keeps things visible.
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
      });
    }
  });
}

// Render the playfield as an orthographic top-down 3D scene. Game
// logic still runs in world.ts as 2D physics; this component just
// reads worldRef each frame and positions GLB meshes accordingly.
export function Render3D({ worldRef }: Props) {
  const { width: sw, height: sh } = Dimensions.get('window');
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  // Stop the render loop on unmount so RAF doesn't leak across
  // playing -> dead -> playing cycles.
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

    // Orthographic top-down camera.
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

    // Lighting kept in case any non-basic materials slip through.
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(50, 200, 50);
    scene.add(dir);

    // Preload every GLB referenced in GLB_ASSETS. Each template is
    // auto-scaled to roughly 30 world units along its largest axis,
    // then re-centered.
    const templates: Record<string, THREE.Object3D> = {};
    const TEMPLATE_BASE_SIZE = 30;
    await Promise.all(
      Object.entries(GLB_ASSETS).map(async ([name, mod]) => {
        try {
          const root = await loadModel(mod);
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0.001) root.scale.setScalar(TEMPLATE_BASE_SIZE / maxDim);
          box.setFromObject(root);
          const center = box.getCenter(new THREE.Vector3());
          root.position.sub(center);
          templates[name] = root;
        } catch (err) {
          console.warn('[Render3D] Failed to load GLB', name, err);
        }
      })
    );

    // Active meshes keyed by entity id.
    const active = new Map<string, THREE.Object3D>();

    // Fallback geometry for when a GLB template failed to load.
    // Visible red sphere makes the failure obvious in-game so we can
    // diagnose (no logcat needed).
    const fallbackGeo = new THREE.SphereGeometry(15, 8, 6);

    function place(
      key: string,
      modelName: string,
      x: number,
      y: number,
      angle: number,
      worldSize: number
    ) {
      let mesh = active.get(key);
      if (!mesh) {
        const tpl = templates[modelName];
        if (tpl) {
          mesh = tpl.clone(true);
          forceBasicMaterials(mesh, 0xffffff);
        } else {
          // GLB failed to load - render a bright red sphere so the
          // missing model is visually obvious.
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

    function reap(keepKeys: Set<string>) {
      for (const [key, mesh] of active) {
        if (!keepKeys.has(key)) {
          scene.remove(mesh);
          active.delete(key);
        }
      }
    }

    function render() {
      if (!mountedRef.current) {
        return;
      }
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
        place('player', ps.model, w.player.pos.x, w.player.pos.y, w.player.angle, w.player.size);
        keep.add('player');
      }

      for (let i = 0; i < w.enemies.length; i++) {
        const e = w.enemies[i];
        const arch = e.isBoss ? BOSS : ENEMIES_BY_ID[e.archetype];
        if (!arch?.model) continue;
        const key = 'e' + i;
        place(key, arch.model, e.pos.x, e.pos.y, e.angle, e.size);
        keep.add(key);
      }

      reap(keep);

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
