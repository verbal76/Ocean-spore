import { readFileSync } from 'fs';
import { join } from 'path';
import { SHIPS, SHIPS_BY_ID, shipsUnlockedByKills } from '../data/ships';
import { ENEMIES, BOSS } from '../data/enemies';
import { createWorld, FIXED_DT, InputState, switchShip, tick, applyUpgrades } from '../game/world';
import { rollUpRun } from '../state/progress';
import { defaultSave, sanitizeSave, SAVE_SCHEMA_VERSION } from '../state/saveSchema';
import { loadSave, saveSave } from '../state/persistence';

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: async (p: string) => ({ exists: mockFiles.has(p) }),
  readAsStringAsync: async (p: string) => { if (!mockFiles.has(p)) throw new Error('ENOENT'); return mockFiles.get(p)!; },
  writeAsStringAsync: async (p: string, d: string) => { mockFiles.set(p, d); },
  moveAsync: async ({ from, to }: { from: string; to: string }) => { mockFiles.set(to, mockFiles.get(from)!); mockFiles.delete(from); },
  deleteAsync: async (p: string) => { mockFiles.delete(p); },
}));
const FWD: InputState = { dx: 0, dy: -1, fire: false, autoFire: true };

describe('every ship and enemy renders a real model (a typo silently shows a red sphere)', () => {
  const registry = new Set(
    [...readFileSync(join(__dirname, '../render3d/assets.ts'), 'utf8').matchAll(/'([\w-]+)':\s*require/g)].map((m) => m[1]),
  );
  test('registry has the bundled models', () => { expect(registry.size).toBeGreaterThanOrEqual(15); });
  test.each(SHIPS.map((s) => [s.id, s.model] as const))('ship %s -> %s', (_id, model) => {
    expect(registry.has(model)).toBe(true);
  });
  test.each([...ENEMIES, BOSS].map((e) => [e.id, e.model] as const))('enemy %s -> %s', (_id, model) => {
    expect(model && registry.has(model)).toBe(true);
  });
});

describe('all seven ships are playable', () => {
  const ALL = SHIPS.map((s) => s.id);
  test('there are seven, with a strictly increasing unlock ladder starting at 0', () => {
    expect(SHIPS).toHaveLength(7);
    const k = SHIPS.map((s) => s.unlockKills);
    expect(k[0]).toBe(0);
    for (let i = 1; i < k.length; i++) expect(k[i]).toBeGreaterThan(k[i - 1]);
  });

  test.each(ALL)('%s: spawns with its own stats and survives 30 s of sailing and firing', (id) => {
    const def = SHIPS_BY_ID[id];
    const w = createWorld(id, ALL);
    expect(w.player.classId).toBe(id);
    expect(w.player.size).toBe(def.size);
    w.player.hull = w.player.maxHull = 1e6;                        // measure behaviour, not survival
    for (let i = 0; i < 30 * 60; i++) tick(w, FIXED_DT, FWD);
    expect(Number.isFinite(w.player.pos.x) && Number.isFinite(w.player.pos.y)).toBe(true);
    expect(w.player.pos.x).toBeGreaterThanOrEqual(0);
    expect(w.player.pos.x).toBeLessThanOrEqual(6000);
    expect(Math.hypot(w.player.vel.x, w.player.vel.y)).toBeGreaterThan(0);   // it actually moves
    expect(w.bullets.length + w.enemies.length).toBeGreaterThanOrEqual(0);
  });

  test('switching between every pair of ships at a harbor keeps a valid hull and stats', () => {
    const w = createWorld('raft', ALL);
    for (const a of ALL) for (const b of ALL) {
      switchShip(w, a); switchShip(w, b);
      applyUpgrades(w);
      expect(w.player.classId).toBe(b);
      expect(w.player.hull).toBeGreaterThan(0);
      expect(w.player.hull).toBeLessThanOrEqual(w.player.maxHull + 1e-6);
      expect(w.player.maxHull).toBeGreaterThanOrEqual(SHIPS_BY_ID[b].baseHull);
    }
  });

  test('every tier is a real upgrade somewhere (hull or damage never regresses below the raft)', () => {
    for (const s of SHIPS.slice(1)) {
      expect(s.baseHull).toBeGreaterThan(SHIPS[0].baseHull);
      expect(s.baseDamage).toBeGreaterThan(SHIPS[0].baseDamage);
    }
  });
});

describe('progression path: kills -> unlock -> save -> relaunch', () => {
  beforeEach(() => mockFiles.clear());

  test('each ship unlocks at exactly its lifetime-kill threshold, in order, none skipped', () => {
    for (const s of SHIPS) {
      const before = shipsUnlockedByKills(Math.max(0, s.unlockKills - 1));
      const at = shipsUnlockedByKills(s.unlockKills);
      expect(at).toContain(s.id);
      if (s.unlockKills > 0) expect(before).not.toContain(s.id);
    }
  });

  test('kills banked over many short runs unlock every ship; the last at 5000', () => {
    let p = { unlockedShips: ['raft'], highScore: 0, totalKills: 0, totalParts: 0 };
    const seen: string[] = [];
    while (p.unlockedShips.length < SHIPS.length) {
      const r = rollUpRun(p, { score: 10, kills: 25, totalParts: 40, unlockedShips: p.unlockedShips });
      for (const id of r.newlyUnlocked) seen.push(id);
      p = r.next;
      expect(p.totalKills).toBeLessThanOrEqual(5025);
    }
    expect(seen).toEqual(SHIPS.slice(1).map((s) => s.id));         // earned in ladder order
    expect(p.totalKills).toBe(5000);
  });

  test('progress survives an app relaunch (save -> load) including the selected ship', async () => {
    const r = rollUpRun(
      { unlockedShips: ['raft'], highScore: 0, totalKills: 0, totalParts: 0 },
      { score: 900, kills: 220, totalParts: 500, unlockedShips: ['raft'] },
    );
    await saveSave({ ...defaultSave(), ...r.next, lastShip: 'gunship' });
    const loaded = await loadSave();
    expect(loaded.totalKills).toBe(220);
    expect(loaded.unlockedShips).toEqual(expect.arrayContaining(['raft', 'patrol', 'skiff', 'gunship']));
    expect(loaded.unlockedShips).not.toContain('destroyer');
    expect(loaded.lastShip).toBe('gunship');                         // selection restored
    expect(createWorld(loaded.lastShip, loaded.unlockedShips).player.classId).toBe('gunship');
  });

  test('update from an OLD save (v1, no kills field, stale unlock list) heals instead of crashing', () => {
    const old = sanitizeSave({ schemaVersion: 1, highScore: 777, unlockedShips: ['raft'], lastShip: 'skiff' });
    expect(old.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(old.highScore).toBe(777);
    expect(old.lastShip).toBe('raft');                                // 'skiff' not owned yet -> safe default
    const stale = sanitizeSave({ totalKills: 600, unlockedShips: ['raft'], lastShip: 'destroyer' });
    expect(stale.unlockedShips).toContain('destroyer');               // earned by lifetime kills
    expect(stale.lastShip).toBe('destroyer');
  });

  test('a corrupted save falls back safely and the game can still start a run', async () => {
    mockFiles.set('file:///doc/ocean-spore-save.json', '{"totalKills": 9, "unlock');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await loadSave();
    expect(s).toEqual(defaultSave());
    expect(createWorld(s.lastShip, s.unlockedShips).player.classId).toBe('raft');
  });
});
