import { ShipClass } from '../game/types';

// Player ship classes: design-doc tier names stay as the player-facing
// names; `model` maps each tier to a specific Kenney GLB so the 3D
// renderer can swap to that mesh when RENDER_3D is enabled.
export const SHIPS: ShipClass[] = [
  {
    id: 'raft',
    name: 'Survival Raft',
    description: 'A bundle of planks and a paddle. Barely floats.',
    baseHull: 50,
    baseSpeed: 70,
    baseTurn: 2.6,
    baseDamage: 6,
    baseFireRate: 2.6,
    color: '#a98c5a',
    size: 14,
    unlockKills: 0,
    model: 'boat-row-small',
  },
  {
    id: 'patrol',
    name: 'Patrol Boat',
    description: 'Reliable starter vessel. Tough enough for the shallows.',
    baseHull: 95,
    baseSpeed: 115,
    baseTurn: 3.2,
    baseDamage: 9,
    baseFireRate: 3.6,
    color: '#94a3b8',
    size: 18,
    unlockKills: 10,
    model: 'boat-tow-b',
  },
  {
    id: 'skiff',
    name: 'Combat Skiff',
    description: 'Fast and twitchy. Run circles around heavy ships.',
    baseHull: 80,
    baseSpeed: 160,
    baseTurn: 4.6,
    baseDamage: 8,
    baseFireRate: 5.5,
    color: '#a3e635',
    size: 17,
    unlockKills: 50,
    model: 'boat-speed-d',
  },
  {
    id: 'gunship',
    name: 'Gunship',
    description: 'Versatile fighter. Heavier guns, decent armor.',
    baseHull: 145,
    baseSpeed: 125,
    baseTurn: 3.0,
    baseDamage: 14,
    baseFireRate: 4.2,
    color: '#22d3ee',
    size: 22,
    unlockKills: 200,
    model: 'boat-tug-a',
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    description: 'Heavy hitter. Slow turn but punishes anything it hits.',
    baseHull: 230,
    baseSpeed: 110,
    baseTurn: 2.4,
    baseDamage: 22,
    baseFireRate: 3.2,
    color: '#60a5fa',
    size: 28,
    unlockKills: 500,
    model: 'ship-small',
  },
  {
    id: 'warship',
    name: 'Heavy Warship',
    description: 'Floating fortress. Deletes pirate skiffs by glancing them.',
    baseHull: 360,
    baseSpeed: 95,
    baseTurn: 2.0,
    baseDamage: 30,
    baseFireRate: 3.6,
    color: '#a78bfa',
    size: 34,
    unlockKills: 1500,
    model: 'ship-cargo-c',
  },
  {
    id: 'fortress',
    name: 'Sea Fortress',
    description: 'You ARE the apocalypse. Pity the ocean.',
    baseHull: 540,
    baseSpeed: 90,
    baseTurn: 1.7,
    baseDamage: 40,
    baseFireRate: 4.2,
    color: '#fbbf24',
    size: 42,
    unlockKills: 5000,
    model: 'ship-ocean-liner',
  },
];

/**
 * Ships earned by lifetime kills. Unlock thresholds (10 .. 5000) are lifetime
 * "mastery" numbers: the save file tracks totalKills and the menus show it
 * beside every threshold. (They were mistakenly compared against kills in a
 * single run, which made the top ships unreachable: 5000 kills at ~4/min is
 * ~21 hours in one run.)
 */
export function shipsUnlockedByKills(lifetimeKills: number): string[] {
  return SHIPS.filter((s) => s.unlockKills <= lifetimeKills).map((s) => s.id);
}

export const SHIPS_BY_ID: Record<string, ShipClass> = SHIPS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<string, ShipClass>
);
