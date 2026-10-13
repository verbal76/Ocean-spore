// Desktop target: assets are plain files served from the app origin, so a normal
// fetch is reliable (and expo-file-system has no web implementation).
import { Asset } from 'expo-asset';

export async function readAssetBytes(mod: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Asset has no URI');
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Asset fetch failed (${res.status}): ${uri}`);
  return res.arrayBuffer();
}
