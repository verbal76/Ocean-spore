import {
  createWorld, FIXED_DT, InputState, MAX_STEPS_PER_FRAME, newStepClock, stepFixed, World,
} from '../game/world';

const IDLE: InputState = { dx: 0, dy: 0, fire: false, autoFire: false };

function newWorld(): World {
  const w = createWorld('raft', ['raft']);
  w.player.hull = w.player.maxHull = 1e9;
  return w;
}

function simulate(frameHz: number, seconds: number, input: InputState) {
  const w = newWorld();
  const clock = newStepClock();
  const frames = Math.round(frameHz * seconds);
  for (let i = 0; i < frames; i++) stepFixed(w, input, 1 / frameHz, clock);
  return w;
}

describe('stepFixed', () => {
  test('simulated time matches wall time regardless of frame rate', () => {
    for (const hz of [30, 60, 120, 144]) {
      const w = simulate(hz, 5, IDLE);
      expect(Math.abs(w.elapsed - 5)).toBeLessThan(2 * FIXED_DT);
    }
  });

  test('the same input gives the same ship position at 30, 60 and 120 fps', () => {
    const input: InputState = { dx: 0, dy: -1, fire: false, autoFire: false };
    const ref = simulate(60, 4, input).player.pos;
    for (const hz of [30, 120]) {
      const p = simulate(hz, 4, input).player.pos;
      expect(Math.hypot(p.x - ref.x, p.y - ref.y)).toBeLessThan(1);
    }
  });

  test('a slow 20 fps frame runs 3 steps, not one oversized step (no tunnelling)', () => {
    const w = newWorld();
    const { steps } = stepFixed(w, IDLE, 0.05, newStepClock());
    expect(steps).toBe(3);
  });

  test('a long stall is bounded: at most MAX_STEPS_PER_FRAME and the backlog is dropped', () => {
    const w = newWorld();
    const clock = newStepClock();
    const { steps } = stepFixed(w, IDLE, 5, clock);
    expect(steps).toBe(MAX_STEPS_PER_FRAME);
    expect(clock.accumulator).toBe(0);
    expect(stepFixed(w, IDLE, FIXED_DT, clock).steps).toBe(1);   // back to normal
  });

  test('ignores zero, negative, NaN and infinite frame times', () => {
    const w = newWorld();
    const clock = newStepClock();
    for (const dt of [0, -1, NaN, Infinity]) expect(stepFixed(w, IDLE, dt, clock).steps).toBe(0);
    expect(w.elapsed).toBe(0);
  });

  test('stops stepping when the player dies and reports it', () => {
    const w = newWorld();
    w.player.hull = 0;
    const clock = newStepClock();
    const res = stepFixed(w, IDLE, 0.1, clock);
    expect(res.died).toBe(true);
    expect(res.steps).toBe(1);
    expect(clock.accumulator).toBe(0);
  });
});

describe('player fire rate', () => {
  test('is exact on average, not quantised to the frame time', () => {
    const w = newWorld();
    w.player.fireRate = 7;      // 8.57 ticks/shot: frame quantisation would cost ~5%
    const rate = w.player.fireRate;
    const clock = newStepClock();
    const input: InputState = { dx: 0, dy: 0, fire: true, autoFire: false };
    const before = w.bulletIdCounter;
    for (let i = 0; i < 60 * 20; i++) stepFixed(w, input, FIXED_DT, clock);
    const shots = w.bulletIdCounter - before;
    expect(Math.abs(shots - rate * 20)).toBeLessThanOrEqual(1.5);
  });

  test('an idle gap does not bank a burst of free shots', () => {
    const w = newWorld();
    const clock = newStepClock();
    for (let i = 0; i < 60 * 10; i++) stepFixed(w, IDLE, FIXED_DT, clock);   // 10 s idle
    const before = w.bulletIdCounter;
    const fire: InputState = { dx: 0, dy: 0, fire: true, autoFire: false };
    for (let i = 0; i < 30; i++) stepFixed(w, fire, FIXED_DT, clock);        // 0.5 s
    const burst = w.bulletIdCounter - before;
    expect(burst).toBeLessThanOrEqual(Math.ceil(w.player.fireRate * 0.5) + 1);
  });
});
