import { defaultSave, sanitizeSave, parseSave, SAVE_SCHEMA_VERSION } from '../state/saveSchema';

describe('saveSchema', () => {
  test('defaultSave returns a fresh object each call (no shared mutable defaults)', () => {
    const a = defaultSave();
    a.unlockedShips.push('fortress');
    expect(defaultSave().unlockedShips).toEqual(['raft']);
  });

  test('non-object input yields defaults', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) {
      expect(sanitizeSave(bad)).toEqual(defaultSave());
    }
  });

  test('keeps a valid save intact', () => {
    const s = sanitizeSave({
      unlockedShips: ['raft', 'patrol'], highScore: 120, totalKills: 40,
      totalParts: 900, lastShip: 'patrol', captainName: 'Ada', schemaVersion: 2,
    });
    expect(s).toEqual({
      unlockedShips: ['raft', 'patrol'], highScore: 120, totalKills: 40,
      totalParts: 900, lastShip: 'patrol', captainName: 'Ada',
      schemaVersion: SAVE_SCHEMA_VERSION,
    });
  });

  test('non-array unlockedShips no longer crashes; starter ship kept', () => {
    expect(sanitizeSave({ unlockedShips: 'patrol' }).unlockedShips).toEqual(['raft']);
  });

  test('unknown ship ids are dropped and starter ship is always present', () => {
    const s = sanitizeSave({ unlockedShips: ['patrol', 'death-star', 7, null] });
    expect(s.unlockedShips.sort()).toEqual(['patrol', 'raft']);
  });

  test('lastShip must be an owned, known ship', () => {
    expect(sanitizeSave({ unlockedShips: ['raft'], lastShip: 'fortress' }).lastShip).toBe('raft');
    expect(sanitizeSave({ unlockedShips: ['raft'], lastShip: 42 }).lastShip).toBe('raft');
  });

  test('numeric fields reject NaN, negatives, strings and Infinity', () => {
    const s = sanitizeSave({ highScore: NaN, totalKills: -5, totalParts: '9', });
    expect([s.highScore, s.totalKills, s.totalParts]).toEqual([0, 0, 0]);
    expect(sanitizeSave({ highScore: Infinity }).highScore).toBe(0);
    expect(sanitizeSave({ highScore: 12.9 }).highScore).toBe(12);
  });

  test('captain name is a bounded string', () => {
    expect(sanitizeSave({ captainName: 99 }).captainName).toBe('');
    expect(sanitizeSave({ captainName: 'x'.repeat(500) }).captainName).toHaveLength(24);
  });

  test('older schema version (missing fields) migrates with defaults', () => {
    const s = sanitizeSave({ schemaVersion: 1, highScore: 10 });
    expect(s.highScore).toBe(10);
    expect(s.unlockedShips).toEqual(['raft']);
    expect(s.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  test('parseSave returns null for truncated / invalid JSON so a backup can be used', () => {
    expect(parseSave('{"unlockedShips":["raf')).toBeNull();
    expect(parseSave('')).toBeNull();
    expect(parseSave('{"highScore":3}')?.highScore).toBe(3);
  });
});
