// Manual colormap.png loader. RN/Hermes has no Image constructor so
// three.js's TextureLoader can't decode PNGs - the texture comes out
// with image=undefined and crashes WebGLRenderer on first frame.
// Workaround: read the PNG bytes ourselves, decode via upng-js (pure
// JS PNG codec, ~30KB), then construct a THREE.DataTexture from the
// raw RGBA pixel array. DataTexture takes width/height + Uint8Array
// directly - no DOM Image needed.
//
// Kenney's watercraft pack uses a single shared palette texture
// (assets/colormap.png) sampled by per-vertex UVs. Each face of a
// boat has UVs pointing at a specific palette pixel, so the same
// texture colors the entire pack. Without the texture, all faces
// fall back to the material color (one flat tint per ship). With
// it, ships look like Kenney's web preview - multi-colored.
import './_polyfills';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
// @ts-ignore - upng-js has no type definitions
import UPNG from 'upng-js';
import * as THREE from 'three';

const COLORMAP_MOD = require('../../assets/colormap.png');

let cached: THREE.DataTexture | null = null;
let loadPromise: Promise<THREE.DataTexture | null> | null = null;

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

export async function loadColormapTexture(): Promise<THREE.DataTexture | null> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
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
      // UPNG.toRGBA8 returns an array of frames (for APNG); for a
      // static PNG, [0] is the only frame as ArrayBuffer of RGBA bytes.
      const rgbaBuf = UPNG.toRGBA8(png)[0];
      const rgba = new Uint8Array(rgbaBuf);

      const tex = new THREE.DataTexture(
        rgba,
        png.width,
        png.height,
        THREE.RGBAFormat,
        THREE.UnsignedByteType
      );
      // NearestFilter so the palette samples land on exact pixels -
      // Kenney's UVs are tuned to nearest-pixel sampling and this
      // also avoids the magfilter mip-level path which can trip on
      // odd-sized textures.
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      // Build #27 had flipY=true and ships came out solid black -
      // UVs were landing on the dark area of the palette. Kenney's
      // GLBs author UVs assuming three.js's default (no flip), since
      // their pipeline exports for desktop three.js / web viewer
      // which uses flipY=false on DataTextures. Setting flipY=false
      // matches their authoring orientation.
      tex.flipY = false;
      tex.needsUpdate = true;
      cached = tex;
      return tex;
    } catch (err: any) {
      console.warn('[colormap] failed to load', err);
      return null;
    }
  })();

  return loadPromise;
}
