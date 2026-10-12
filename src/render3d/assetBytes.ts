// Reads a bundled asset (GLB / PNG) as raw bytes. Android/default build: the asset is
// copied to the file system by expo-asset and read as base64 through expo-file-system
// (PIPELINE.md: fetch(file://...) is unreliable for binary assets on Android), then
// decoded. This is the code that previously lived inline in assetLoader.ts / colormap.ts,
// moved here unchanged so the desktop build can supply assetBytes.web.ts (plain fetch).
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

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

export async function readAssetBytes(mod: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Asset has no URI');
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ToArrayBuffer(b64);
}
