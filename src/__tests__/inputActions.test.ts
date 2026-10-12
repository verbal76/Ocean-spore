import {
  allGlyphKeys, applyRadialDeadzone, detectPadStyle, keyboardAxes, keyboardFire, menuForKey, newPadState,
  PAD, PadSnapshot, promptFor, PromptTracker, PROMPTS, resolvePromptStyle, stepGamepad, STICK_DEADZONE,
  tapsForKey, NAV_REPEAT_FIRST_MS,
} from '../input/inputActions';
import { pickInitial, pickNext } from '../input/menuNav';
import { buildLayout, TouchController } from '../game/controls';
import { createWorld, stepFixed, newStepClock, InputState } from '../game/world';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const pad = (axes: number[] = [0, 0], pressed: number[] = [], id = 'Xbox 360 Controller (STANDARD GAMEPAD)'): PadSnapshot => ({
  id, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
});

describe('keyboard', () => {
  test('WASD / arrows give a unit-clamped vector; diagonals are normalised like a stick', () => {
    expect(keyboardAxes(new Set(['KeyD']))).toEqual({ dx: 1, dy: 0 });
    expect(keyboardAxes(new Set(['ArrowUp']))).toEqual({ dx: 0, dy: -1 });
    const d = keyboardAxes(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(d.dx, d.dy)).toBeCloseTo(1, 10);
    expect(d.dx).toBeGreaterThan(0);
    expect(d.dy).toBeLessThan(0);
  });
  test('opposite keys cancel; no keys is neutral', () => {
    expect(keyboardAxes(new Set(['KeyA', 'KeyD']))).toEqual({ dx: 0, dy: 0 });
    expect(keyboardAxes(new Set())).toEqual({ dx: 0, dy: 0 });
  });
  test('fire is held; auto/weapon/dock/pause are edge taps', () => {
    expect(keyboardFire(new Set(['Space']))).toBe(true);
    expect(keyboardFire(new Set(['KeyD']))).toBe(false);
    expect(tapsForKey('KeyR')).toEqual(['auto']);
    expect(tapsForKey('KeyE')).toEqual(['weapon']);
    expect(tapsForKey('KeyF')).toEqual(['dock']);
    expect(tapsForKey('Escape')).toEqual(['pause']);
    expect(tapsForKey('KeyZ')).toEqual([]);
  });
  test('menu keys', () => {
    expect(menuForKey('Enter')).toBe('confirm');
    expect(menuForKey('Space')).toBe('confirm');
    expect(menuForKey('Escape')).toBe('back');
    expect(menuForKey('ArrowDown')).toBe('down');
    expect(menuForKey('KeyA')).toBe('left');
    expect(menuForKey('KeyZ')).toBeNull();
  });
});

describe('analog dead zone', () => {
  test('inside the zone is exactly zero (stick drift cannot move the ship)', () => {
    expect(applyRadialDeadzone(0.1, 0.1)).toEqual([0, 0]);
    expect(applyRadialDeadzone(STICK_DEADZONE, 0)).toEqual([0, 0]);
  });
  test('rescaled: continuous at the edge, 1 at full deflection, never above 1', () => {
    const [x0] = applyRadialDeadzone(STICK_DEADZONE + 1e-6, 0);
    expect(x0).toBeLessThan(0.001);
    expect(applyRadialDeadzone(1, 0)).toEqual([1, 0]);
    const [x, y] = applyRadialDeadzone(1, 1);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-9);
  });
  test('NaN / Infinity are neutral', () => {
    expect(applyRadialDeadzone(NaN, 0)).toEqual([0, 0]);
    expect(applyRadialDeadzone(Infinity, 0)).toEqual([0, 0]);
  });
});

