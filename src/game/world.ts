import { SHIPS_BY_ID } from '../data/ships';
import { ENEMIES, ENEMIES_BY_ID, BOSS } from '../data/enemies';
import { UPGRADES, upgradeCost } from '../data/upgrades';
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
  Vec2,
  WakePoint,
} from './types';

export const WORLD_WIDTH = 6000;
/** Minimum seconds between boss contact hits on the player. */
export const BOSS_CONTACT_COOLDOWN = 0.75;
export const WORLD_HEIGHT = 6000;

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
  cameraZoom: number;
  enemyIdCounter: number;
  bulletIdCounter: number;
  pickupIdCounter: number;
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
      x: 200 + Math.random() * (WORLD_WIDTH - 400),
      y: 200 + Math.random() * (WORLD_HEIGHT - 400),
    },
    radius: 58,
    charges: 2 + Math.floor(Math.random() * 3),
    active: true,
    cooldown: 0,
    pulse: Math.random() * Math.PI * 2,
  };
}

export function createWorld(shipClassId: string, unlocked: string[], lifetimeKills = 0): World {
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
    wake: [],
  };

  const harbors: Harbor[] = [];
  const harborCount = 4;
  for (let i = 0; i < harborCount; i++) {
    const angle = (i / harborCount) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 1200 + Math.random() * 600;
    harbors.push({
      pos: {
        x: clamp(WORLD_WIDTH / 2 + Math.cos(angle) * dist, 200, WORLD_WIDTH - 200),
        y: clamp(WORLD_HEIGHT / 2 + Math.sin(angle) * dist, 200, WORLD_HEIGHT - 200),
      },
      radius: 95,
      name: HARBOR_NAMES[i % HARBOR_NAMES.length],
      discovered: false,
    });
  }

  const salvageRings: SalvageRing[] = [];
  for (let i = 0; i < 16; i++) salvageRings.push(newSalvageRing());

  return {
    player,
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    harbors,
    salvageRings,
    run: {
      lifetimeKillsAtStart: lifetimeKills,
      activeSeconds: 0,
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
      unlockedShips: [...unlocked],
      bossSpawned: false,
      nextBossAt: 100,
      weaponMode: 0,
    },
    camera: { x: player.pos.x, y: player.pos.y },
    cameraZoom: 1,
    enemyIdCounter: 1,
    bulletIdCounter: 1,
    pickupIdCounter: 1,
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
  const def = UPGRADES.find((u) => u.key === key);
  if (!def || lvl >= def.maxLevel) return false;
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
  // Tangible mode-change feedback: a colored burst at the bow so
  // the player can see the change registered without having to
  // fire and inspect the bullet pattern.
  const modeColors = ['#22d3ee', '#fbbf24', '#f97316']; // SINGLE, SPREAD, TWIN
  const color = modeColors[world.run.weaponMode] || '#22d3ee';
  const p = world.player;
  const bowX = p.pos.x + Math.cos(p.angle) * p.size * 1.4;
  const bowY = p.pos.y + Math.sin(p.angle) * p.size * 1.4;
  spawnParticles(world, { x: bowX, y: bowY }, color, 12, 160);
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
    id: world.pickupIdCounter++,
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
  const r = 620;
  const minDist = 120;
  let pos: Vec2 = { x: 0, y: 0 };
  for (let attempt = 0; attempt < 4; attempt++) {
    const a = Math.random() * Math.PI * 2;
    pos = {
      x: clamp(cam.x + Math.cos(a) * r, 50, WORLD_WIDTH - 50),
      y: clamp(cam.y + Math.sin(a) * r, 50, WORLD_HEIGHT - 50),
    };
    let tooClose = false;
    for (const e of world.enemies) {
      if (Math.hypot(pos.x - e.pos.x, pos.y - e.pos.y) < minDist) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) break;
  }

  const k = world.run.kills;
  const pool: typeof ENEMIES = [ENEMIES[0]];
  if (k > 5) pool.push(ENEMIES[3]);
  if (k > 15) pool.push(ENEMIES[1]);
  if (k > 25) pool.push(ENEMIES[4]);
  if (k > 35) pool.push(ENEMIES[5]);
  if (k > 40) pool.push(ENEMIES[1]);
  if (k > 60) pool.push(ENEMIES[6]);
  if (k > 80) pool.push(ENEMIES[2]);
  if (k > 100) pool.push(ENEMIES[4]);
  if (k > 150) pool.push(ENEMIES[2]);
  const arch = pool[Math.floor(Math.random() * pool.length)];

  const isElite = k > 25 && Math.random() < 0.15;
  const hullMul = isElite ? 4 : 1;
  const dmgMul = isElite ? 1.4 : 1;
  const sizeMul = isElite ? 1.8 : 1;
  const partsMul = isElite ? 5 : 1;

  world.enemies.push({
    id: world.enemyIdCounter++,
    archetype: arch.id,
    pos,
    vel: { x: 0, y: 0 },
    angle: Math.atan2(world.player.pos.y - pos.y, world.player.pos.x - pos.x),
    hull: arch.hull * hullMul,
    maxHull: arch.hull * hullMul,
    speed: arch.speed,
    damage: arch.damage * dmgMul,
    fireCooldown: arch.fireRate ? Math.random() / arch.fireRate : 0,
    size: arch.size * sizeMul,
    color: arch.color,
    partsDrop: Math.ceil(arch.partsDrop * partsMul),
    tier: isElite ? 'elite' : undefined,
    wake: [],
  });
}

