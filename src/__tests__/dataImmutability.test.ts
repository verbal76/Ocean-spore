import { BOSS, ENEMIES } from '../data/enemies';
import { SHIPS } from '../data/ships';
import { UPGRADES } from '../data/upgrades';
import {
  applyUpgrades, createWorld, dockAt, FIXED_DT, InputState, repairCost, switchShip, tick, tryRepair, tryUpgrade, undock,
} from '../game/world';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

const snapshot = () => JSON.stringify({ SHIPS, ENEMIES, BOSS, UPGRADES });

describe('static game data is never mutated by play (it would leak between runs)', () => {
  const before = snapshot();
  beforeAll(() => { deepFreeze(SHIPS); deepFreeze(ENEMIES); deepFreeze(BOSS); deepFreeze(UPGRADES); });

  test('a full session: sail, fight, dock, buy, repair, switch ships, undock', () => {
    // Frozen objects throw on write in strict mode, so any mutation fails loudly here.
    const ids = SHIPS.map((s) => s.id);
    const w = createWorld('raft', ids);
    w.player.hull = w.player.maxHull = 1e6;
    w.run.parts = 1e9;
    const input: InputState = { dx: 0.3, dy: -1, fire: true, autoFire: true };
    for (let i = 0; i < 60 * 120; i++) {
      tick(w, FIXED_DT, input);
      if (i % 600 === 0) {
        dockAt(w, 0);
        for (const u of UPGRADES) tryUpgrade(w, u.key);
        if (repairCost(w) > 0) tryRepair(w);
        switchShip(w, ids[(i / 600) % ids.length]);
        applyUpgrades(w);
        undock(w);
      }
    }
    expect(snapshot()).toBe(before);
  });

  test('two runs are independent: upgrading one leaves a fresh world untouched', () => {
    const a = createWorld('raft', ['raft']);
    a.run.parts = 1e6;
    for (const u of UPGRADES) tryUpgrade(a, u.key);
    const b = createWorld('raft', ['raft']);
    expect(b.run.upgrades).toEqual({ hullLevel: 0, speedLevel: 0, damageLevel: 0, fireRateLevel: 0, magnetLevel: 0, regenLevel: 0 });
    expect(b.player.maxHull).toBe(SHIPS[0].baseHull);
    expect(b.enemies).toHaveLength(0);
    expect(b.run.unlockedShips).toEqual(['raft']);
  });

  test('1000 rapid restarts stay cheap and independent', () => {
    const t0 = Date.now();
    let last = createWorld('raft', ['raft']);
    for (let i = 0; i < 1000; i++) {
      const w = createWorld('raft', ['raft']);
      w.run.unlockedShips.push('patrol');
      expect(w).not.toBe(last);
      expect(w.run.unlockedShips).toEqual(['raft', 'patrol']);
      expect(w.events).toEqual([]);
      last = w;
    }
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
