import { rollUpRun } from '../state/progress';
import { sanitizeSave, defaultSave } from '../state/saveSchema';
import { SHIPS, shipsUnlockedByKills } from '../data/ships';
import { UPGRADES } from '../data/upgrades';
import { createWorld, tryUpgrade } from '../game/world';

const base = { unlockedShips: ['raft'], highScore: 100, totalKills: 0, totalParts: 0 };

describe('ships unlock from lifetime kills', () => {
  test('thresholds map to the ladder', () => {
    expect(shipsUnlockedByKills(0)).toEqual(['raft']);
    expect(shipsUnlockedByKills(9)).toEqual(['raft']);
    expect(shipsUnlockedByKills(10)).toEqual(['raft', 'patrol']);
    expect(shipsUnlockedByKills(5000)).toHaveLength(SHIPS.length);
  });

  test('kills from several short runs add up (a single run never reaches 500)', () => {
    let p = { ...base };
    for (let i = 0; i < 6; i++) p = rollUpRun(p, { score: 0, kills: 100, totalParts: 0, unlockedShips: p.unlockedShips }).next;
    expect(p.totalKills).toBe(600);
    expect(p.unlockedShips).toContain('destroyer');   // 500 lifetime kills
    expect(p.unlockedShips).not.toContain('warship'); // 1500
  });

  test('a run that crosses a threshold reports exactly the newly earned ships', () => {
    const { next, newlyUnlocked } = rollUpRun(
      { ...base, totalKills: 45, unlockedShips: ['raft', 'patrol'] },   // consistent save: patrol owned at 10
      { score: 10, kills: 10, totalParts: 5, unlockedShips: ['raft', 'patrol'] },
    );
    expect(newlyUnlocked).toEqual(['skiff']);                 // 55 lifetime >= 50
    expect(next.unlockedShips.sort()).toEqual(['patrol', 'raft', 'skiff']);
  });

  test('never loses ships, never lowers the high score, ignores negative stats', () => {
    const { next } = rollUpRun(
      { unlockedShips: ['raft', 'gunship'], highScore: 900, totalKills: 300, totalParts: 40 },
      { score: 5, kills: -50, totalParts: -9, unlockedShips: ['raft'] },
    );
    expect(next.unlockedShips).toContain('gunship');
    expect(next.highScore).toBe(900);
    expect(next.totalKills).toBe(300);
    expect(next.totalParts).toBe(40);
  });

  test('createWorld with lifetime kills unlocks on the first kill, not after 500 in one run', () => {
    const w = createWorld('raft', ['raft'], 499);
    expect(w.run.lifetimeKillsAtStart).toBe(499);
    expect(w.run.unlockedShips).toEqual(['raft']);
  });
});

describe('saves heal stale unlock lists', () => {
  test('a save with 600 lifetime kills owns the destroyer even if the list is stale', () => {
    const s = sanitizeSave({ totalKills: 600, unlockedShips: ['raft'] });
    expect(s.unlockedShips).toContain('destroyer');
    expect(s.unlockedShips).toContain('patrol');
  });
  test('fresh saves still start with only the raft', () => {
    expect(sanitizeSave({}).unlockedShips).toEqual(defaultSave().unlockedShips);
  });
});

describe('upgrades respect maxLevel', () => {
  test.each(UPGRADES.map((u) => [u.key, u.maxLevel] as const))('%s stops at level %i', (key, max) => {
    const w = createWorld('raft', ['raft']);
    w.run.parts = 1e15;
    for (let i = 0; i < max + 5; i++) tryUpgrade(w, key);
    expect(w.run.upgrades[key]).toBe(max);
    const parts = w.run.parts;
    expect(tryUpgrade(w, key)).toBe(false);
    expect(w.run.parts).toBe(parts);                          // and charges nothing
  });
});
