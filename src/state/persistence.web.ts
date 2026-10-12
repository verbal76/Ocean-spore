import { getBridge } from '../platform/bridge';
import { chooseSave } from './saveCandidates';
import { defaultSave, SaveData } from './saveSchema';

export type { SaveData } from './saveSchema';

// Desktop (web target) storage. In the Electron shell the save is a file in the
// per-user data directory written atomically by the main process (temp file, then
// move, previous good file kept as .bak; see desktop/lib/saveStore.js). Outside the
// shell (plain browser development) localStorage is used with the same main/.bak
// fallback. Android uses persistence.ts and never loads this file.

const LS_MAIN = 'ocean-spore-save';
const LS_BAK = 'ocean-spore-save.bak';

const ls = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

let writeChain: Promise<void> = Promise.resolve();

export async function loadSave(): Promise<SaveData> {
  try {
    const bridge = getBridge();
    if (bridge) {
      const { save, quarantineMain } = chooseSave(await bridge.loadSaveCandidates());
      if (save) return save;
      if (quarantineMain) await bridge.quarantineSave().catch(() => undefined);
      return defaultSave();
    }
    const store = ls();
    if (store) {
      const { save } = chooseSave([store.getItem(LS_MAIN), store.getItem(LS_BAK)]);
      if (save) return save;
    }
  } catch (err) {
    console.warn('[persistence] load failed', err);
  }
  return defaultSave();
}

export function saveSave(data: SaveData): Promise<void> {
  const text = JSON.stringify({ ...data, unlockedShips: [...data.unlockedShips] });
  writeChain = writeChain
    .then(async () => {
      const bridge = getBridge();
      if (bridge) { await bridge.writeSave(text); return; }
      const store = ls();
      if (!store) return;
      const prev = store.getItem(LS_MAIN);
      if (prev !== null) store.setItem(LS_BAK, prev);
      store.setItem(LS_MAIN, text);
    })
    .catch((err) => { console.warn('[persistence] save failed', err); });
  return writeChain;
}

export function flushSaves(): Promise<void> {
  return writeChain;
}

export async function clearSave(): Promise<void> {
  await writeChain;
  const bridge = getBridge();
  if (bridge) { await bridge.clearSave().catch(() => undefined); return; }
  const store = ls();
  store?.removeItem(LS_MAIN);
  store?.removeItem(LS_BAK);
}
