import { SHIPS_BY_ID } from '../data/ships';
import { ENEMIES, ENEMIES_BY_ID, BOSS } from '../data/enemies';
import { upgradeCost } from '../data/upgrades';
import { angleDiff, clamp, lerp } from '../util/math';
import {
  Bullet,
  EnemyShip,
  Harbor,
  Particle,
  Pickup,
  PlayerShip,
  Run,
  SalvageRing,
  UpgradeKey,
  UpgradeState,
  Vec2,
} from './types';

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 2400;

export interface World {
  player: PlayerShip;
  enemies: EnemyShip[];
  bullets: Bullet[];
  pickups: Pickup[];
  particles: Particle[];
  harbors: Harbor[];
  salvageRings: SalvageRing[];
  run: Run;
  camera: Vec2;
  spawnTimer: number;
  crateTimer: number;
  dockedHarborIndex: number;
  nearHarborIndex: number;
  shake: number;
  elapsed: number;
}

export interface InputState {
  dx: number;
  dy: number;
  fire: boolean;
  autoFire: boolean;
}

const HARBOR_NAMES = [
  'Driftwood Cove',
  'Saltspire',
  'Ironbreak',
  'Pearl Reef',
  'Boneyard',
  'Stormgate',
];

function newSalvageRing(): SalvageRing {
  return {
    pos: {
      x: 140 + Math.random() * (WORLD_WIDTH - 280),
      y: 140 + Math.random() * (WORLD_HEIGHT - 280),
    },
    radius: 58,
    charges: 4 + Math.floor(Math.random() * 6),
    active: true,
    cooldown: 0,
    pulse: Math.random() * Math.PI * 2,
  };
}

export function createWorld(shipClassId: string, unlocked: string[]): World {
  const ship = SHIPS_BY_ID[shipClassId];
  const player: PlayerShip = {
    classId: shipClassId,
    pos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    vel: { x: 0, y: 0 },
    angle: 0,
    hull: ship.baseHull,
    maxHull: ship.baseHull,
    speed: ship.baseSpeed,
    turn: ship.baseTurn,
    damage: ship.baseDamage,
    fireRate: ship.baseFireRate,
    fireCooldown: 0,
    weaponMode: 0,
    size: ship.size,
    color: ship.color,
  };

  const harbors: Harbor[] = [];
  const harborCount = 4;
  for (let i = 0; i < harborCount; i++) {
    const angle = (i / harborCount) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 720 + Math.random() * 280;
    harbors.push({
      pos: {
        x: clamp(WORLD_WIDTH / 2 + Math.cos(angle) * dist, 160, WORLD_WIDTH - 160),
        y: clamp(WORLD_HEIGHT / 2 + Math.sin(angle) * dist, 160, WORLD_HEIGHT - 160),
      },
      radius: 95,
      name: HARBOR_NAMES[i % HARBOR_NAMES.length],
      discovered: false,
    });
  }

  const salvageRings: SalvageRing[] = [];
  for (let i = 0; i < 8; i++) salvageRings.push(newSalvageRing());

  return {
    player,
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    harbors,
    salvageRings,
    run: {
      startedAt: Date.now(),
      parts: 0,
      totalParts: 0,
      kills: 0,
      score: 0,
      momentum: 0,
      weather: 'clear',
      weatherUntil: 0,
      weatherCooldown: 50 + Math.random() * 20,
      shipClassId,
      upgrades: {
        hullLevel: 0,
        speedLevel: 0,
        damageLevel: 0,
        fireRateLevel: 0,
        magnetLevel: 0,
        regenLevel: 0,
      },
      unlockedShips: unlocked,
      bossSpawned: false,
      nextBossAt: 100,
      weaponMode: 0,
    },
    camera: { x: player.pos.x, y: player.pos.y },
    spawnTimer: 2,
    crateTimer: 22,
    dockedHarborIndex: -1,
    nearHarborIndex: -1,
    shake: 0,
    elapsed: 0,
  };
}

