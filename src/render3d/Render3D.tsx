import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { useRef } from 'react';
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

// Render the playfield as an orthographic top-down 3D scene. Game
// logic still runs in world.ts as 2D physics; this component just
// reads worldRef each frame and positions GLB meshes accordingly.
//
// SVG layer above this GLView continues to draw bullets, pickups,
// particles, salvage rings, and the HUD - the 3D pass only owns
// the ships and the boss.
export function Render3D({ worldRef }: Props) {
  const { width: sw, height: sh } = Dimensions.get('window');
  const startedRef = useRef(false);

  async function onContextCreate(gl: any) {
    if (startedRef.current) return;
    startedRef.current = true;

    const renderer = new Renderer({ gl });
    renderer.setSize(sw, sh);
    renderer.setClearColor(0x062238, 1);

    const scene = new THREE.Scene();

    // Orthographic top-down camera. world Y maps to scene Z so the
    // model's natural "forward" (positive Z in glTF convention)
    // points toward the bottom of the screen.
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

    // Flat lighting - performance over realism per mobile rules.
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(50, 200, 50);
    scene.add(dir);

    // Preload every GLB referenced in GLB_ASSETS. Each template is
    // auto-scaled to roughly 30 world units along its largest axis,
    // then re-centered. Per-entity scale is applied at render time
    // by dividing by 30 and multiplying by ship.size.
    const templates: Record<string, THREE.Object3D> = {};
    const TEMPLATE_BASE_SIZE = 30;
    await Promise.all(
      Object.entries(GLB_ASSETS).map(async ([name, mod]) => {
        try {
          const root = await loadModel(mod);
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) root.scale.setScalar(TEMPLATE_BASE_SIZE / maxDim);
          box.setFromObject(root);
          const center = box.getCenter(new THREE.Vector3());
          root.position.sub(center);
          templates[name] = root;
        } catch (err) {
          console.warn('[Render3D] Failed to load GLB', name, err);
        }
      })
    );

    // Active meshes keyed by entity id. Player is 'player', enemies
    // are 'e' + index. Reused across frames to avoid scene churn.
    const active = new Map<string, THREE.Object3D>();

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
        if (!tpl) return;
        mesh = tpl.clone(true);
        scene.add(mesh);
        active.set(key, mesh);
      }
      mesh.position.set(x, 0, y);
      // Adjust for glTF +Z forward vs world angle convention.
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
      const w = worldRef.current;
      if (!w) {
        requestAnimationFrame(render);
        return;
      }

      // Camera follows world camera; orthographic so no perspective.
      camera.position.x = w.camera.x;
      camera.position.z = w.camera.y;
      camera.lookAt(w.camera.x, 0, w.camera.y);
      camera.up.set(0, 0, -1);

      const keep = new Set<string>();

      // Player
      const ps = SHIPS_BY_ID[w.player.classId];
      if (ps) {
        place('player', ps.model, w.player.pos.x, w.player.pos.y, w.player.angle, w.player.size);
        keep.add('player');
      }

      // Enemies
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
