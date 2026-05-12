// Manual colormap.png loader. RN/Hermes has no Image constructor so
// three.js's TextureLoader can't decode PNGs - the texture comes out
// with image=undefined and crashes WebGLRenderer on first frame.
//
// Two modes of use:
//   1. loadColormapTexture() returns a DataTexture for material.map
//   2. loadColormapSampler() returns a (u, v) -> [r,g,b] function so
//      we can bake vertex colors at template-load time. This is the
//      preferred path in #28 - it bypasses three.js's texture upload
//      pipeline entirely, which gave us black ships in #27.
import './_polyfills';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
// @ts-ignore - upng-js has no type definitions
import UPNG from 'upng-js';
import * as THREE from 'three';

const COLORMAP_MOD = require('../../assets/colormap.png');

interface DecodedColormap {
  rgba: Uint8Array;
  width: number;
  height: number;
}

let decoded: DecodedColormap | null = null;
let texCached: THREE.DataTexture | null = null;
let samplerCached: ColormapSampler | null = null;
let decodePromise: Promise<DecodedColormap | null> | null = null;

export type ColormapSampler = (u: number, v: number) => [number, number, number];

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    try {
      const buf = Buffer.from(b64, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch {
      /* fall through */
    }
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function decodeColormap(): Promise<DecodedColormap | null> {
  if (decoded) return decoded;
  if (decodePromise) return decodePromise;

  decodePromise = (async () => {
    try {
      const asset = Asset.fromModule(COLORMAP_MOD);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri) return null;
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const buf = base64ToArrayBuffer(b64);

      const png = UPNG.decode(buf);
      const rgbaBuf = UPNG.toRGBA8(png)[0];
      const rgba = new Uint8Array(rgbaBuf);
      decoded = { rgba, width: png.width, height: png.height };
      return decoded;
    } catch (err: any) {
      console.warn('[colormap] decode failed', err);
      return null;
    }
  })();

  return decodePromise;
}

export async function loadColormapTexture(): Promise<THREE.DataTexture | null> {
  if (texCached) return texCached;
  const d = await decodeColormap();
  if (!d) return null;
  const tex = new THREE.DataTexture(
    d.rgba as any, d.width, d.height,
    THREE.RGBAFormat, THREE.UnsignedByteType
  );
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  texCached = tex;
  return tex;
}

// Returns a function that maps a UV pair to its RGB color (0-1 range).
// Used for baking vertex colors into geometry at template load time so
// we never touch the GPU texture-upload path - that path returns black
// in expo-gl + RN regardless of how we configure the DataTexture.
export async function loadColormapSampler(): Promise<ColormapSampler | null> {
  if (samplerCached) return samplerCached;
  const d = await decodeColormap();
  if (!d) return null;
  const { rgba, width, height } = d;
  samplerCached = (u: number, v: number) => {
    // Sample without flipping v. Build #28's COLORMAP diagnostic
    // showed '512x512 00 00 00 ff ...' - the top-left of the palette
    // is black. We were flipping v (`1 - vc`) which mapped Kenney's
    // low-UV samples to the BOTTOM of the image (row ~504), which
    // is also black. Without the flip, low UVs map to the top
    // (where Kenney puts the colored palette swatches).
    const uc = Math.max(0, Math.min(1, u));
    const vc = Math.max(0, Math.min(1, v));
    const px = Math.min(width - 1, Math.floor(uc * width));
    const py = Math.min(height - 1, Math.floor(vc * height));
    const idx = (py * width + px) * 4;
    return [rgba[idx] / 255, rgba[idx + 1] / 255, rgba[idx + 2] / 255];
  };
  return samplerCached;
}

// Diagnostic: returns the first N bytes of the decoded RGBA buffer
// (top-left of the palette) plus a sample at UV (0.014, 0.014) -
// the typical low-UV that Kenney's boat GLBs use. If the sample is
// non-black, the sampler is hitting real palette colors.
export async function colormapDiagSample(): Promise<string> {
  const d = await decodeColormap();
  if (!d) return 'decode-failed';
  const { rgba, width, height } = d;
  const head = Array.from(rgba.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  // Sample at the typical low-UV used by Kenney boats. Same logic
  // as the sampler (no v flip).
  const px = Math.min(width - 1, Math.floor(0.014 * width));
  const py = Math.min(height - 1, Math.floor(0.014 * height));
  const idx = (py * width + px) * 4;
  const sample = `${rgba[idx].toString(16).padStart(2, '0')} ${rgba[idx + 1].toString(16).padStart(2, '0')} ${rgba[idx + 2].toString(16).padStart(2, '0')}`;
  return `${width}x${height} top:${head} uv(.014):${sample}`;
}
