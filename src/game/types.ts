import { Vec2 } from '../util/math';

export type { Vec2 };

export interface ShipClass {
  id: string;
  name: string;
  description: string;
  baseHull: number;
  baseSpeed: number;
  baseTurn: number;
  baseDamage: number;
  baseFireRate: number;
  color: string;
  size: number;
  unlockKills: number;
  model: string; // GLB filename without extension, in assets/
}

export interface WakePoint {
  x: number;
  y: number;
  angle: number;
}

export interface PlayerShip {
  classId: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  maxHull: number;
  speed: number;
  turn: number;
  damage: number;
  fireRate: number;
  fireCooldown: number;
  weaponMode: number;
  size: number;
  color: string;
  wake: WakePoint[];
}

export interface EnemyShip {
  id: number;
  archetype: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  maxHull: number;
  speed: number;
  damage: number;
  fireCooldown: number;
  size: number;
  color: string;
  partsDrop: number;
  isBoss?: boolean;
  tier?: 'elite';
  /** Seconds until this enemy can deal contact damage again. */
  contactCooldown?: number;
  wake: WakePoint[];
}

export interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  damage: number;
  owner: 'player' | 'enemy';
  color: string;
  size: number;
}

export interface Pickup {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  amount: number;
  kind: 'parts' | 'crate';
  color: string;
}

export interface Harbor {
  pos: Vec2;
  radius: number;
  name: string;
  discovered: boolean;
}

export interface SalvageRing {
  pos: Vec2;
  radius: number;
  charges: number;
  active: boolean;
  cooldown: number;
  pulse: number;
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type GameScreen =
  | 'brand'
  | 'splash'
  | 'captain'
  | 'shipyard'
  | 'playing'
  | 'docked'
  | 'dead';

export interface UpgradeState {
  hullLevel: number;
  speedLevel: number;
  damageLevel: number;
  fireRateLevel: number;
  magnetLevel: number;
  regenLevel: number;
}

export type UpgradeKey = keyof UpgradeState;

export interface Run {
  /** Simulated seconds spent actually sailing (excludes pause, harbor, background). */
  activeSeconds: number;
  parts: number;
  totalParts: number;
  kills: number;
  score: number;
  momentum: number;
  weather: 'clear' | 'storm';
  weatherUntil: number;
  weatherCooldown: number;
  shipClassId: string;
  upgrades: UpgradeState;
  unlockedShips: string[];
  bossSpawned: boolean;
  nextBossAt: number;
  weaponMode: number;
}
