// Deterministic long-session bot: plays complete runs on a seeded RNG and
// asserts invariants every few hundred ticks. This is both a defect hunt
// (NaN, runaway entity counts, impossible states) and objective evidence
// about progression / pacing (printed, never used to rebalance by itself).
import {
  createWorld, dockAt, FIXED_DT, InputState, repairCost, tick, tryRepair, tryUpgrade, undock, World,
} from '../game/world';
import { UPGRADES } from '../data/upgrades';
import { SHIPS } from '../data/ships';
import { angleDiff, clamp } from '../util/math';
import { UpgradeKey } from '../game/types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Metrics {
  seed: number; simSeconds: number; died: boolean; kills: number; score: number;
  parts: number; totalParts: number; ships: number; upgrades: number; docks: number;
  maxEnemies: number; maxBullets: number; maxParticles: number; maxPickups: number;
  maxWake: number; ticksPerSec: number;
}

function finite(...xs: number[]) { return xs.every(Number.isFinite); }

function botInput(w: World): InputState {
  const p = w.player;
  // Priority: nearby salvage, otherwise hunt the nearest enemy.
  let target: { x: number; y: number } | null = null;
  let best = 700;
  for (const k of w.pickups) {
    const d = Math.hypot(k.pos.x - p.pos.x, k.pos.y - p.pos.y);
    if (d < best) { best = d; target = k.pos; }
  }
  // Rich enough and no enemy close by: go shopping at the nearest harbor.
  const enemyNear = w.enemies.some((e) => Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) < 350);
  if (w.run.parts >= 40 && !enemyNear && w.harbors.length) {
    let hb = Infinity;
    for (const h of w.harbors) {
      const d = Math.hypot(h.pos.x - p.pos.x, h.pos.y - p.pos.y);
      if (d < hb) { hb = d; target = h.pos; }
    }
  }
  if (!target) {
    best = 900;
    for (const e of w.enemies) {
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
      if (d < best) { best = d; target = e.pos; }
    }
  }
  if (!target) {
    const c = w.harbors[0]?.pos ?? { x: 3000, y: 3000 };
    target = c;
  }
  const want = Math.atan2(target.y - p.pos.y, target.x - p.pos.x);
  const diff = angleDiff(p.angle, want);
  return { dx: clamp(diff * 2, -1, 1), dy: -1, fire: false, autoFire: true };
}

function dockAndUpgrade(w: World): boolean {
  if (w.nearHarborIndex < 0 || w.run.parts < 30) return false;
  dockAt(w, w.nearHarborIndex);
  if (repairCost(w) > 0) tryRepair(w);
  let bought = true;
  while (bought) {
    bought = false;
    for (const u of UPGRADES) if (tryUpgrade(w, u.key)) bought = true;
  }
  undock(w);
  return true;
}