export function applyUpgrades(world: World) {
  const u = world.run.upgrades;
  const p = world.player;
  const base = SHIPS_BY_ID[p.classId];
  const oldFrac = p.maxHull > 0 ? p.hull / p.maxHull : 1;
  p.maxHull = base.baseHull + u.hullLevel * 30;
  p.hull = clamp(oldFrac * p.maxHull, 0, p.maxHull);
  p.speed = base.baseSpeed * (1 + u.speedLevel * 0.08);
  p.turn = base.baseTurn * (1 + u.speedLevel * 0.03);
  p.damage = base.baseDamage * (1 + u.damageLevel * 0.18);
  p.fireRate = base.baseFireRate * (1 + u.fireRateLevel * 0.15);
}

export function repairPlayer(world: World, percent: number) {
  world.player.hull = clamp(
    world.player.hull + world.player.maxHull * percent,
    0,
    world.player.maxHull
  );
}

export function repairCost(world: World): number {
  const missing = world.player.maxHull - world.player.hull;
  return Math.max(1, Math.ceil(missing * 0.4));
}

export function tryRepair(world: World): boolean {
  const cost = repairCost(world);
  if (world.run.parts < cost) return false;
  world.run.parts -= cost;
  world.player.hull = world.player.maxHull;
  return true;
}

export function tryUpgrade(world: World, key: UpgradeKey): boolean {
  const lvl = world.run.upgrades[key];
  const cost = upgradeCost(key, lvl);
  if (world.run.parts < cost) return false;
  world.run.parts -= cost;
  world.run.upgrades[key] = lvl + 1;
  applyUpgrades(world);
  return true;
}

export function switchShip(world: World, shipClassId: string) {
  world.run.shipClassId = shipClassId;
  world.player.classId = shipClassId;
  const base = SHIPS_BY_ID[shipClassId];
  world.player.size = base.size;
  world.player.color = base.color;
  applyUpgrades(world);
  world.player.hull = world.player.maxHull;
}

export function cycleWeapon(world: World) {
  world.run.weaponMode = (world.run.weaponMode + 1) % 3;
  world.player.weaponMode = world.run.weaponMode;
}

function spawnParticles(world: World, pos: Vec2, color: string, count: number, speed = 120) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.9);
    world.particles.push({
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      life: 0.45 + Math.random() * 0.4,
      maxLife: 0.85,
      color,
      size: 3 + Math.random() * 3,
    });
  }
}

function dropPartsPickup(world: World, pos: Vec2, amount: number) {
  const a = Math.random() * Math.PI * 2;
  world.pickups.push({
    pos: { x: pos.x + Math.cos(a) * 12, y: pos.y + Math.sin(a) * 12 },
    vel: { x: Math.cos(a) * 60, y: Math.sin(a) * 60 },
    life: 18,
    amount,
    kind: 'parts',
    color: '#22d3ee',
  });
}

function spawnEnemyAtEdge(world: World) {
  const cam = world.camera;
  const a = Math.random() * Math.PI * 2;
  const r = 620;
  const pos: Vec2 = {
    x: clamp(cam.x + Math.cos(a) * r, 50, WORLD_WIDTH - 50),
    y: clamp(cam.y + Math.sin(a) * r, 50, WORLD_HEIGHT - 50),
  };

  const k = world.run.kills;
  const pool: typeof ENEMIES = [ENEMIES[0]];
  if (k > 5) pool.push(ENEMIES[3]);
  if (k > 15) pool.push(ENEMIES[1]);
  if (k > 40) pool.push(ENEMIES[1]);
  if (k > 80) pool.push(ENEMIES[2]);
  if (k > 150) pool.push(ENEMIES[2]);
  const arch = pool[Math.floor(Math.random() * pool.length)];

  world.enemies.push({
    archetype: arch.id,
    pos,
    vel: { x: 0, y: 0 },
    angle: Math.atan2(world.player.pos.y - pos.y, world.player.pos.x - pos.x),
    hull: arch.hull,
    maxHull: arch.hull,
    speed: arch.speed,
    damage: arch.damage,
    fireCooldown: arch.fireRate ? Math.random() / arch.fireRate : 0,
    size: arch.size,
    color: arch.color,
    partsDrop: arch.partsDrop,
  });
}

