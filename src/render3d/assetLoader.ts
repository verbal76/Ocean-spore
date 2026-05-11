// GLB loading utility. PIPELINE.md section 3 documents that
// `fetch(file://...)` on Android is unreliable for binary assets -
// it returns an empty body or hangs. The workaround is to read the
// asset via expo-file-system as base64, then decode to an ArrayBuffer
// and pass that buffer directly to three.js's GLTFLoader.parse().
//
// Prefer Buffer.from(b64, 'base64') for the decode - it is the
// canonical Node-compatible path and avoids the String.charCodeAt
// loop. Fall back to atob if Buffer isn't available in the runtime.
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

export async function loadModel(mod: number): Promise<THREE.Object3D> {
  const buf = await loadGLBAsArrayBuffer(mod);
  return parseGLB(buf);
}
