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
  const renderer = new THREE.WebGLRenderer({ canvas: fakeCanvas, context: gl });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  if ('outputColorSpace' in renderer) {
    (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}

function forceBasicMaterials(root: THREE.Object3D, fallbackColor: number) {
  root.traverse((obj: any) => {
    if (obj.isMesh) {
      const old = obj.material;
      const color = new THREE.Color(fallbackColor);
      const useVertexColors = !!(old && old.vertexColors);
      obj.material = new THREE.MeshBasicMaterial({
        color,
        vertexColors: useVertexColors,
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
      const TEMPLATE_BASE_SIZE = 30;

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

            inner.traverse((obj: any) => {
              if (obj.isMesh && obj.geometry) {
                obj.geometry.computeBoundingBox();
                obj.geometry.computeBoundingSphere();
              }
            });

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

      // Permanent debug marker - magenta cube at world spawn point.
      const debugMarker = new THREE.Mesh(
        new THREE.BoxGeometry(60, 60, 60),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
      );
      debugMarker.position.set(3000, 0, 3000);
      debugMarker.frustumCulled = false;
      debugMarker.visible = true;
      scene.add(debugMarker);

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
            forceBasicMaterials(mesh, tintColor);
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

      // DIAGNOSTIC: temporarily skip place() of player + enemies. If
      // the magenta debug cube renders alone with this flag on, the
      // GLB-clone path (place + forceBasicMaterials) is what kills
      // the render loop. If even the cube doesn't render, the
      // problem is in the basic renderer setup itself.
      const SKIP_GLB_SHIPS = true;

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

          if (!SKIP_GLB_SHIPS) {
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
          }

          glbLoadStatus.sceneChildren = scene.children.length;

          if (typeof (renderer as any).resetState === 'function') {
            (renderer as any).resetState();
          }
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
