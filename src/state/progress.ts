import { shipsUnlockedByKills } from '../data/ships';

// The one place a finished (or abandoned) run is rolled into the player's
// lifetime progress. Pure, so it is unit-tested; App uses it for both the
// game-over and save-and-quit paths (they used to be two diverging copies).

export interface Progress {
  unlockedShips: string[];
  highScore: number;
  totalKills: number;
  totalParts: number;
}

export interface RunSummary {
  score: number;
  kills: number;
  totalParts: number;
  unlockedShips: string[];
}

export function rollUpRun(
  before: Progress,
  run: RunSummary,
): { next: Progress; newlyUnlocked: string[] } {
  const totalKills = before.totalKills + Math.max(0, run.kills);
  const owned = new Set<string>([
    ...before.unlockedShips,
    ...run.unlockedShips,
    ...shipsUnlockedByKills(totalKills),
  ]);
  const newlyUnlocked = Array.from(owned).filter((id) => !before.unlockedShips.includes(id));
  return {
    next: {
      unlockedShips: Array.from(owned),
      highScore: Math.max(before.highScore, run.score),
      totalKills,
      totalParts: before.totalParts + Math.max(0, run.totalParts),
    },
    newlyUnlocked,
  };
}
