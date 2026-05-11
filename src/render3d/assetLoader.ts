// GLB loading utility. PIPELINE.md section 3 documents that
// `fetch(file://...)` on Android is unreliable for binary assets -
// it returns an empty body or hangs. The workaround is to read the
// asset via expo-file-system as base64, then decode to an ArrayBuffer
// with the Hermes-native `atob`, and pass that buffer directly to
// three.js's GLTFLoader.parse().
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

const bufferCache: Record<string, ArrayBuffer> = {};
const loader = new GLTFLoader();

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
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  bufferCache[key] = bytes.buffer;
  return bytes.buffer;
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
