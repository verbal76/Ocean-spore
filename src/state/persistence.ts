import * as FileSystem from 'expo-file-system';

// Persistent player memory written to the app's private document
// directory. Survives app restart, screen rotation, and game-over.
// Wiped only on app uninstall or explicit cache clear.

export interface SaveData {
  unlockedShips: string[];
  highScore: number;
  totalKills: number;
  totalParts: number;
  lastShip: string;
  schemaVersion: number;
}

const DEFAULT_SAVE: SaveData = {
  unlockedShips: ['raft'],
  highScore: 0,
  totalKills: 0,
  totalParts: 0,
  lastShip: 'raft',
  schemaVersion: 1,
};

function savePath(): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  return dir + 'ocean-spore-save.json';
}

export async function loadSave(): Promise<SaveData> {
  const path = savePath();
  if (!path) return DEFAULT_SAVE;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return DEFAULT_SAVE;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...parsed };
  } catch (err) {
    console.warn('[persistence] load failed', err);
    return DEFAULT_SAVE;
  }
}

export async function saveSave(data: SaveData): Promise<void> {
  const path = savePath();
  if (!path) return;
  try {
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
  } catch (err) {
    console.warn('[persistence] save failed', err);
  }
}

export async function clearSave(): Promise<void> {
  const path = savePath();
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch (err) {
    console.warn('[persistence] clear failed', err);
  }
}