function playRun(seed: number, minutes: number, godMode = false): Metrics {
  const rng = mulberry32(seed);
  const spy = jest.spyOn(Math, 'random').mockImplementation(rng);
  try {
    const w = createWorld('raft', ['raft']);
    const input: InputState = { dx: 0, dy: -1, fire: false, autoFire: true };
    const m: Metrics = {
      seed, simSeconds: 0, died: false, kills: 0, score: 0, parts: 0, totalParts: 0, ships: 1,
      upgrades: 0, docks: 0, maxEnemies: 0, maxBullets: 0, maxParticles: 0, maxPickups: 0,
      maxWake: 0, ticksPerSec: 0,
    };
    const steps = Math.round((minutes * 60) / FIXED_DT);
    const t0 = Date.now();
    let lastParts = 0;
    for (let i = 0; i < steps; i++) {
      Object.assign(input, botInput(w));
      if (godMode) w.player.hull = w.player.maxHull;
      const { died } = tick(w, FIXED_DT, input);
      if (died) { m.died = true; break; }
      if (i % 30 === 0 && dockAndUpgrade(w)) m.docks++;

      if (i % 60 === 0) {
        const p = w.player;
        if (!finite(p.pos.x, p.pos.y, p.vel.x, p.vel.y, p.hull, p.angle, w.camera.x, w.camera.y, w.cameraZoom)) {
          throw new Error(`non-finite player/camera state at step ${i}`);
        }
        for (const e of w.enemies) if (!finite(e.pos.x, e.pos.y, e.hull)) throw new Error(`non-finite enemy at step ${i}`);
        for (const b of w.bullets) if (!finite(b.pos.x, b.pos.y)) throw new Error(`non-finite bullet at step ${i}`);
        if (p.hull > p.maxHull + 1e-6) throw new Error(`hull ${p.hull} above max ${p.maxHull}`);
        if (w.run.parts < 0) throw new Error(`negative parts at step ${i}`);
        if (w.run.totalParts + 1e-9 < lastParts) throw new Error('totalParts went down');
        lastParts = w.run.totalParts;
        for (const u of UPGRADES) {
          if (w.run.upgrades[u.key as UpgradeKey] > u.maxLevel) {
            throw new Error(`${u.key} level ${w.run.upgrades[u.key as UpgradeKey]} exceeds max ${u.maxLevel}`);
          }
        }
        m.maxEnemies = Math.max(m.maxEnemies, w.enemies.length);
        m.maxBullets = Math.max(m.maxBullets, w.bullets.length);
        m.maxParticles = Math.max(m.maxParticles, w.particles.length);
        m.maxPickups = Math.max(m.maxPickups, w.pickups.length);
        m.maxWake = Math.max(m.maxWake, p.wake.length);
      }
    }
    const ms = Math.max(1, Date.now() - t0);
    m.simSeconds = Math.round(w.run.activeSeconds);
    m.kills = w.run.kills; m.score = w.run.score; m.parts = w.run.parts; m.totalParts = w.run.totalParts;
    m.ships = w.run.unlockedShips.length;
    m.upgrades = Object.values(w.run.upgrades).reduce((a, b) => a + b, 0);
    m.ticksPerSec = Math.round((m.simSeconds / FIXED_DT) / (ms / 1000));
    return m;
  } finally {
    spy.mockRestore();
  }
}

describe('bot sessions (seeded, deterministic)', () => {
  const results: Metrics[] = [];

  test.each([1, 2, 3])('seed %i: 8 simulated minutes keep every invariant', (seed) => {
    const m = playRun(seed, 8);
    results.push(m);
    // Entity populations stay bounded (no leaks / runaway spawns).
    expect(m.maxEnemies).toBeLessThan(80);
    expect(m.maxBullets).toBeLessThan(1500);
    expect(m.maxParticles).toBeLessThan(3000);
    expect(m.maxPickups).toBeLessThan(600);
    expect(m.maxWake).toBeLessThanOrEqual(24);
  });

  test.each([11, 12])('seed %i: 30-minute god-mode soak stays bounded and finite', (seed) => {
    const m = playRun(seed, 30, true);
    results.push(m);
    expect(m.died).toBe(false);
    expect(m.maxEnemies).toBeLessThan(80);
    expect(m.maxBullets).toBeLessThan(1500);
    expect(m.maxParticles).toBeLessThan(3000);
    expect(m.maxPickups).toBeLessThan(600);
  }, 120000);

  test('the same seed reproduces the exact same session', () => {
    const a = playRun(7, 2);
    const b = playRun(7, 2);
    expect({ ...a, ticksPerSec: 0 }).toEqual({ ...b, ticksPerSec: 0 });
  });

  afterAll(() => {
    // Evidence for the engineering log (not an assertion).
    process.stdout.write('\nBOT SESSION METRICS\n' + results.map((m) => JSON.stringify(m)).join('\n') + '\n');
  });
});

test('ship ladder is well-formed (ids unique, unlock kills strictly increasing)', () => {
  const ids = SHIPS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  const kills = SHIPS.map((s) => s.unlockKills);
  expect([...kills].sort((a, b) => a - b)).toEqual(kills);
  expect(kills[0]).toBe(0);
});
