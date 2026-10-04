import { SHIPS_BY_ID } from '../data/ships';

// Pure save-file schema: validation + migration. No I/O here so it can be
// unit-tested without the native file system.

export const SAVE_SCHEMA_VERSION = 2;
export const STARTER_SHIP = 'raft';

export interface SaveData {
  unlockedShips: string[];
  highScore: number;
  totalKills: number;
  totalParts: number;
  lastShip: string;
  captainName: string;
  schemaVersion: number;
}

export const MAX_CAPTAIN_NAME = 24;

// A fresh object every call. Callers mutate state derived from it, so the
// defaults must never be shared by reference.
export function defaultSave(): SaveData {
  return {
    unlockedShips: [STARTER_SHIP],
    highScore: 0,
    totalKills: 0,
    totalParts: 0,
    lastShip: STARTER_SHIP,
    captainName: '',
    schemaVersion: SAVE_SCHEMA_VERSION,
  };
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

// Turn arbitrary parsed JSON into a valid SaveData. Never throws. Unknown
// ship ids are dropped, the starter ship is always unlocked, and lastShip is
// always one the player owns. Older schema versions are accepted; fields
// they lack take defaults.
export function sanitizeSave(raw: unknown): SaveData {
  const out = defaultSave();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.unlockedShips)) {
    const ids = new Set<string>([STARTER_SHIP]);
    for (const id of r.unlockedShips) {
      if (typeof id === 'string' && SHIPS_BY_ID[id]) ids.add(id);
    }
    out.unlockedShips = Array.from(ids);
  }

  out.highScore = count(r.highScore);
  out.totalKills = count(r.totalKills);
  out.totalParts = count(r.totalParts);

  out.lastShip =
    typeof r.lastShip === 'string' && out.unlockedShips.includes(r.lastShip)
      ? r.lastShip
      : STARTER_SHIP;

  out.captainName =
    typeof r.captainName === 'string' ? r.captainName.slice(0, MAX_CAPTAIN_NAME) : '';

  out.schemaVersion = SAVE_SCHEMA_VERSION;
  return out;
}

// Parse + sanitize raw file text. Returns null when the text is not valid
// JSON, so the caller can fall back to a backup instead of silently
// resetting the player's progress.
export function parseSave(text: string): SaveData | null {
  try {
    return sanitizeSave(JSON.parse(text));
  } catch {
    return null;
  }
}