describe('gamepad', () => {
  test('left stick moves; D-pad moves when the stick is idle', () => {
    expect(stepGamepad(newPadState(), pad([1, 0]), 0).axes.dx).toBe(1);
    const r = stepGamepad(newPadState(), pad([0, 0], [PAD.up]), 0);
    expect(r.axes).toMatchObject({ dx: 0, dy: -1 });
  });
  test('A or RT fire while held; releasing stops (nothing latches)', () => {
    let r = stepGamepad(newPadState(), pad([0, 0], [PAD.south]), 0);
    expect(r.axes.fire).toBe(true);
    r = stepGamepad(r.state, pad(), 16);
    expect(r.axes.fire).toBe(false);
    const rt: PadSnapshot = { ...pad(), buttons: pad().buttons.map((b, i) => (i === PAD.rt ? { pressed: false, value: 0.9 } : b)) };
    expect(stepGamepad(newPadState(), rt, 0).axes.fire).toBe(true);
  });
  test('taps are edge-triggered: held buttons do not repeat', () => {
    let r = stepGamepad(newPadState(), pad([0, 0], [PAD.west]), 0);
    expect(r.taps).toEqual(['weapon']);
    r = stepGamepad(r.state, pad([0, 0], [PAD.west]), 16);
    expect(r.taps).toEqual([]);
    r = stepGamepad(r.state, pad(), 32);
    r = stepGamepad(r.state, pad([0, 0], [PAD.west]), 48);
    expect(r.taps).toEqual(['weapon']);
  });
  test('Y/LB = auto, B = dock, Start/Back = pause, RB = weapon', () => {
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.north]), 0).taps).toEqual(['auto']);
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.lb]), 0).taps).toEqual(['auto']);
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.east]), 0).taps).toContain('dock');
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.start]), 0).taps).toEqual(['pause']);
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.back]), 0).taps).toEqual(['pause']);
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.rb]), 0).taps).toEqual(['weapon']);
  });
  test('menu: A confirms, B backs, directions repeat after a delay', () => {
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.south]), 0).menu).toContain('confirm');
    expect(stepGamepad(newPadState(), pad([0, 0], [PAD.east]), 0).menu).toContain('back');
    let r = stepGamepad(newPadState(), pad([0, 0], [PAD.down]), 0);
    expect(r.menu).toEqual(['down']);
    r = stepGamepad(r.state, pad([0, 0], [PAD.down]), NAV_REPEAT_FIRST_MS - 1);
    expect(r.menu).toEqual([]);
    r = stepGamepad(r.state, pad([0, 0], [PAD.down]), NAV_REPEAT_FIRST_MS + 1);
    expect(r.menu).toEqual(['down']);
    r = stepGamepad(r.state, pad(), NAV_REPEAT_FIRST_MS + 50);
    r = stepGamepad(r.state, pad([0, 0], [PAD.down]), NAV_REPEAT_FIRST_MS + 60);
    expect(r.menu).toEqual(['down']);                              // released -> immediate again
  });
  test('stick below the nav threshold does not navigate (drift)', () => {
    expect(stepGamepad(newPadState(), pad([0.4, 0.1]), 0).menu).toEqual([]);
    expect(stepGamepad(newPadState(), pad([0.8, 0.1]), 0).menu).toEqual(['right']);
  });
  test('missing axes / buttons (odd pads) never throw', () => {
    const odd: PadSnapshot = { id: 'x', axes: [], buttons: [] };
    expect(() => stepGamepad(newPadState(), odd, 0)).not.toThrow();
  });
});

