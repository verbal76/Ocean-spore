import {
  buildLayout, classify, METRICS, NEUTRAL, TapAction, TouchController, TouchPoint, ControlLayout,
} from '../game/controls';

const PHONES: [string, number, number, { top: number; bottom: number }][] = [
  ['small 360x640', 360, 640, { top: 24, bottom: 0 }],
  ['common 412x915 gesture nav', 412, 915, { top: 32, bottom: 24 }],
  ['iphone-like 390x844 cutout', 390, 844, { top: 47, bottom: 34 }],
  ['tall 360x800', 360, 800, { top: 28, bottom: 20 }],
];

function setup(harbor = false) {
  const layout = buildLayout(412, 915, { top: 32, bottom: 24 });
  const taps: TapAction[] = [];
  const c = new TouchController(layout);
  const rawSync = c.sync.bind(c);
  c.sync = (pts) => { const s = rawSync(pts); taps.push(...c.takeTaps()); return s; };   // accumulate for assertions
  c.setHarborInRange(harbor);
  return { layout, taps, c };
}
const at = (id: number, cx: number, cy: number): TouchPoint => ({ id, x: cx, y: cy });
const onStick = (l: ControlLayout, id: number, ox = 0, oy = 0) => at(id, l.joystick.cx + ox, l.joystick.cy + oy);
const onFire = (l: ControlLayout, id: number) => at(id, l.fire.cx, l.fire.cy);

describe.each(PHONES)('layout on %s', (_n, w, h, insets) => {
  const l = buildLayout(w, h, insets);
  const circles = [l.joystick, l.fire];
  const boxes = [l.auto, l.weapon, l.pause];

  test('every control sits fully on screen and clear of the system bars', () => {
    for (const c of circles) {
      expect(c.cx - c.radius).toBeGreaterThanOrEqual(0);
      expect(c.cx + c.radius).toBeLessThanOrEqual(w);
      expect(c.cy + c.radius).toBeLessThanOrEqual(h - insets.bottom);   // above the gesture bar
    }
    for (const b of boxes) {
      expect(b.cx - b.w / 2).toBeGreaterThanOrEqual(0);
      expect(b.cx + b.w / 2).toBeLessThanOrEqual(w);
      expect(b.cy - b.h / 2).toBeGreaterThanOrEqual(insets.top);         // below the status bar / cutout
      expect(b.cy + b.h / 2).toBeLessThanOrEqual(h - insets.bottom);
    }
  });

  test('controls do not overlap one another', () => {
    const d = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
    expect(d(l.joystick, l.fire)).toBeGreaterThan(l.joystick.radius + l.fire.radius);
    const overlap = (a: typeof l.auto, b: typeof l.auto) =>
      Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2;
    expect(overlap(l.auto, l.weapon)).toBe(false);
    expect(overlap(l.auto, l.pause)).toBe(false);
    expect(overlap(l.weapon, l.pause)).toBe(false);
  });

  test('effective touch targets are at least 48 dp including slop', () => {
    for (const b of [l.auto, l.weapon]) {
      expect(b.w + 2 * METRICS.SLOP_SMALL).toBeGreaterThanOrEqual(48);
      expect(b.h + 2 * METRICS.SLOP_SMALL).toBeGreaterThanOrEqual(48);
    }
    expect(l.pause.h + 2 * METRICS.SLOP_ROUND).toBeGreaterThanOrEqual(48);
  });

  test('each control centre classifies as itself', () => {
    expect(classify(l.joystick.cx, l.joystick.cy, l, false)).toBe('joystick');
    expect(classify(l.fire.cx, l.fire.cy, l, false)).toBe('fire');
    expect(classify(l.auto.cx, l.auto.cy, l, false)).toBe('auto');
    expect(classify(l.weapon.cx, l.weapon.cy, l, false)).toBe('weapon');
    expect(classify(l.pause.cx, l.pause.cy, l, false)).toBe('pause');
    expect(classify(w / 2, 5, l, false)).toBeNull();
  });
});

