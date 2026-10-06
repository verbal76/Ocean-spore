import { GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { BOSS, ENEMIES_BY_ID } from '../data/enemies';
import { SHIPS_BY_ID } from '../data/ships';
import { World } from '../game/world';
import { glbLoadStatus } from './loadStatus';
import { realTemplateDeps } from './templateDeps';
import { applySharedMaterials, loadTemplates, releaseGpuResources, TemplateSet } from './templates';

interface Props {
  worldRef: { current: World };
  /** Measured size of the game view (dp); the camera follows it. */
  width: number;
  height: number;
  /** Simulation paused: keep the last frame alive at a low rate. */
  paused?: boolean;
  /** Not visible at all (harbor screen on top): draw nothing. */
  hidden?: boolean;
  /** Called once when models are loaded and a frame has been drawn (or init failed). */
  onReady?: () => void;
}

/** While paused, redraw only every Nth frame (~5 Hz at 60 fps). */
const PAUSED_FRAME_DIVISOR = 12;

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

function hexToInt(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  return m ? parseInt(m[1], 16) : 0xffffff;
}

// Per-model bow-axis offset. The default formula (-angle + PI/2) assumes the
// bow lies along local +Z and maps it to world +X at angle=0. All bundled GLBs
// follow that; this empty map is the hook for any future model that does not.
const MODEL_YAW_OFFSET: Record<string, number> = {};

export function Render3D({ worldRef, width, height, paused = false, hidden = false, onReady }: Props) {
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const rafRef = useRef(0);
  const teardownRef = useRef<(() => void) | null>(null);
  // Props that change while the GL loop is running are read through refs so
  // the loop never calls a stale closure.
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      teardownRef.current?.();
      teardownRef.current = null;
    };
  }, []);

  async function onContextCreate(gl: any) {
    if (startedRef.current) return;
    startedRef.current = true;

    glbLoadStatus.renderError = '';
    glbLoadStatus.renderStack = '';
    glbLoadStatus.renderFrames = 0;
    glbLoadStatus.initError = '';
    glbLoadStatus.drawBufW = gl && gl.drawingBufferWidth ? gl.drawingBufferWidth : 0;
    glbLoadStatus.drawBufH = gl && gl.drawingBufferHeight ? gl.drawingBufferHeight : 0;
    glbLoadStatus.sceneChildren = 0;

    let readyFired = false;
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      onReadyRef.current?.();
    };

    let renderer: THREE.WebGLRenderer | null = null;
    let templateSet: TemplateSet | null = null;
    const scene = new THREE.Scene();
    const active = new Map<string, THREE.Object3D>();
    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      for (const mesh of active.values()) scene.remove(mesh);
      active.clear();
      releaseGpuResources(templateSet);
      renderer?.dispose();
      renderer = null;
    };
    teardownRef.current = teardown;

    try {
      const r = makeRenderer(gl);
      renderer = r;
      r.setClearColor(0x062238, 1);

      const { width: w0, height: h0 } = sizeRef.current;
      const camera = new THREE.OrthographicCamera(-w0 / 2, w0 / 2, h0 / 2, -h0 / 2, 0.1, 4000);
      camera.position.set(0, 800, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 1.1));
      const dir = new THREE.DirectionalLight(0xffffff, 0.7);
      dir.position.set(50, 200, 50);
      scene.add(dir);

      // Cached across mounts: only the first run pays for parsing and baking.
      templateSet = await loadTemplates(realTemplateDeps);
      if (!mountedRef.current || torn) { teardown(); return; }
      const { templates, haveColors } = templateSet;
      const fallbackGeo = new THREE.SphereGeometry(15, 8, 6);
      const fallbackMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });

      const keep = new Set<string>();
      let lastZoom = NaN;
      let lastW = w0;
      let lastH = h0;
      let frame = 0;

      function place(
        key: string, modelName: string, x: number, y: number,
        angle: number, worldSize: number, tint: string,
      ) {
        let mesh = active.get(key);
        if (mesh && (mesh as any).userData?.modelName !== modelName) {
          scene.remove(mesh);
          active.delete(key);
          mesh = undefined;
        }
        if (!mesh) {
          const tpl = templates[modelName];
          if (tpl) {
            mesh = tpl.clone(true);      // shares geometry; materials swapped for shared ones
            applySharedMaterials(mesh, haveColors ? 0xffffff : hexToInt(tint), haveColors);
          } else {
            mesh = new THREE.Mesh(fallbackGeo, fallbackMat);
            mesh.frustumCulled = false;
          }
          (mesh as any).userData = { modelName };
          mesh.visible = true;
          scene.add(mesh);
          active.set(key, mesh);
        }
        mesh.position.set(x, 0, y);
        mesh.rotation.y = -angle + (MODEL_YAW_OFFSET[modelName] ?? Math.PI / 2);
        mesh.scale.setScalar(worldSize / 15);
      }

      const loop = () => {
        if (!mountedRef.current || torn) return;
        rafRef.current = requestAnimationFrame(loop);

        if (hiddenRef.current) return;
        if (pausedRef.current && frame++ % PAUSED_FRAME_DIVISOR !== 0) return;

        const w = worldRef.current;
        if (!w) return;
        try {
          camera.position.x = w.camera.x;
          camera.position.z = w.camera.y;
          camera.lookAt(w.camera.x, 0, w.camera.y);

          const z = w.cameraZoom || 1;
          const { width: sw, height: sh } = sizeRef.current;
          if (z !== lastZoom || sw !== lastW || sh !== lastH) {
            lastZoom = z; lastW = sw; lastH = sh;
            camera.left = -sw / 2 / z;
            camera.right = sw / 2 / z;
            camera.top = sh / 2 / z;
            camera.bottom = -sh / 2 / z;
            camera.updateProjectionMatrix();
          }

          keep.clear();
          const ps = SHIPS_BY_ID[w.player.classId];
          if (ps) {
            place('player', ps.model, w.player.pos.x, w.player.pos.y, w.player.angle, w.player.size, ps.color);
            keep.add('player');
          }
          for (let i = 0; i < w.enemies.length; i++) {
            const e = w.enemies[i];
            const arch = e.isBoss ? BOSS : ENEMIES_BY_ID[e.archetype];
            if (!arch?.model) continue;
            const key = 'e' + e.id;
            place(key, arch.model, e.pos.x, e.pos.y, e.angle, e.size, e.color);
            keep.add(key);
          }
          for (const [key, mesh] of active) {
            if (!keep.has(key)) { scene.remove(mesh); active.delete(key); }
          }

          glbLoadStatus.sceneChildren = scene.children.length;
          r.render(scene, camera);
          gl.endFrameEXP();
          glbLoadStatus.renderFrames += 1;
          fireReady();
        } catch (err: any) {
          // Log the first failure only; a failing frame repeats every frame.
          if (!glbLoadStatus.renderError) {
            const msg = err && err.message ? String(err.message) : String(err);
            glbLoadStatus.renderError = msg.slice(0, 80);
            glbLoadStatus.renderStack = (err && err.stack ? String(err.stack) : '').slice(0, 240);
            console.warn('[Render3D] frame error', err);
          }
          fireReady();                      // never leave the game waiting on a broken renderer
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      const msg = err && err.message ? String(err.message) : String(err);
      glbLoadStatus.initError = msg.slice(0, 80);
      console.warn('[Render3D] init error', err);
      fireReady();
    }
  }

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />;
}
