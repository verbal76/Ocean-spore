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
}

export interface EnemyShip {
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
}

export interface Bullet {
  pos: Vec2;
  vel: Vec2;
  life: number;
  damage: number;
  owner: 'player' | 'enemy';
  color: string;
  size: number;
}

export interface Pickup {
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

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type GameScreen = 'title' | 'playing' | 'docked' | 'dead';

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
  startedAt: number;
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