describe('joystick + fire (multi-touch)', () => {
  test('one finger steers, radius-clamped', () => {
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 10, 0)]);                                 // touch down on the stick...
    const s = c.sync([onStick(layout, 1, 200, 0)]);                     // ...then drag far to the right
    expect(s.dx).toBeCloseTo(1, 5);
    expect(s.dy).toBeCloseTo(0, 5);
    expect(Math.hypot(s.knobX, s.knobY)).toBeCloseTo(layout.joystick.radius, 5);
    const half = c.sync([onStick(layout, 1, 0, -layout.joystick.radius / 2)]);
    expect(half.dy).toBeCloseTo(-0.5, 5);                               // up = negative y = forward
  });

  test('steering AND firing at the same time', () => {
    const { layout, c } = setup();
    const s = c.sync([onStick(layout, 1, 40, -40), onFire(layout, 2)]);
    expect(s.fire).toBe(true);
    expect(s.dx).toBeGreaterThan(0);
    expect(s.dy).toBeLessThan(0);
  });

  test('REGRESSION: lifting the stick finger while FIRE is held still releases the stick', () => {
    // RN reports a partial lift as onResponderEnd; the old handler only looked at
    // grant/move, so a stationary FIRE finger left the ship steering forever.
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 40, -40), onFire(layout, 2)]);
    const s = c.sync([onFire(layout, 2)]);                              // stick finger gone, fire unchanged
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
    expect(s.knobX).toBe(0);
    expect(s.fire).toBe(true);
  });

  test('lifting FIRE while steering keeps steering and stops firing', () => {
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 40, -40), onFire(layout, 2)]);
    const s = c.sync([onStick(layout, 1, 40, -40)]);
    expect(s.fire).toBe(false);
    expect(s.dx).toBeGreaterThan(0);
  });

  test('all fingers up (release / cancel) returns to neutral', () => {
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 40, -40), onFire(layout, 2)]);
    expect(c.sync([])).toEqual(NEUTRAL);
  });

  test('finger ids can be reused after a lift', () => {
    const { layout, c } = setup();
    c.sync([onFire(layout, 1)]);
    c.sync([]);
    expect(c.sync([onStick(layout, 1, 30, 0)]).dx).toBeGreaterThan(0);
  });

  test('a finger keeps its control when it drags across the screen', () => {
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 10, 0)]);
    const s = c.sync([at(1, layout.fire.cx, layout.fire.cy)]);          // dragged all the way to FIRE
    expect(s.fire).toBe(false);                                         // still just the stick
    expect(Math.hypot(s.knobX, s.knobY)).toBeCloseTo(layout.joystick.radius, 5);
  });

  test('a finger that started outside any control never becomes the stick', () => {
    const { layout, c } = setup();
    c.sync([at(1, 200, 300)]);
    const s = c.sync([at(1, layout.joystick.cx + 20, layout.joystick.cy)]);
    expect(s).toEqual(NEUTRAL);
  });

  test('a second finger on the stick is ignored and does not take over later', () => {
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 30, 0)]);
    c.sync([onStick(layout, 1, 30, 0), onStick(layout, 2, -30, 0)]);
    const s = c.sync([onStick(layout, 2, -30, 0)]);                      // first lifted
    expect(s).toEqual(NEUTRAL);
  });

  test('releaseAll (pause / dock / background) clears everything', () => {
    const { layout, c } = setup();
    c.sync([onStick(layout, 1, 40, 0), onFire(layout, 2)]);
    expect(c.releaseAll()).toEqual(NEUTRAL);
    // the same fingers still being reported afterwards are NOT re-claimed as new controls mid-hold
    const s = c.sync([onStick(layout, 1, 40, 0), onFire(layout, 2)]);
    expect(s.fire).toBe(true);                                           // they re-register as fresh touches
  });
});