function spawnBoss(world: World) {
  const cam = world.camera;
  const a = Math.random() * Math.PI * 2;
  world.enemies.push({
    archetype: BOSS.id,
    pos: {
      x: clamp(cam.x + Math.cos(a) * 520, 90, WORLD_WIDTH - 90),
      y: clamp(cam.y + Math.sin(a) * 520, 90, WORLD_HEIGHT - 90),
    },
    vel: { x: 0, y: 0 },
    angle: 0,
    hull: BOSS.hull,
    maxHull: BOSS.hull,
    speed: BOSS.speed,
    damage: BOSS.damage,
    fireCooldown: 1.2,
    size: BOSS.size,
    color: BOSS.color,
    partsDrop: BOSS.partsDrop,
    isBoss: true,
  });
  world.run.bossSpawned = true;
  world.shake = Math.max(world.shake, 12);
}

function dropCrate(world: World) {
  const cam = world.camera;
  const a = Math.random() * Math.PI * 2;
  const r = 280 + Math.random() * 240;
  world.pickups.push({
    pos: {
      x: clamp(cam.x + Math.cos(a) * r, 40, WORLD_WIDTH - 40),
      y: clamp(cam.y + Math.sin(a) * r, 40, WORLD_HEIGHT - 40),
    },
    vel: { x: 0, y: 0 },
    life: 32,
    amount: 8 + Math.floor(Math.random() * 14),
    kind: 'crate',
    color: '#fbbf24',
  });
}

function fireBullets(world: World) {
  const p = world.player;
  const speed = 560;
  const offsets =
    p.weaponMode === 1
      ? [-0.2, 0, 0.2]
      : p.weaponMode === 2
      ? [-0.06, 0.06]
      : [0];
  for (const off of offsets) {
    const a = p.angle + off;
    world.bullets.push({
      pos: { x: p.pos.x + Math.cos(p.angle) * 14, y: p.pos.y + Math.sin(p.angle) * 14 },
      vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      life: 1.6,
      damage: p.damage * (p.weaponMode === 1 ? 0.85 : 1),
      owner: 'player',
      color: '#fde047',
      size: 4,
    });
  }
}

function tryUnlockShips(world: World) {
  const k = world.run.kills;
  for (const id of Object.keys(SHIPS_BY_ID)) {
    const def = SHIPS_BY_ID[id];
    if (k >= def.unlockKills && !world.run.unlockedShips.includes(id)) {
      world.run.unlockedShips.push(id);
    }
  }
}

// Per-archetype movement intent. Returns a scalar multiplier on the
// approach direction: 1 = chase, 0 = hover, negative = flee.
function movementIntent(archetype: string, dst: number, isBoss?: boolean): number {
  if (isBoss) return 1;
  switch (archetype) {
    case 'skiff':
      // Small pirate - skittish: flee inside 180, chase outside
      return dst < 180 ? -0.9 : 1;
    case 'drone':
      // Tiny - very skittish, flees easily
      return dst < 220 ? -1.1 : 1;
    case 'gunboat':
      // Medium kiter: back off close, advance far, hover at mid
      if (dst < 230) return -0.5;
      if (dst > 300) return 1;
      return 0;
    case 'raider':
      // Heavy - always presses
      return 1;
    default:
      return 1;
  }
}

