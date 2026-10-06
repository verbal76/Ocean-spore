import * as FileSystem from 'expo-file-system/legacy';
import { defaultSave, parseSave, SaveData } from './saveSchema';

export type { SaveData } from './saveSchema';

// Persistent player memory written to the app's private document
// directory. Survives app restart, screen rotation, and game-over.
// Wiped only on app uninstall or explicit cache clear.
//
// Writes are atomic (temp file, then move over the real file, keeping the
// previous good save as a backup) and serialized, so a kill mid-write or two
// overlapping saves can never leave a truncated or interleaved file.

function basePath(): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  return dir + 'ocean-spore-save.json';
}

async function exists(path: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(path)).exists;
}

async function readParsed(path: string): Promise<SaveData | null> {
  if (!(await exists(path))) return null;
  return parseSave(await FileSystem.readAsStringAsync(path));
}

export async function loadSave(): Promise<SaveData> {
  const path = basePath();
  if (!path) return defaultSave();
  try {
    const main = await readParsed(path);
    if (main) return main;
    // Main file missing or unreadable: try the backup of the last good save.
    const backup = await readParsed(path + '.bak');
    if (backup) return backup;
    // Both bad. If a damaged main file exists keep it for diagnosis rather
    // than letting the next save overwrite the evidence.
    if (await exists(path)) {
      await FileSystem.moveAsync({ from: path, to: path + '.corrupt' }).catch(() => {});
    }
  } catch (err) {
    console.warn('[persistence] load failed', err);
  }
  return defaultSave();
}

let writeChain: Promise<void> = Promise.resolve();

async function writeAtomic(path: string, data: SaveData): Promise<void> {
  const tmp = path + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(data));
  if (await exists(path)) {
    await FileSystem.deleteAsync(path + '.bak', { idempotent: true });
    await FileSystem.moveAsync({ from: path, to: path + '.bak' });
  }
  await FileSystem.moveAsync({ from: tmp, to: path });
}

export function saveSave(data: SaveData): Promise<void> {
  const path = basePath();
  if (!path) return Promise.resolve();
  const snapshot = { ...data, unlockedShips: [...data.unlockedShips] };
  writeChain = writeChain
    .then(() => writeAtomic(path, snapshot))
    .catch((err) => {
      console.warn('[persistence] save failed', err);
    });
  return writeChain;
}

// Resolves once every save queued so far has hit disk.
export function flushSaves(): Promise<void> {
  return writeChain;
}

export async function clearSave(): Promise<void> {
  const path = basePath();
  if (!path) return;
  await writeChain;
  try {
    for (const p of [path, path + '.bak', path + '.tmp', path + '.corrupt']) {
      await FileSystem.deleteAsync(p, { idempotent: true });
    }
  } catch (err) {
    console.warn('[persistence] clear failed', err);
  }
}
