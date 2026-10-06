export interface EnemyArchetype {
  id: string;
  name: string;
  hull: number;
  speed: number;
  damage: number;
  size: number;
  color: string;
  partsDrop: number;
  threatScore: number;
  fireRange?: number;
  fireRate?: number;
  model: string; // GLB filename without extension, in assets/
}

// Enemy names come from the GLB filenames per design direction - the
// uploaded Kenney models are the source of truth. Display names are
// title-cased forms of the GLB stems.
//
// Index order is referenced by world.ts spawnEnemyAtEdge pool indexing.
// Append new archetypes at the end so existing indexes stay stable.
//   0: boat-fishing-small   1: boat-tug-c    2: boat-tow-a   3: boat-fan
//   4: ship-cargo-a         5: boat-speed-a  6: boat-sail-a
export const ENEMIES: EnemyArchetype[] = [
  {
    id: 'skiff',
    name: 'Boat Fishing Small',
    hull: 14,
    speed: 90,
    damage: 8,
    size: 14,
    color: '#7f1d1d',
    partsDrop: 1,
    threatScore: 1,
    model: 'boat-fishing-small',
  },
  {
    id: 'gunboat',
    name: 'Boat Tug C',
    hull: 32,
    speed: 65,
    damage: 12,
    size: 18,
    color: '#9f1239',
    partsDrop: 3,
    threatScore: 3,
    fireRange: 300,
    fireRate: 0.85,
    model: 'boat-tug-c',
  },
  {
    id: 'raider',
    name: 'Boat Tow A',
    hull: 75,
    speed: 50,
    damage: 22,
    size: 24,
    color: '#7e22ce',
    partsDrop: 8,
    threatScore: 6,
    fireRange: 240,
    fireRate: 0.5,
    model: 'boat-tow-a',
  },
  {
    id: 'drone',
    name: 'Boat Fan',
    hull: 5,
    speed: 150,
    damage: 5,
    size: 10,
    color: '#0ea5e9',
    partsDrop: 1,
    threatScore: 1,
    model: 'boat-fan',
  },
  {
    id: 'cargo',
    name: 'Ship Cargo A',
    hull: 45,
    speed: 55,
    damage: 6,
    size: 24,
    color: '#a3a3a3',
    partsDrop: 12,
    threatScore: 4,
    model: 'ship-cargo-a',
  },
  {
    id: 'fanboat',
    name: 'Boat Speed A',
    hull: 18,
    speed: 175,
    damage: 18,
    size: 12,
    color: '#fb923c',
    partsDrop: 2,
    threatScore: 2,
    model: 'boat-speed-a',
  },
  {
    id: 'sniper',
    name: 'Boat Sail A',
    hull: 22,
    speed: 60,
    damage: 16,
    size: 16,
    color: '#86efac',
    partsDrop: 4,
    threatScore: 4,
    fireRange: 420,
    fireRate: 0.55,
    model: 'boat-sail-a',
  },
];

export const ENEMIES_BY_ID: Record<string, EnemyArchetype> = ENEMIES.reduce(
  (acc, e) => ({ ...acc, [e.id]: e }),
  {} as Record<string, EnemyArchetype>
);

export const BOSS: EnemyArchetype = {
  id: 'dreadnought',
  name: 'Ship Large',
  hull: 650,
  speed: 38,
  damage: 38,
  size: 60,
  color: '#dc2626',
  partsDrop: 240,
  threatScore: 40,
  fireRange: 380,
  fireRate: 1.7,
  model: 'ship-large',
};
