import {
  BOSS_SPAWN_MIN_PLAYER_DIST, createWorld, FIXED_DT, InputState, pickSpawnPoint, SPAWN_MIN_PLAYER_DIST, tick,
  WORLD_HEIGHT, WORLD_WIDTH, World,
} from '../game/world';

const IDLE: InputState = { dx: 0, dy: 0, fire: false, autoFire: false };

/** Run until `count` enemies have appeared; return how far from the player each was when first seen. */
function spawnDistances(px: number, py: number, count: number, seedBase: number): number[] {
  let s = seedBase >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const spy = jest.spyOn(Math, 'random').mockImplementation(rnd);
  try {
    const w: World = createWorld('raft', ['raft']);
    w.player.hull = w.player.maxHull = 1e9;
    w.player.pos.x = px; w.player.pos.y = py;
    w.camera.x = px; w.camera.y = py;
    const seen = new Set<number>();
    const dists: number[] = [];
    for (let i = 0; i < 60 * 600 && dists.length < count; i++) {
      w.player.pos.x = px; w.player.pos.y = py; w.player.vel.x = 0; w.player.vel.y = 0;
      tick(w, FIXED_DT, IDLE);
      for (const e of w.enemies) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          if (!e.isBoss) dists.push(Math.hypot(e.pos.x - w.player.pos.x, e.pos.y - w.player.pos.y));
        }
      }
      // keep the field empty so the cap never blocks further spawns
      w.enemies = [];
    }
    return dists;
  } finally { spy.mockRestore(); }
}

const PLACES: [string, number, number][] = [
  ['open water', WORLD_WIDTH / 2, WORLD_HEIGHT / 2],
  ['near the top-left corner', 120, 120],
  ['near the bottom-right corner', WORLD_WIDTH - 120, WORLD_HEIGHT - 120],
  ['against the left edge', 60, WORLD_HEIGHT / 2],
  ['against the top edge', WORLD_WIDTH / 2, 60],
];

describe('enemies never appear on top of the player', () => {
  test.each(PLACES)('%s', (_name, x, y) => {
    const d = spawnDistances(x, y, 120, 12345);
    expect(d.length).toBeGreaterThanOrEqual(100);
    const min = Math.min(...d);
    // Enemies must start off-screen. The screen is ~457 dp from centre at the
    // widest, so anything under ~300 would pop in visibly or ram instantly.
    expect(min).toBeGreaterThanOrEqual(SPAWN_MIN_PLAYER_DIST - 1);
  });
});

describe('pickSpawnPoint', () => {
  function worldAt(px: number, py: number): World {
    const w = createWorld('raft', ['raft']);
    w.player.pos.x = px; w.player.pos.y = py; w.camera.x = px; w.camera.y = py;
    return w;
  }

  test('bosses also start well away from the player, including in corners', () => {
    for (const [x, y] of [[100, 100], [WORLD_WIDTH - 100, 100], [100, WORLD_HEIGHT - 100], [WORLD_WIDTH / 2, WORLD_HEIGHT / 2]]) {
      for (let i = 0; i < 50; i++) {
        const w = worldAt(x, y);
        const p = pickSpawnPoint(w, 520, 90, BOSS_SPAWN_MIN_PLAYER_DIST, 0);
        expect(Math.hypot(p.x - x, p.y - y)).toBeGreaterThanOrEqual(BOSS_SPAWN_MIN_PLAYER_DIST - 1);
        expect(p.x).toBeGreaterThanOrEqual(90);
        expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH - 90);
        expect(p.y).toBeGreaterThanOrEqual(90);
        expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT - 90);
      }
    }
  });

  test('the result is always inside the world, even if the rules cannot all be met', () => {
    const w = worldAt(60, 60);
    for (let i = 0; i < 50; i++) {
      const p = pickSpawnPoint(w, 620, 50, 5000, 120);               // impossible distance
      expect(p.x).toBeGreaterThanOrEqual(50);
      expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH - 50);
      expect(p.y).toBeGreaterThanOrEqual(50);
      expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT - 50);
    }
  });

  test('keeps clear of other enemies when it can', () => {
    const w = worldAt(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    w.enemies.push({ id: 1, archetype: 'x', pos: { x: w.camera.x + 620, y: w.camera.y }, vel: { x: 0, y: 0 }, angle: 0, hull: 1, maxHull: 1, speed: 0, damage: 0, fireCooldown: 0, size: 10, color: '#fff', partsDrop: 0, wake: [] });
    for (let i = 0; i < 100; i++) {
      const p = pickSpawnPoint(w, 620, 50, SPAWN_MIN_PLAYER_DIST, 120);
      expect(Math.hypot(p.x - w.enemies[0].pos.x, p.y - w.enemies[0].pos.y)).toBeGreaterThanOrEqual(120);
    }
  });
});