function spawnBoss(world: World) {
  const cam = world.camera;
  const a = Math.random() * Math.PI * 2;
  world.enemies.push({
    id: world.enemyIdCounter++,
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
    wake: [],
  });
  world.run.bossSpawned = true;
  world.shake = Math.max(world.shake, 12);
}

function dropCrate(world: World) {
  const cam = world.camera;
  const a = Math.random() * Math.PI * 2;
  const r = 280 + Math.random() * 240;
  world.pickups.push({
    id: world.pickupIdCounter++,
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
  const muzzles: { side: number; angle: number }[] =
    p.weaponMode === 1
      ? [
          { side: -p.size * 0.7, angle: -0.15 },
          { side: 0, angle: 0 },
          { side: p.size * 0.7, angle: 0.15 },
        ]
      : p.weaponMode === 2
      ? [
          { side: -p.size * 0.6, angle: 0 },
          { side: p.size * 0.6, angle: 0 },
        ]
      : [{ side: 0, angle: 0 }];
  const fX = Math.cos(p.angle);
  const fY = Math.sin(p.angle);
  const rightX = -fY;
  const rightY = fX;
  const nose = p.size * 1.6;
  const inherit = 0.3;
  const pvxBefore = p.vel.x;
  const pvyBefore = p.vel.y;
  for (const m of muzzles) {
    const spawnX = p.pos.x + fX * nose + rightX * m.side;
    const spawnY = p.pos.y + fY * nose + rightY * m.side;
    const a = p.angle + m.angle;
    world.bullets.push({
      id: world.bulletIdCounter++,
      pos: { x: spawnX, y: spawnY },
      vel: {
        x: Math.cos(a) * speed + pvxBefore * inherit,
        y: Math.sin(a) * speed + pvyBefore * inherit,
      },
      life: 1.6,
      damage: p.damage * (p.weaponMode === 1 ? 0.85 : 1),
      owner: 'player',
      color: '#fde047',
      size: 4,
    });
    spawnParticles(world, { x: spawnX, y: spawnY }, '#fef3c7', 3, 60);
  }
  const recoil = 10;
  p.vel.x -= fX * recoil * muzzles.length;
  p.vel.y -= fY * recoil * muzzles.length;
}

function tryUnlockShips(world: World) {
  const k = world.run.lifetimeKillsAtStart + world.run.kills;
  for (const id of Object.keys(SHIPS_BY_ID)) {
    const def = SHIPS_BY_ID[id];
    if (k >= def.unlockKills && !world.run.unlockedShips.includes(id)) {
      world.run.unlockedShips.push(id);
    }
  }
}

function updateWake(ship: { pos: Vec2; angle: number; size: number; wake: WakePoint[] }) {
  const sternBack = ship.size * (5 / 3);
  const sx = ship.pos.x - Math.cos(ship.angle) * sternBack;
  const sy = ship.pos.y - Math.sin(ship.angle) * sternBack;
  const last = ship.wake[0];
  const spacing = ship.size * 0.5;
  const movedEnough = !last || Math.hypot(sx - last.x, sy - last.y) > spacing;
  const turnedEnough = !last || Math.abs(angleDiff(last.angle, ship.angle)) > 0.08;
  if (movedEnough || turnedEnough) {
    ship.wake.unshift({ x: sx, y: sy, angle: ship.angle });
    if (ship.wake.length > 24) ship.wake.length = 24;
  }
}

function movementIntent(archetype: string, dst: number, isBoss?: boolean): number {
  if (isBoss) return 1;
  switch (archetype) {
    case 'skiff':
      return dst < 180 ? -0.9 : 1;
    case 'drone':
      return dst < 220 ? -1.1 : 1;
    case 'gunboat':
      if (dst < 230) return -0.5;
      if (dst > 300) return 1;
      return 0;
    case 'raider':
      return 1;
    case 'cargo':
      return dst < 320 ? -1.0 : -0.4;
    case 'fanboat':
      return 1.25;
    case 'sniper':
      if (dst < 280) return -0.8;
      if (dst > 420) return 0.6;
      return 0;
    default:
      return 1;
  }
}

export function tick(world: World, dt: number, input: InputState): { died: boolean } {
  if (world.dockedHarborIndex >= 0) return { died: false };
  world.elapsed += dt;

  const run = world.run;
  const p = world.player;

  run.activeSeconds += dt;
  const now = world.elapsed;
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

  // Rudder steering with cone-based reverse. Pulling joystick up =
  // forward. Pulling within a narrow cone around straight-down
  // (clock 5:30-6:30) = reverse. Anything in between (including
  // down-right or down-left) is forward, so a hard down-right turn
  // doesn't accidentally reverse the boat.
  const stickMag = Math.hypot(input.dx, input.dy);
  // Radial deadzone replaces the old per-axis thresholds. 0.10 of
  // full stick deflection.
  const stickActive = stickMag > 0.10;

  if (stickActive) {
    const stickAngle = Math.atan2(input.dy, input.dx);
    // Cone around straight-down (PI/2 in screen-y-down coords).
    // 0.45 rad ~= 26 deg each side of straight down = ~5:30 to 6:30.
    const angleFromDown = Math.abs(angleDiff(stickAngle, Math.PI / 2));
    const reverseActive = angleFromDown < 0.45;

    // Rudder is still joystick.x.
    const rudderIn = input.dx;
    // Throttle: stick magnitude as forward, OR negative-mag inside
    // the reverse cone.
    const throttleIn = reverseActive ? -stickMag : stickMag;

    const curSpeed = Math.hypot(p.vel.x, p.vel.y);
    const speedFrac = Math.min(1, curSpeed / Math.max(p.speed, 1));
    const effectiveTurn = p.turn * (0.25 + 0.75 * speedFrac);
    const turnApplied = rudderIn * effectiveTurn * dt;
    p.angle += turnApplied;

    const fX = Math.cos(p.angle);
    const fY = Math.sin(p.angle);
    let vFwd = p.vel.x * fX + p.vel.y * fY;
    let vLat = p.vel.x * fY - p.vel.y * fX;

    const targetSpeed = throttleIn * p.speed * weatherSpeed;
    vFwd = lerp(vFwd, targetSpeed, 1 - Math.exp(-2.5 * dt));

    const turnRate = Math.abs(turnApplied) / Math.max(dt, 0.0001);
    const turningFactor = Math.min(1, turnRate / Math.max(effectiveTurn, 0.0001));
    const latK = 4.0 - 2.5 * turningFactor;
    vLat = lerp(vLat, 0, 1 - Math.exp(-latK * dt));

    p.vel.x = vFwd * fX + vLat * fY;
    p.vel.y = vFwd * fY - vLat * fX;
  } else {
    p.vel.x *= Math.max(0, 1 - 0.3 * dt);
    p.vel.y *= Math.max(0, 1 - 0.3 * dt);
  }
  p.pos.x = clamp(p.pos.x + p.vel.x * dt, 20, WORLD_WIDTH - 20);
  p.pos.y = clamp(p.pos.y + p.vel.y * dt, 20, WORLD_HEIGHT - 20);
  updateWake(p);

  if (run.upgrades.regenLevel > 0) {
    p.hull = clamp(p.hull + run.upgrades.regenLevel * 1.2 * dt, 0, p.maxHull);
  }

  world.camera.x = lerp(world.camera.x, p.pos.x + p.vel.x * 0.18, 1 - Math.exp(-4 * dt));
  world.camera.y = lerp(world.camera.y, p.pos.y + p.vel.y * 0.18, 1 - Math.exp(-4 * dt));
  world.shake = Math.max(0, world.shake - dt * 14);

  let maxNearbySize = 0;
  const zoomReach = 700;
  for (const e of world.enemies) {
    if (Math.hypot(e.pos.x - world.camera.x, e.pos.y - world.camera.y) < zoomReach) {
      if (e.size > maxNearbySize) maxNearbySize = e.size;
    }
  }
  const targetZoom = (() => {
    const bossZoom = maxNearbySize > 30
      ? Math.max(0.55, 1 - (maxNearbySize - 30) * 0.015)
      : 1;
    const pSpeed = Math.hypot(p.vel.x, p.vel.y);
    const speedFracCam = Math.min(1, pSpeed / Math.max(p.speed, 1));
    const speedZoom = 1 - 0.15 * speedFracCam;
    return Math.min(bossZoom, speedZoom);
  })();
  world.cameraZoom = lerp(world.cameraZoom, targetZoom, 1 - Math.exp(-1.5 * dt));

  p.fireCooldown -= dt;
  const wantFire = input.fire || input.autoFire;
  if (wantFire && p.fireCooldown <= 0) {
    fireBullets(world);
    // Carry (at most one tick of) overshoot so the average rate is exact
    // instead of being quantised to the frame time.
    p.fireCooldown = Math.max(-dt, p.fireCooldown) + 1 / p.fireRate;
  }

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
          spawnParticles(world, b.pos, '#fcd34d', 6, 90);
          spawnParticles(world, b.pos, '#fef3c7', 2, 40);
          world.shake = Math.max(world.shake, 1.5);
          world.bullets.splice(i, 1);
          if (e.hull <= 0) {
            spawnParticles(world, e.pos, e.color, e.isBoss ? 60 : 24, 220);
            spawnParticles(world, e.pos, '#fbbf24', e.isBoss ? 36 : 12, 270);
            spawnParticles(world, e.pos, '#ffffff', e.isBoss ? 20 : 8, 180);
            const drops = e.isBoss ? 8 : 1;
            for (let d = 0; d < drops; d++) {
              dropPartsPickup(world, e.pos, e.isBoss ? Math.floor(e.partsDrop / drops) : e.partsDrop);
            }
            run.kills += 1;
            run.score += e.isBoss ? 5000 : 100;
            run.momentum = Math.min(100, run.momentum + (e.isBoss ? 40 : 8));
            world.shake = Math.max(world.shake, e.isBoss ? 20 : 6);
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
        spawnParticles(world, b.pos, '#fca5a5', 8, 130);
        spawnParticles(world, b.pos, '#ffffff', 3, 60);
        world.bullets.splice(i, 1);
        world.shake = Math.max(world.shake, 4);
      }
    }
  }

  for (let j = world.enemies.length - 1; j >= 0; j--) {
    const e = world.enemies[j];

    const leadTime = 0.3;
    const fx = p.pos.x + p.vel.x * leadTime;
    const fy = p.pos.y + p.vel.y * leadTime;
    const dx = fx - e.pos.x;
    const dy = fy - e.pos.y;
    const dst = Math.hypot(dx, dy) || 1;
    // True distance to the player's hull. `dst` above is to the predicted
    // lead point and is only for steering; range and contact use the real one.
    const pdx = p.pos.x - e.pos.x;
    const pdy = p.pos.y - e.pos.y;
    const pdst = Math.hypot(pdx, pdy) || 1;

    const wantAngle = Math.atan2(dy, dx);
    const aDiff = angleDiff(e.angle, wantAngle);
    const archTurn = e.isBoss ? 1.4 : (e.tier === 'elite' ? 2.0 : 2.8);
    const eCurSpeed = Math.hypot(e.vel.x, e.vel.y);
    const eSpeedFrac = Math.min(1, eCurSpeed / Math.max(e.speed, 1));
    const effTurnE = archTurn * (0.3 + 0.7 * eSpeedFrac);
    const aMax = effTurnE * dt;
    e.angle += Math.sign(aDiff) * Math.min(Math.abs(aDiff), aMax);

    const intent = movementIntent(e.archetype, dst, e.isBoss);
    const targetSpeedE = e.speed * weatherSpeed * intent;

    const fXe = Math.cos(e.angle);
    const fYe = Math.sin(e.angle);
    let eVFwd = e.vel.x * fXe + e.vel.y * fYe;
    let eVLat = e.vel.x * fYe - e.vel.y * fXe;
    eVFwd = lerp(eVFwd, targetSpeedE, 1 - Math.exp(-2.0 * dt));
    eVLat = lerp(eVLat, 0, 1 - Math.exp(-4.0 * dt));
    e.vel.x = eVFwd * fXe + eVLat * fYe;
    e.vel.y = eVFwd * fYe - eVLat * fXe;

    e.pos.x = clamp(e.pos.x + e.vel.x * dt, 10, WORLD_WIDTH - 10);
    e.pos.y = clamp(e.pos.y + e.vel.y * dt, 10, WORLD_HEIGHT - 10);
    updateWake(e);

    const arch = e.isBoss ? BOSS : ENEMIES_BY_ID[e.archetype];
    if (arch && arch.fireRate && arch.fireRange && pdst < arch.fireRange) {
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        e.fireCooldown = 1 / arch.fireRate;
        const bspd = 260;
        const shots = e.isBoss ? 3 : 1;
        for (let s = 0; s < shots; s++) {
          const spread = e.isBoss ? (s - 1) * 0.18 : 0;
          const ang = Math.atan2(dy, dx) + spread;
          const nose = e.size * 1.6;
          const inherit = 0.3;
          world.bullets.push({
            id: world.bulletIdCounter++,
            pos: { x: e.pos.x + Math.cos(ang) * nose, y: e.pos.y + Math.sin(ang) * nose },
            vel: {
              x: Math.cos(ang) * bspd + e.vel.x * inherit,
              y: Math.sin(ang) * bspd + e.vel.y * inherit,
            },
            life: 2.5,
            damage: e.damage * 0.6,
            owner: 'enemy',
            color: '#f87171',
            size: 4,
          });
        }
      }
    }

    if (e.contactCooldown) e.contactCooldown = Math.max(0, e.contactCooldown - dt);
    if (pdst < p.size + e.size - 2 && !(e.isBoss && e.contactCooldown)) {
      p.hull -= e.damage * (e.isBoss ? 1.0 : 0.7);
      spawnParticles(world, e.pos, e.color, e.isBoss ? 16 : 8, 150);
      world.shake = Math.max(world.shake, e.isBoss ? 8 : 3);
      if (!e.isBoss) {
        dropPartsPickup(world, e.pos, Math.max(1, e.partsDrop));
        world.enemies.splice(j, 1);
        run.kills += 1;
        run.score += 50;
        tryUnlockShips(world);
      } else {
        // Bosses are rammed repeatedly, so hits are rate-limited and shove
        // the player AWAY from the boss.
        e.contactCooldown = BOSS_CONTACT_COOLDOWN;
        p.vel.x += (pdx / pdst) * 220;
        p.vel.y += (pdy / pdst) * 220;
      }
    }
  }

  for (const ring of world.salvageRings) {
    ring.pulse += dt;
    if (!ring.active) {
      ring.cooldown -= dt;
      if (ring.cooldown <= 0) {
        ring.active = true;
        ring.charges = 2 + Math.floor(Math.random() * 3);
      }
      continue;
    }
    const d = Math.hypot(p.pos.x - ring.pos.x, p.pos.y - ring.pos.y);
    if (d < ring.radius && ring.charges > 0) {
      for (let k = 0; k < ring.charges; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = ring.radius * 0.4 + Math.random() * (ring.radius * 0.6);
        world.pickups.push({
          id: world.pickupIdCounter++,
          pos: { x: ring.pos.x + Math.cos(a) * r, y: ring.pos.y + Math.sin(a) * r },
          vel: { x: Math.cos(a) * 120, y: Math.sin(a) * 120 },
          life: 25,
          amount: 3 + Math.floor(Math.random() * 4),
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

  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.pos.x += pt.vel.x * dt;
    pt.pos.y += pt.vel.y * dt;
    pt.vel.x *= Math.max(0, 1 - 1.6 * dt);
    pt.vel.y *= Math.max(0, 1 - 1.6 * dt);
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }

  run.momentum = Math.max(0, run.momentum - 9 * dt);

  world.spawnTimer -= dt;
  const targetEnemies = Math.min(14, 3 + Math.floor(run.kills / 8));
  if (world.spawnTimer <= 0 && world.enemies.filter((e) => !e.isBoss).length < targetEnemies) {
    spawnEnemyAtEdge(world);
    world.spawnTimer = Math.max(0.45, 1.6 - Math.min(1.0, run.kills / 200));
  }

  world.crateTimer -= dt;
  if (world.crateTimer <= 0) {
    dropCrate(world);
    world.crateTimer = 25 + Math.random() * 25;
  }

  if (!run.bossSpawned && run.kills >= run.nextBossAt) {
    spawnBoss(world);
  }

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

// ---------------------------------------------------------------------------
// Fixed-timestep driver. Physics, collisions and cooldowns always advance in
// FIXED_DT slices, so gameplay is identical at 30/60/120 fps and fast bullets
// can't tunnel through small boats on a slow frame.

export const FIXED_DT = 1 / 60;
/** Never simulate more than this many steps for one rendered frame. */
export const MAX_STEPS_PER_FRAME = 6;

export interface StepClock {
  accumulator: number;
}

export function newStepClock(): StepClock {
  return { accumulator: 0 };
}

export function stepFixed(
  world: World,
  input: InputState,
  frameDt: number,
  clock: StepClock,
): { died: boolean; steps: number } {
  if (!(frameDt > 0) || !Number.isFinite(frameDt)) return { died: false, steps: 0 };
  clock.accumulator += frameDt;
  let steps = 0;
  while (clock.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    clock.accumulator -= FIXED_DT;
    steps++;
    if (tick(world, FIXED_DT, input).died) {
      clock.accumulator = 0;
      return { died: true, steps };
    }
  }
  // Spiral-of-death guard: after a long stall drop the backlog rather than
  // trying to catch up with more and more steps.
  if (steps === MAX_STEPS_PER_FRAME) clock.accumulator = 0;
  return { died: false, steps };
}
