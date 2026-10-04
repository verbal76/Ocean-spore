import { BOSS_CONTACT_COOLDOWN, createWorld, tick, World, InputState } from '../game/world';
import { BOSS, ENEMIES } from '../data/enemies';
import { EnemyShip } from '../game/types';

const IDLE: InputState = { dx: 0, dy: 0, fire: false, autoFire: false };
const DT = 1 / 60;

function newWorld(): World {
  const w = createWorld('raft', ['raft']);
  w.player.hull = w.player.maxHull = 10_000; // survive; we measure damage taken
  return w;
}

function enemy(w: World, over: Partial<EnemyShip> = {}): EnemyShip {
  const arch = ENEMIES[0];
  const e: EnemyShip = {
    id: w.enemyIdCounter++, archetype: arch.id,
    pos: { x: w.player.pos.x + 400, y: w.player.pos.y }, vel: { x: 0, y: 0 }, angle: Math.PI,
    hull: 9999, maxHull: 9999, speed: 0, damage: 10, fireCooldown: 99,
    size: arch.size, color: arch.color, partsDrop: 1, wake: [], ...over,
  };
  w.enemies.push(e);
  return e;
}

function boss(w: World, at: { x: number; y: number }): EnemyShip {
  return enemy(w, {
    archetype: 'boss', isBoss: true, pos: { ...at }, damage: BOSS.damage,
    size: BOSS.size, speed: 0, color: BOSS.color,
  });
}

describe('boss contact damage', () => {
  test('is rate-limited (was applied every frame ~2000 dps)', () => {
    const w = newWorld();
    boss(w, w.player.pos);
    const before = w.player.hull;
    for (let i = 0; i < 60; i++) tick(w, DT, IDLE);        // 1 simulated second
    const hits = Math.ceil(1 / BOSS_CONTACT_COOLDOWN) + 1;
    expect(before - w.player.hull).toBeLessThanOrEqual(hits * BOSS.damage);
    expect(before - w.player.hull).toBeGreaterThanOrEqual(BOSS.damage); // but it does hurt
  });

  test('damage per second does not depend on frame rate', () => {
    const dmg = (hz: number) => {
      const w = newWorld();
      boss(w, w.player.pos);
      const before = w.player.hull;
      for (let i = 0; i < hz * 3; i++) tick(w, 1 / hz, IDLE); // 3 s
      return before - w.player.hull;
    };
    const d30 = dmg(30), d60 = dmg(60), d120 = dmg(120);
    expect(Math.abs(d30 - d60)).toBeLessThanOrEqual(BOSS.damage);
    expect(Math.abs(d120 - d60)).toBeLessThanOrEqual(BOSS.damage);
  });

  test('knockback pushes the player AWAY from the boss', () => {
    const w = newWorld();
    boss(w, { x: w.player.pos.x - 10, y: w.player.pos.y });   // boss on the left
    tick(w, DT, IDLE);
    expect(w.player.vel.x).toBeGreaterThan(0);                // pushed right, away
  });
});

describe('enemy contact uses the real player position, not the lead point', () => {
  test('a fast player near (but not touching) an enemy does not ram it', () => {
    const w = newWorld();
    const e = enemy(w, { size: 40, pos: { x: w.player.pos.x + 150, y: w.player.pos.y } });
    expect(150).toBeGreaterThan(w.player.size + e.size);      // truly apart
    w.player.vel.x = 600;                                     // lead point lands on the enemy
    const kills = w.run.kills;
    tick(w, DT, IDLE);
    expect(w.enemies).toContain(e);
    expect(w.run.kills).toBe(kills);
  });

  test('actually touching still rams', () => {
    const w = newWorld();
    enemy(w, { pos: { ...w.player.pos } });
    tick(w, DT, IDLE);
    expect(w.run.kills).toBe(1);
  });
});

describe('simulation time, not wall-clock time', () => {
  afterEach(() => jest.restoreAllMocks());

  test('a storm is not ended early by the wall clock jumping', () => {
    const w = newWorld();
    w.run.weather = 'storm';
    w.run.weatherUntil = w.elapsed + 10;
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1e10);
    tick(w, DT, IDLE);
    expect(w.run.weather).toBe('storm');
  });

  test('a storm ends after its simulated duration', () => {
    const w = newWorld();
    w.run.weather = 'storm';
    w.run.weatherUntil = w.elapsed + 2;
    for (let i = 0; i < 180; i++) tick(w, DT, IDLE);
    expect(w.run.weather).toBe('clear');
  });

  test('time alive counts sailing time only; harbor time does not count', () => {
    const w = newWorld();
    for (let i = 0; i < 60; i++) tick(w, DT, IDLE);
    expect(w.run.activeSeconds).toBeCloseTo(1, 1);
    w.dockedHarborIndex = 0;
    for (let i = 0; i < 600; i++) tick(w, DT, IDLE);
    expect(w.run.activeSeconds).toBeCloseTo(1, 1);
  });
});
