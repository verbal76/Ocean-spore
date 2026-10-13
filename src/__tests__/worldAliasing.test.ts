import { createWorld } from '../game/world';

test('createWorld copies the unlocked-ships array (run state must not alias app state)', () => {
  const owned = ['raft'];
  const w = createWorld('raft', owned);
  w.run.unlockedShips.push('patrol');
  expect(owned).toEqual(['raft']);
});
