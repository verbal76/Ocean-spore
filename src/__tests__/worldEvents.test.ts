import { createWorld, dockAt, drainEvents, emit, FIXED_DT, InputState, MAX_QUEUED_EVENTS, tick, undock, World } from '../game/world';
import { BOSS, ENEMIES } from '../data/enemies';
import { EnemyShip } from '../game/types';
import { SOUND_CONFIG } from '../audio/sounds';

const IDLE: InputState = { dx: 0, dy: 0, fire: false, autoFire: false };

function newWorld(): World {
  const w = createWorld('raft', ['raft']);
  w.player.hull = w.player.maxHull = 1e6;
  return w;
}

function enemy(w: World, over: Partial<EnemyShip> = {}): EnemyShip {
  const a = ENEMIES[0];
  const e: EnemyShip = {
    id: w.enemyIdCounter++, archetype: a.id, pos: { x: w.player.pos.x + 300, y: w.player.pos.y },
    vel: { x: 0, y: 0 }, angle: Math.PI, hull: 9999, maxHull: 9999, speed: 0, damage: 10,
    fireCooldown: 99, size: 12, color: a.color, partsDrop: 1, wake: [], ...over,
  };
  w.enemies.push(e);
  return e;
}

function playerBulletAt(w: World, x: number, y: number, damage = 5) {
  w.bullets.push({ id: w.bulletIdCounter++, pos: { x, y }, vel: { x: 0, y: 0 }, life: 1, damage, owner: 'player', color: '#fff', size: 3 });
}

describe('world emits events the audio layer reacts to', () => {
  test('firing emits "fire"; draining clears the queue', () => {
    const w = newWorld();
    tick(w, FIXED_DT, { ...IDLE, fire: true });
    expect(drainEvents(w)).toContain('fire');
    expect(drainEvents(w)).toEqual([]);
  });

  test('a non-lethal hit emits "hit"; a kill emits "explode"; a boss kill "explodeBoss"', () => {
    const w = newWorld();
    const e = enemy(w);
    playerBulletAt(w, e.pos.x, e.pos.y, 5);
    tick(w, FIXED_DT, IDLE);
    expect(drainEvents(w)).toContain('hit');

    const w2 = newWorld();
    const e2 = enemy(w2, { hull: 1 });
    playerBulletAt(w2, e2.pos.x, e2.pos.y, 5);
    tick(w2, FIXED_DT, IDLE);
    const ev2 = drainEvents(w2);
    expect(ev2).toContain('explode');
    expect(ev2).not.toContain('hit');

    const w3 = newWorld();
    const b = enemy(w3, { hull: 1, isBoss: true, archetype: 'boss', size: BOSS.size, damage: 0 });
    playerBulletAt(w3, b.pos.x, b.pos.y, 5);
    tick(w3, FIXED_DT, IDLE);
    expect(drainEvents(w3)).toContain('explodeBoss');
  });

  test('ramming emits "ram"; being shot emits "damage"', () => {
    const w = newWorld();
    enemy(w, { pos: { ...w.player.pos } });
    tick(w, FIXED_DT, IDLE);
    expect(drainEvents(w)).toContain('ram');

    const w2 = newWorld();
    w2.bullets.push({ id: 1, pos: { ...w2.player.pos }, vel: { x: 0, y: 0 }, life: 1, damage: 5, owner: 'enemy', color: '#f00', size: 4 });
    tick(w2, FIXED_DT, IDLE);
    expect(drainEvents(w2)).toContain('damage');
  });

  test('collecting salvage emits "pickup", a crate emits "crate"', () => {
    const w = newWorld();
    w.pickups.push({ id: 1, pos: { ...w.player.pos }, vel: { x: 0, y: 0 }, life: 20, amount: 3, kind: 'parts', color: '#22d3ee' } as any);
    tick(w, FIXED_DT, IDLE);
    expect(drainEvents(w)).toContain('pickup');
    w.pickups.push({ id: 2, pos: { ...w.player.pos }, vel: { x: 0, y: 0 }, life: 20, amount: 3, kind: 'crate', color: '#fbbf24' } as any);
    tick(w, FIXED_DT, IDLE);
    expect(drainEvents(w)).toContain('crate');
  });

  test('docking and undocking emit "dock" / "undock"', () => {
    const w = newWorld();
    dockAt(w, 0);
    undock(w);
    expect(drainEvents(w)).toEqual(['dock', 'undock']);
  });

  test('a storm rolling in emits "storm"', () => {
    const w = newWorld();
    w.run.weather = 'clear';
    w.run.weatherCooldown = 0;
    tick(w, FIXED_DT, IDLE);
    expect(drainEvents(w)).toContain('storm');
  });

  test('crossing a lifetime-kill threshold mid-run emits "unlock"', () => {
    const w = createWorld('raft', ['raft'], 9);                      // 9 lifetime kills; patrol needs 10
    w.player.hull = w.player.maxHull = 1e6;
    const e = enemy(w, { hull: 1 });
    playerBulletAt(w, e.pos.x, e.pos.y, 5);
    tick(w, FIXED_DT, IDLE);
    expect(drainEvents(w)).toContain('unlock');
    expect(w.run.unlockedShips).toContain('patrol');
  });
});

describe('the event queue is bounded', () => {
  test('a world that never drains cannot grow without limit; oldest events are dropped', () => {
    const w = newWorld();
    for (let i = 0; i < 1000; i++) emit(w, i % 2 ? 'fire' : 'hit');
    expect(w.events.length).toBe(MAX_QUEUED_EVENTS);
  });

  test('long un-drained play (e.g. docked) stays bounded', () => {
    const w = newWorld();
    for (let i = 0; i < 60 * 120; i++) tick(w, FIXED_DT, { ...IDLE, fire: true });
    expect(w.events.length).toBeLessThanOrEqual(MAX_QUEUED_EVENTS);
  });
});

test('every sim event kind has a sound configured', () => {
  const kinds = ['fire', 'hit', 'explode', 'explodeBoss', 'ram', 'damage', 'boss', 'pickup', 'crate', 'unlock', 'storm', 'dock', 'undock'];
  for (const k of kinds) expect(SOUND_CONFIG).toHaveProperty(k);
});