describe('prompt family detection and flicker control', () => {
  test('families by Gamepad.id', () => {
    expect(detectPadStyle('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox');
    expect(detectPadStyle('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(detectPadStyle('Wireless Controller (Vendor: 054c Product: 09cc)')).toBe('ps4');
    expect(detectPadStyle('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('switch');
    expect(detectPadStyle('Steam Deck Controller (Vendor: 28de Product: 1205)')).toBe('xbox');   // Deck = ABXY
    expect(detectPadStyle('')).toBe('xbox');
  });
  test('manual override beats detection', () => {
    expect(resolvePromptStyle('auto', 'switch')).toBe('switch');
    expect(resolvePromptStyle('keyboard', 'switch')).toBe('keyboard');
    expect(resolvePromptStyle('xbox', 'ps4')).toBe('xbox');
  });
  test('mixed input does not flicker: switches are rate-limited', () => {
    const t = new PromptTracker(1500);
    expect(t.detected()).toBe('keyboard');
    expect(t.note('gamepad', 'Xbox pad', 100)).toBe(true);
    expect(t.detected()).toBe('xbox');
    // Keyboard taps right after a pad press must not flip the prompts back and forth.
    for (let i = 1; i <= 10; i++) {
      expect(t.note('keyboard', null, 100 + i * 50)).toBe(false);
      expect(t.note('gamepad', 'Xbox pad', 100 + i * 50 + 10)).toBe(false);
    }
    expect(t.detected()).toBe('xbox');
    expect(t.note('keyboard', null, 100 + 1600)).toBe(true);          // deliberate, after the hold
    expect(t.detected()).toBe('keyboard');
  });
  test('the same device never "switches"', () => {
    const t = new PromptTracker(1500);
    expect(t.note('keyboard', null, 0)).toBe(false);
  });
});

describe('prompt tables', () => {
  test('every gameplay and menu action has a prompt in every style (no blank labels)', () => {
    const actions = ['move', 'fire', 'weapon', 'auto', 'dock', 'pause', 'confirm', 'back', 'up', 'down', 'left', 'right'] as const;
    for (const style of Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]) {
      for (const a of actions) expect(promptFor(style, a).text.length).toBeGreaterThan(0);
    }
  });
  test('bottom face button maps to the hardware label of each family (no wrong labels)', () => {
    expect(promptFor('xbox', 'confirm').text).toBe('A');
    expect(promptFor('playstation', 'confirm').text).toBe('CROSS');
    expect(promptFor('switch', 'confirm').text).toBe('B');
    expect(promptFor('switch', 'back').text).toBe('A');
  });
  test('every glyph referenced exists in the imported pack, and the pack records its licence evidence', () => {
    const root = join(__dirname, '../../assets/glyphs');
    for (const k of allGlyphKeys()) expect(existsSync(join(root, `${k}.png`))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
    expect(manifest.sourceArchive.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(join(root, 'LICENSE.md'), 'utf8')).toMatch(/CC0/);
  });
  test('the missing Xbox Start/Menu glyph is honest text, not a wrong picture', () => {
    expect(promptFor('xbox', 'pause')).toEqual({ glyph: null, text: 'MENU' });
  });
});

describe('menu navigation geometry', () => {
  const grid = [
    { left: 0, top: 0, width: 100, height: 40 },     // 0
    { left: 120, top: 0, width: 100, height: 40 },   // 1
    { left: 0, top: 60, width: 100, height: 40 },    // 2
    { left: 120, top: 60, width: 100, height: 40 },  // 3
  ];
  test('moves along rows and columns', () => {
    expect(pickNext(grid, 0, 'right')).toBe(1);
    expect(pickNext(grid, 0, 'down')).toBe(2);
    expect(pickNext(grid, 3, 'left')).toBe(2);
    expect(pickNext(grid, 3, 'up')).toBe(1);
  });
  test('edges return -1 (no wrap, no stuck focus on nothing)', () => {
    expect(pickNext(grid, 0, 'left')).toBe(-1);
    expect(pickNext(grid, 0, 'up')).toBe(-1);
    expect(pickNext(grid, 3, 'down')).toBe(-1);
  });
  test('a vertical menu: down/up walk the list', () => {
    const col = [0, 1, 2].map((i) => ({ left: 100, top: i * 60, width: 200, height: 44 }));
    expect(pickNext(col, 0, 'down')).toBe(1);
    expect(pickNext(col, 1, 'down')).toBe(2);
    expect(pickNext(col, 2, 'up')).toBe(1);
  });
  test('prefers the same row over a nearer diagonal', () => {
    const r = [
      { left: 0, top: 0, width: 80, height: 40 },
      { left: 90, top: 50, width: 80, height: 40 },    // closer but a different row
      { left: 200, top: 0, width: 80, height: 40 },    // same row
    ];
    expect(pickNext(r, 0, 'right')).toBe(2);
  });
  test('initial focus is the top-left-most control', () => {
    expect(pickInitial(grid)).toBe(0);
    expect(pickInitial([])).toBe(-1);
  });
});

describe('desktop input drives the sim exactly like touch (gameplay unchanged)', () => {
  const run = (feed: (i: number) => { dx: number; dy: number; fire: boolean }) => {
    const w = createWorld('raft', ['raft'], 0);
    const input: InputState = { dx: 0, dy: 0, fire: false, autoFire: true };
    const clock = newStepClock();
    for (let i = 0; i < 600; i++) { Object.assign(input, feed(i)); stepFixed(w, input, 1 / 60, clock); }
    return { x: w.player.pos.x, y: w.player.pos.y, a: w.player.angle };
  };
  test('a full-deflection keyboard move equals a full-deflection touch drag in the same direction', () => {
    const layout = buildLayout(412, 860, { top: 24, bottom: 24 });
    const c = new TouchController(layout);
    const j = layout.joystick;
    c.sync([{ id: 1, x: j.cx, y: j.cy }]);                                  // finger down on the stick
    const touch = c.sync([{ id: 1, x: j.cx + j.radius * 2, y: j.cy }]);     // dragged past the rim, right
    const kb = keyboardAxes(new Set(['KeyD']));
    expect(touch.dx).toBeCloseTo(kb.dx, 10);
    expect(touch.dy).toBeCloseTo(kb.dy, 10);
    expect(run(() => ({ dx: touch.dx, dy: touch.dy, fire: false })))
      .toEqual(run(() => ({ dx: kb.dx, dy: kb.dy, fire: false })));
  });
});

describe('physical keyboard text entry (captain name)', () => {
  const { textForKey } = jest.requireActual('../input/inputActions');
  test('letters, backspace, space and enter', () => {
    expect(textForKey('KeyQ')).toEqual({ kind: 'char', ch: 'Q' });
    expect(textForKey('KeyW')).toEqual({ kind: 'char', ch: 'W' });
    expect(textForKey('Backspace')).toEqual({ kind: 'backspace' });
    expect(textForKey('Space')).toEqual({ kind: 'space' });
    expect(textForKey('Enter')).toEqual({ kind: 'done' });
    expect(textForKey('Digit1')).toBeNull();
    expect(textForKey('ArrowLeft')).toBeNull();
  });
});
