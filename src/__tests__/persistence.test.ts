// Simulated file system to exercise atomic writes, backup fallback and
// write serialization without a device.
const mockFiles = new Map<string, string>();
let mockFailNextWrite = false;

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: async (p: string) => ({ exists: mockFiles.has(p) }),
  readAsStringAsync: async (p: string) => {
    if (!mockFiles.has(p)) throw new Error('ENOENT');
    return mockFiles.get(p)!;
  },
  writeAsStringAsync: async (p: string, d: string) => {
    if (mockFailNextWrite) { mockFailNextWrite = false; throw new Error('disk full'); }
    await Promise.resolve();
    mockFiles.set(p, d);
  },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from)!); mockFiles.delete(from);
  },
  deleteAsync: async (p: string) => { mockFiles.delete(p); },
}));

import { loadSave, saveSave, flushSaves, clearSave } from '../state/persistence';
import { defaultSave } from '../state/saveSchema';

const MAIN = 'file:///doc/ocean-spore-save.json';

beforeEach(() => { mockFiles.clear(); mockFailNextWrite = false; jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('fresh install loads defaults', async () => {
  expect(await loadSave()).toEqual(defaultSave());
});

test('save then load round-trips', async () => {
  await saveSave({ ...defaultSave(), highScore: 77, captainName: 'Ada' });
  const s = await loadSave();
  expect(s.highScore).toBe(77);
  expect(s.captainName).toBe('Ada');
});

test('second save keeps previous good save as backup', async () => {
  await saveSave({ ...defaultSave(), highScore: 1 });
  await saveSave({ ...defaultSave(), highScore: 2 });
  expect(JSON.parse(mockFiles.get(MAIN + '.bak')!).highScore).toBe(1);
  expect(JSON.parse(mockFiles.get(MAIN)!).highScore).toBe(2);
  expect(mockFiles.has(MAIN + '.tmp')).toBe(false);
});

test('truncated main file falls back to backup instead of resetting progress', async () => {
  await saveSave({ ...defaultSave(), totalKills: 500 });
  await saveSave({ ...defaultSave(), totalKills: 600 });
  mockFiles.set(MAIN, '{"totalKills":6');            // simulated torn write
  expect((await loadSave()).totalKills).toBe(500);
});

test('corrupt main and no backup: defaults, damaged file preserved for diagnosis', async () => {
  mockFiles.set(MAIN, 'garbage{{');
  expect(await loadSave()).toEqual(defaultSave());
  expect(mockFiles.get(MAIN + '.corrupt')).toBe('garbage{{');
});

test('a failed write does not destroy the existing save', async () => {
  await saveSave({ ...defaultSave(), highScore: 5 });
  mockFailNextWrite = true;
  await saveSave({ ...defaultSave(), highScore: 9 });
  expect((await loadSave()).highScore).toBe(5);
});

test('overlapping saves are serialized: last write wins, file never interleaved', async () => {
  for (let i = 1; i <= 10; i++) saveSave({ ...defaultSave(), highScore: i });
  await flushSaves();
  expect((await loadSave()).highScore).toBe(10);
});

test('saved snapshot is not affected by later mutation of the caller object', async () => {
  const d = defaultSave();
  const p = saveSave(d);
  d.unlockedShips.push('fortress');
  await p;
  expect((await loadSave()).unlockedShips).toEqual(['raft']);
});

test('clearSave removes main, backup and temp mockFiles', async () => {
  await saveSave(defaultSave()); await saveSave(defaultSave());
  await clearSave();
  expect([...mockFiles.keys()]).toEqual([]);
});
