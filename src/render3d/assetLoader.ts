// GLB loading utility. PIPELINE.md section 3 documents that
// `fetch(file://...)` on Android is unreliable for binary assets -
// it returns an empty body or hangs. The workaround is to read the
// asset via expo-file-system as base64, then decode to an ArrayBuffer
// and pass that buffer directly to three.js's GLTFLoader.parse().
//
// Prefer Buffer.from(b64, 'base64') for the decode - it is the
// canonical Node-compatible path and avoids the String.charCodeAt
// loop. Fall back to atob if Buffer isn't available in the runtime.
//
// IMPORTANT: _polyfills MUST be the first import here. It patches
// navigator.userAgent so three.js's GLTFParser constructor doesn't
// crash on RN. CommonJS transpilation hoists all imports to file
// top, so the polyfill module's side effects run before the
// GLTFLoader module is loaded.
import './_polyfills';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

const bufferCache: Record<string, ArrayBuffer> = {};
const loader = new GLTFLoader();

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    try {
      const buf = Buffer.from(b64, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch {
      /* fall through to atob path */
    }
  }
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes.buffer;
}

export async function loadGLBAsArrayBuffer(mod: number): Promise<ArrayBuffer> {
  const key = String(mod);
  if (bufferCache[key]) return bufferCache[key];

  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Asset has no URI');

  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = base64ToArrayBuffer(b64);
  bufferCache[key] = buffer;
  return buffer;
}

export function parseGLB(buffer: ArrayBuffer): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(err)
    );
  });
}

// Every map-like property a three.js material can hold. We null all
// of these on every parsed material because in React Native the GLB
// loader creates THREE.Texture instances with image=undefined (no
// Image constructor in Hermes). When the WebGLRenderer first
// compiles/uploads textures, its getDimensions helper at
// WebGLTextures.js:26257 does `image.width` with no null check and
// throws 'Cannot read property "width" of undefined' on every frame,
// killing the render loop before it can clear or draw anything.
// We replace every material with MeshBasicMaterial(color) at place
// time anyway, so these texture refs are dead weight - removing them
// here makes the dead refs unreachable before the renderer ever sees
// them.
const TEXTURE_PROPS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap',
  'emissiveMap', 'aoMap', 'bumpMap', 'displacementMap',
  'alphaMap', 'lightMap', 'specularMap', 'envMap', 'gradientMap',
  'matcap', 'clearcoatMap', 'clearcoatRoughnessMap',
  'clearcoatNormalMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'iridescenceMap',
  'iridescenceThicknessMap', 'anisotropyMap',
];

function stripTextures(root: THREE.Object3D): number {
  let stripped = 0;
  root.traverse((obj: any) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      for (const key of TEXTURE_PROPS) {
        if (m[key]) {
          m[key] = null;
          stripped += 1;
        }
      }
    }
  });
  return stripped;
}

export async function loadModel(mod: number): Promise<THREE.Object3D> {
  const buf = await loadGLBAsArrayBuffer(mod);
  const scene = await parseGLB(buf);
  stripTextures(scene);
  return scene;
}