export function tick(world: World, dt: number, input: InputState): { died: boolean } {
  if (world.dockedHarborIndex >= 0) return { died: false };
  world.elapsed += dt;

  const run = world.run;
  const p = world.player;

  // Weather rotation
  const now = Date.now() / 1000;
  if (run.weather === 'storm' && now > run.weatherUntil) {
    run.weather = 'clear';
    run.weatherCooldown = 35 + Math.random() * 30;
  } else if (run.weather === 'clear') {
    run.weatherCooldown -= dt;
    if (run.weatherCooldown <= 0) {
      run.weather = 'storm';
      run.weatherUntil = now + 16 + Math.random() * 10;
      world.shake = Math.max(world.shake, 6);
    }
  }
  const weatherSpeed = run.weather === 'storm' ? 0.78 : 1;

  // Player movement
  const inputMag = Math.hypot(input.dx, input.dy);
  if (inputMag > 0.08) {
    const wantAngle = Math.atan2(input.dy, input.dx);
    const diff = angleDiff(p.angle, wantAngle);
    const maxTurn = p.turn * dt;
    p.angle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
    const targetSpeed = inputMag * p.speed * weatherSpeed;
    p.vel.x = lerp(p.vel.x, Math.cos(p.angle) * targetSpeed, 1 - Math.exp(-3 * dt));
    p.vel.y = lerp(p.vel.y, Math.sin(p.angle) * targetSpeed, 1 - Math.exp(-3 * dt));
  } else {
    p.vel.x *= Math.max(0, 1 - 0.6 * dt);
    p.vel.y *= Math.max(0, 1 - 0.6 * dt);
  }
  p.pos.x = clamp(p.pos.x + p.vel.x * dt, 20, WORLD_WIDTH - 20);
  p.pos.y = clamp(p.pos.y + p.vel.y * dt, 20, WORLD_HEIGHT - 20);

  // Regen
  if (run.upgrades.regenLevel > 0) {
    p.hull = clamp(p.hull + run.upgrades.regenLevel * 1.2 * dt, 0, p.maxHull);
  }

  // Camera follow
  world.camera.x = lerp(world.camera.x, p.pos.x, 1 - Math.exp(-4 * dt));
  world.camera.y = lerp(world.camera.y, p.pos.y, 1 - Math.exp(-4 * dt));
  world.shake = Math.max(0, world.shake - dt * 10);

  // Fire
  p.fireCooldown -= dt;
  const wantFire = input.fire || input.autoFire;
  if (wantFire && p.fireCooldown <= 0) {
    fireBullets(world);
    p.fireCooldown = 1 / p.fireRate;
  }

  // Bullets
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.life -= dt;
    if (b.life <= 0 || b.pos.x < 0 || b.pos.x > WORLD_WIDTH || b.pos.y < 0 || b.pos.y > WORLD_HEIGHT) {
      world.bullets.splice(i, 1);
      continue;
    }
    if (b.owner === 'player') {
      for (let j = world.enemies.length - 1; j >= 0; j--) {
        const e = world.enemies[j];
        if (Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y) < e.size + b.size) {
          e.hull -= b.damage;
          spawnParticles(world, b.pos, '#fcd34d', 4, 70);
          world.bullets.splice(i, 1);
          if (e.hull <= 0) {
            spawnParticles(world, e.pos, e.color, e.isBoss ? 40 : 16, 200);
            spawnParticles(world, e.pos, '#fbbf24', e.isBoss ? 24 : 8, 250);
            const drops = e.isBoss ? 8 : 1;
            for (let d = 0; d < drops; d++) {
              dropPartsPickup(world, e.pos, e.isBoss ? Math.floor(e.partsDrop / drops) : e.partsDrop);
            }
            run.kills += 1;
            run.score += e.isBoss ? 5000 : 100;
            run.momentum = Math.min(100, run.momentum + (e.isBoss ? 40 : 8));
            world.shake = Math.max(world.shake, e.isBoss ? 16 : 3);
            if (e.isBoss) {
              run.bossSpawned = false;
              run.nextBossAt = run.kills + 150 + Math.floor(Math.random() * 50);
            }
            tryUnlockShips(world);
            world.enemies.splice(j, 1);
          }
          break;
        }
      }
    } else {
      if (Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y) < p.size + b.size) {
        p.hull -= b.damage;
        spawnParticles(world, b.pos, '#fca5a5', 6, 100);
        world.bullets.splice(i, 1);
        world.shake = Math.max(world.shake, 2);
      }
    }
  }

  // Enemies
  for (let j = world.enemies.length - 1; j >= 0; j--) {
    const e = world.enemies[j];
    const dx = p.pos.x - e.pos.x;
    const dy = p.pos.y - e.pos.y;
    const dst = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    const intent = movementIntent(e.archetype, dst, e.isBoss);
    const targetSpeed = e.speed * weatherSpeed * intent;
    e.vel.x = lerp(e.vel.x, (dx / dst) * targetSpeed, 1 - Math.exp(-2.5 * dt));
    e.vel.y = lerp(e.vel.y, (dy / dst) * targetSpeed, 1 - Math.exp(-2.5 * dt));
    e.pos.x = clamp(e.pos.x + e.vel.x * dt, 10, WORLD_WIDTH - 10);
    e.pos.y = clamp(e.pos.y + e.vel.y * dt, 10, WORLD_HEIGHT - 10);

    const arch = e.isBoss ? BOSS : ENEMIES_BY_ID[e.archetype];
    if (arch && arch.fireRate && arch.fireRange && dst < arch.fireRange) {
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        e.fireCooldown = 1 / arch.fireRate;
        const bspd = 260;
        const shots = e.isBoss ? 3 : 1;
        for (let s = 0; s < shots; s++) {
          const spread = e.isBoss ? (s - 1) * 0.18 : 0;
          const ang = Math.atan2(dy, dx) + spread;
          world.bullets.push({
            pos: { x: e.pos.x, y: e.pos.y },
            vel: { x: Math.cos(ang) * bspd, y: Math.sin(ang) * bspd },
            life: 2.5,
            damage: e.damage * 0.6,
            owner: 'enemy',
            color: '#f87171',
            size: 4,
          });
        }
      }
    }

    if (dst < p.size + e.size - 2) {
      p.hull -= e.damage * (e.isBoss ? 1.0 : 0.7);
      spawnParticles(world, e.pos, e.color, e.isBoss ? 16 : 8, 150);
      world.shake = Math.max(world.shake, e.isBoss ? 8 : 3);
      if (!e.isBoss) {
        // Every enemy drops at least one part - including ram-deaths.
        dropPartsPickup(world, e.pos, Math.max(1, e.partsDrop));
        world.enemies.splice(j, 1);
        run.kills += 1;
        run.score += 50;
        tryUnlockShips(world);
      } else {
        p.vel.x -= (dx / dst) * 220;
        p.vel.y -= (dy / dst) * 220;
      }
    }
  }

  // Salvage rings
  for (const ring of world.salvageRings) {
    ring.pulse += dt;
    if (!ring.active) {
      ring.cooldown -= dt;
      if (ring.cooldown <= 0) {
        ring.active = true;
        ring.charges = 4 + Math.floor(Math.random() * 6);
      }
      continue;
    }
    const d = Math.hypot(p.pos.x - ring.pos.x, p.pos.y - ring.pos.y);
    if (d < ring.radius && ring.charges > 0) {
      // Burst all remaining charges as gold crates.
      for (let k = 0; k < ring.charges; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = ring.radius * 0.4 + Math.random() * (ring.radius * 0.6);
        world.pickups.push({
          pos: { x: ring.pos.x + Math.cos(a) * r, y: ring.pos.y + Math.sin(a) * r },
          vel: { x: Math.cos(a) * 120, y: Math.sin(a) * 120 },
          life: 25,
          amount: 3 + Math.floor(Math.random() * 6),
          kind: 'crate',
          color: '#fbbf24',
        });
      }
      spawnParticles(world, ring.pos, '#fbbf24', 18, 220);
      run.score += 25;
      ring.charges = 0;
      ring.active = false;
      ring.cooldown = 90 + Math.random() * 60;
    }
  }

  // Pickups
  const magnetRange = 75 + run.upgrades.magnetLevel * 22;
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.life -= dt;
    pk.pos.x += pk.vel.x * dt;
    pk.pos.y += pk.vel.y * dt;
    pk.vel.x *= Math.max(0, 1 - 1.3 * dt);
    pk.vel.y *= Math.max(0, 1 - 1.3 * dt);
    const dx = p.pos.x - pk.pos.x;
    const dy = p.pos.y - pk.pos.y;
    const d = Math.hypot(dx, dy);
    const range = pk.kind === 'crate' ? magnetRange * 1.6 : magnetRange;
    if (d < range && d > 0.01) {
      const pull = 220 * (1 - d / range);
      pk.vel.x += (dx / d) * pull * dt * 4;
      pk.vel.y += (dy / d) * pull * dt * 4;
    }
    if (d < p.size + 8) {
      run.parts += pk.amount;
      run.totalParts += pk.amount;
      run.score += pk.amount * 5;
      spawnParticles(world, pk.pos, pk.color, pk.kind === 'crate' ? 10 : 5, 130);
      world.pickups.splice(i, 1);
    } else if (pk.life <= 0) {
      world.pickups.splice(i, 1);
    }
  }

  // Particles
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.pos.x += pt.vel.x * dt;
    pt.pos.y += pt.vel.y * dt;
    pt.vel.x *= Math.max(0, 1 - 1.6 * dt);
    pt.vel.y *= Math.max(0, 1 - 1.6 * dt);
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }

  // Momentum decay
  run.momentum = Math.max(0, run.momentum - 9 * dt);

  // Spawning
  world.spawnTimer -= dt;
  const targetEnemies = Math.min(14, 3 + Math.floor(run.kills / 8));
  if (world.spawnTimer <= 0 && world.enemies.filter((e) => !e.isBoss).length < targetEnemies) {
    spawnEnemyAtEdge(world);
    world.spawnTimer = Math.max(0.45, 1.6 - Math.min(1.0, run.kills / 200));
  }

  // Crate drops (random floating loot, separate from salvage rings)
  world.crateTimer -= dt;
  if (world.crateTimer <= 0) {
    dropCrate(world);
    world.crateTimer = 25 + Math.random() * 25;
  }

  // Boss spawn
  if (!run.bossSpawned && run.kills >= run.nextBossAt) {
    spawnBoss(world);
  }

  // Harbor proximity
  world.nearHarborIndex = -1;
  for (let i = 0; i < world.harbors.length; i++) {
    const h = world.harbors[i];
    const d = Math.hypot(p.pos.x - h.pos.x, p.pos.y - h.pos.y);
    if (d < h.radius) {
      h.discovered = true;
      world.nearHarborIndex = i;
    } else if (d < h.radius + 60) {
      h.discovered = true;
    }
  }

  if (p.hull <= 0) {
    spawnParticles(world, p.pos, p.color, 30, 240);
    spawnParticles(world, p.pos, '#fbbf24', 18, 280);
    world.shake = 20;
    return { died: true };
  }
  return { died: false };
}

export function dockAt(world: World, idx: number) {
  world.dockedHarborIndex = idx;
}

export function undock(world: World) {
  const idx = world.nearHarborIndex >= 0 ? world.nearHarborIndex : world.dockedHarborIndex;
  world.dockedHarborIndex = -1;
  const h = world.harbors[idx] || world.harbors[0];
  if (h) {
    const a = Math.atan2(world.player.pos.y - h.pos.y, world.player.pos.x - h.pos.x) || 0;
    const r = h.radius + 30;
    world.player.pos.x = clamp(h.pos.x + Math.cos(a) * r, 30, WORLD_WIDTH - 30);
    world.player.pos.y = clamp(h.pos.y + Math.sin(a) * r, 30, WORLD_HEIGHT - 30);
  }
}