describe('host ordering (state first, then taps)', () => {
  test('REGRESSION: pausing while steering + firing ends neutral, not with stale deflection', () => {
    const layout = buildLayout(412, 915, { top: 32, bottom: 24 });
    const c = new TouchController(layout);
    // Host exactly as Game.tsx does it: apply the state, THEN run the taps.
    let applied = c.sync([onStick(layout, 1, 40, -40), onFire(layout, 2)]);
    expect(applied.fire).toBe(true);
    applied = c.sync([onStick(layout, 1, 40, -40), onFire(layout, 2), at(3, layout.pause.cx, layout.pause.cy)]);
    expect(applied.dx).toBeGreaterThan(0);                                  // computed before the tap ran
    for (const a of c.takeTaps()) if (a === 'pause') applied = c.releaseAll();
    expect(applied).toEqual(NEUTRAL);
    expect(c.takeTaps()).toEqual([]);                                       // queue drained
  });

  test('releaseAll also discards taps that were queued but not yet run', () => {
    const layout = buildLayout(412, 915, { top: 32, bottom: 24 });
    const c = new TouchController(layout);
    c.sync([at(1, layout.auto.cx, layout.auto.cy)]);
    c.releaseAll();
    expect(c.takeTaps()).toEqual([]);
  });
});

describe('tap buttons', () => {
  test('fire once per touch-down, not on every move event', () => {
    const { layout, taps, c } = setup();
    const p = at(1, layout.auto.cx, layout.auto.cy);
    c.sync([p]); c.sync([p]); c.sync([{ ...p, x: p.x + 2 }]);
    expect(taps).toEqual(['auto']);
    c.sync([]);
    c.sync([p]);
    expect(taps).toEqual(['auto', 'auto']);
  });

  test('toggling AUTO while steering does not disturb the stick', () => {
    const { layout, taps, c } = setup();
    c.sync([onStick(layout, 1, 40, -40)]);
    const s = c.sync([onStick(layout, 1, 40, -40), at(2, layout.weapon.cx, layout.weapon.cy)]);
    expect(taps).toEqual(['weapon']);
    expect(s.dx).toBeGreaterThan(0);
  });

  test('dock target only exists while a harbor is in range', () => {
    const a = setup(false);
    a.c.sync([at(1, a.layout.dock.cx, a.layout.dock.cy)]);
    expect(a.taps).toEqual([]);
    const b = setup(true);
    b.c.sync([at(1, b.layout.dock.cx, b.layout.dock.cy)]);
    expect(b.taps).toEqual(['dock']);
  });

  test('pause is reachable while firing and steering', () => {
    const { layout, taps, c } = setup();
    c.sync([onStick(layout, 1, 40, 0), onFire(layout, 2), at(3, layout.pause.cx, layout.pause.cy)]);
    expect(taps).toEqual(['pause']);
  });
});

describe('soak: no random touch sequence can leave a control latched', () => {
  function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  test.each([1, 2, 3, 4, 5])('seed %i: 3000 random events, then all fingers up => neutral', (seed) => {
    const rnd = mulberry32(seed);
    const { c } = setup(true);
    const down = new Map<number, TouchPoint>();
    for (let i = 0; i < 3000; i++) {
      const r = rnd();
      if (r < 0.3 && down.size < 5) {
        const id = Math.floor(rnd() * 8);
        if (!down.has(id)) down.set(id, at(id, rnd() * 412, rnd() * 915));
      } else if (r < 0.55 && down.size) {
        down.delete(Array.from(down.keys())[Math.floor(rnd() * down.size)]);   // partial lift
      } else if (down.size) {
        const k = Array.from(down.keys())[Math.floor(rnd() * down.size)];
        down.set(k, at(k, rnd() * 412, rnd() * 915));                          // move
      }
      if (rnd() < 0.02) { c.releaseAll(); }
      const s = c.sync(Array.from(down.values()));
      expect(Number.isFinite(s.dx) && Number.isFinite(s.dy)).toBe(true);
      expect(Math.hypot(s.dx, s.dy)).toBeLessThanOrEqual(1.000001);
    }
    down.clear();
    expect(c.sync([])).toEqual(NEUTRAL);
  });
});
