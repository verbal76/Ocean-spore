import { DesktopInput, DesktopInputEnv } from '../input/desktopInput';
import { GameAxes, MenuKind, PAD, PadSnapshot, PromptStyle, TapKind } from '../input/inputActions';
import { GameMode, setGameSink, setTextEntry } from '../input/inputBus';

class FakeTarget {
  handlers = new Map<string, Set<(e: any) => void>>();
  addEventListener(t: string, f: (e: any) => void) { (this.handlers.get(t) ?? this.handlers.set(t, new Set()).get(t)!).add(f); }
  removeEventListener(t: string, f: (e: any) => void) { this.handlers.get(t)?.delete(f); }
  emit(t: string, e: any = {}) { this.handlers.get(t)?.forEach((f) => f(e)); }
  count() { let n = 0; this.handlers.forEach((s) => { n += s.size; }); return n; }
}

const padSnap = (axes: number[] = [0, 0], pressed: number[] = [], id = 'Xbox Wireless Controller (STANDARD GAMEPAD)'): PadSnapshot => ({
  id, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
});

function setup() {
  const target = new FakeTarget();
  let time = 0;
  let pads: (PadSnapshot | null)[] = [];
  let mode: GameMode = 'playing';
  const axes: GameAxes[] = [];
  const taps: TapKind[] = [];
  const menu: MenuKind[] = [];
  const detected: PromptStyle[] = [];
  const env: DesktopInputEnv = { target, getPads: () => pads, now: () => time, raf: () => 1, caf: () => undefined };
  const input = new DesktopInput(env, { onMenu: (k) => menu.push(k), onDetected: (s) => detected.push(s) });
  setGameSink({ mode: () => mode, setAxes: (a) => axes.push({ ...a }), tap: (k) => taps.push(k) });
  input.start();
  return {
    target, input, axes, taps, menu, detected,
    key: (code: string, repeat = false) => target.emit('keydown', { code, repeat, preventDefault: () => undefined }),
    keyUp: (code: string) => target.emit('keyup', { code }),
    setMode: (m: GameMode) => { mode = m; },
    setPads: (p: (PadSnapshot | null)[]) => { pads = p; },
    tick: (ms = 16) => { time += ms; input.poll(); },
    last: () => axes[axes.length - 1],
  };
}

afterEach(() => setGameSink(null));

describe('keyboard in gameplay', () => {
  test('WASD moves and Space fires while held; releasing stops (nothing latches)', () => {
    const t = setup();
    t.key('KeyD'); t.key('Space'); t.tick();
    expect(t.last()).toEqual({ dx: 1, dy: 0, fire: true });
    t.keyUp('KeyD'); t.keyUp('Space'); t.tick();
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
  });
  test('one-shot actions fire once; OS key-repeat does not repeat them', () => {
    const t = setup();
    t.key('KeyE'); t.key('KeyE', true); t.key('KeyE', true);
    t.key('KeyR'); t.key('KeyF');
    expect(t.taps).toEqual(['weapon', 'auto', 'dock']);
  });
  test('Ctrl/Alt/Meta shortcuts are left to the OS', () => {
    const t = setup();
    t.target.emit('keydown', { code: 'KeyE', ctrlKey: true });
    expect(t.taps).toEqual([]);
  });
  test('Escape pauses while playing, resumes while paused, and is "back" in plain menus', () => {
    const t = setup();
    t.key('Escape');
    expect(t.taps).toEqual(['pause']);
    t.setMode('paused'); t.key('Escape');
    expect(t.taps).toEqual(['pause', 'pause']);
    expect(t.menu).toEqual([]);
    t.setMode('blocked'); t.key('Escape');
    expect(t.menu).toEqual(['back']);
  });
  test('menu navigation keys go to the menu layer when not playing; Enter is left to the focused control', () => {
    const t = setup();
    t.setMode('paused');
    t.key('ArrowDown'); t.key('KeyW'); t.key('Enter');
    expect(t.menu).toEqual(['down', 'up']);
  });
  test('a key held across a pause is not still held after resuming', () => {
    const t = setup();
    t.key('KeyD'); t.tick();
    expect(t.last().dx).toBe(1);
    t.setMode('paused'); t.tick();
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
    t.keyUp('KeyD');                                   // released during the pause (event may be missed)
    t.setMode('playing'); t.tick();
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
  });
});

describe('text entry', () => {
  afterEach(() => setTextEntry(false));
  test('while typing a name, W/A/S/D/Space/Backspace are text, not menu navigation; arrows still navigate', () => {
    const t = setup();
    t.setMode('blocked'); setTextEntry(true);
    t.key('KeyW'); t.key('KeyA'); t.key('KeyS'); t.key('KeyD'); t.key('Space'); t.key('Backspace');
    expect(t.menu).toEqual([]);
    t.key('ArrowDown');
    expect(t.menu).toEqual(['down']);
    t.key('Escape');
    expect(t.menu).toEqual(['down', 'back']);
  });
  test('outside text entry the same keys navigate', () => {
    const t = setup();
    t.setMode('blocked');
    t.key('KeyS');
    expect(t.menu).toEqual(['down']);
  });
});

describe('focus loss and device loss', () => {
  test('window blur releases everything and pauses a running game', () => {
    const t = setup();
    t.key('KeyD'); t.key('Space'); t.tick();
    t.target.emit('blur');
    expect(t.taps).toContain('pause');
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
    t.tick();
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
  });
  test('blur outside gameplay does not pause anything', () => {
    const t = setup();
    t.setMode('blocked'); t.target.emit('blur');
    expect(t.taps).toEqual([]);
  });
  test('a controller disconnecting mid-run releases input and pauses', () => {
    const t = setup();
    t.setPads([padSnap([1, 0], [PAD.south])]); t.tick();
    expect(t.last()).toMatchObject({ dx: 1, fire: true });
    t.setPads([]); t.target.emit('gamepaddisconnected');
    expect(t.taps).toContain('pause');
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
  });
  test('connection events are reported', () => {
    const states: boolean[] = [];
    const target = new FakeTarget();
    const input = new DesktopInput({ target, getPads: () => [], now: () => 0, raf: () => 1, caf: () => undefined },
      { onMenu: () => undefined, onDetected: () => undefined, onPadConnection: (c) => states.push(c) });
    input.start();
    target.emit('gamepadconnected'); target.emit('gamepaddisconnected');
    expect(states).toEqual([true, false]);
  });
});

describe('gamepad in gameplay', () => {
  test('stick moves, A fires, face buttons act once, Start pauses', () => {
    const t = setup();
    t.setPads([padSnap([0, -1], [PAD.south])]); t.tick();
    expect(t.last()).toEqual({ dx: 0, dy: -1, fire: true });
    t.setPads([padSnap([0, -1], [PAD.south, PAD.west])]); t.tick();
    t.setPads([padSnap([0, -1], [PAD.south, PAD.west])]); t.tick();
    expect(t.taps).toEqual(['weapon']);
    t.setPads([padSnap([0, 0], [PAD.start])]); t.tick();
    expect(t.taps).toEqual(['weapon', 'pause']);
  });
  test('stick drift inside the dead zone does not move the ship', () => {
    const t = setup();
    t.setPads([padSnap([0.12, -0.1])]); t.tick();
    expect(t.axes.length === 0 || t.last().dx === 0).toBe(true);
    expect(t.last()?.dy ?? 0).toBe(0);
  });
  test('keyboard wins when both steer; fire is the OR of both', () => {
    const t = setup();
    t.setPads([padSnap([1, 0])]); t.key('KeyW'); t.tick();
    expect(t.last().dx).toBe(0);
    expect(t.last().dy).toBe(-1);
    t.setPads([padSnap([0, 0], [PAD.south])]); t.keyUp('KeyW'); t.tick();
    expect(t.last().fire).toBe(true);
  });
  test('while paused, pad directions and A navigate the pause menu; Start resumes', () => {
    const t = setup();
    t.setMode('paused');
    t.setPads([padSnap([0, 0], [PAD.down])]); t.tick();
    t.setPads([padSnap([0, 0], [PAD.south])]); t.tick();
    expect(t.menu).toEqual(['down', 'confirm']);
    t.setPads([padSnap([0, 0], [PAD.start])]); t.tick();
    expect(t.taps).toEqual(['pause']);
  });
  test('menu directions are not gameplay input while paused', () => {
    const t = setup();
    t.setMode('paused'); t.setPads([padSnap([1, 0])]); t.tick();
    expect(t.axes.some((a) => a.dx !== 0)).toBe(false);
  });
});

describe('prompt detection from real input', () => {
  test('pad button -> pad prompts; stick noise does not switch', () => {
    const t = setup();
    t.setPads([padSnap([0.3, 0.2])]); t.tick(2000);
    expect(t.detected).toEqual([]);
    t.setPads([padSnap([0, 0], [PAD.east])]); t.tick(2000);
    expect(t.detected).toEqual(['xbox']);
  });
  test('PlayStation / Nintendo pads select their families', () => {
    const t = setup();
    t.setPads([padSnap([0, 0], [PAD.east], 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')]); t.tick(2000);
    expect(t.detected.pop()).toBe('playstation');
  });
  test('mouse clicks count as keyboard/mouse; touch and mouse movement do not', () => {
    const t = setup();
    t.setPads([padSnap([0, 0], [PAD.east])]); t.tick(2000);
    t.target.emit('pointermove', { pointerType: 'mouse' });
    t.target.emit('pointerdown', { pointerType: 'touch' });
    expect(t.detected).toEqual(['xbox']);
    t.tick(2000);
    t.target.emit('pointerdown', { pointerType: 'mouse' });
    expect(t.detected).toEqual(['xbox', 'keyboard']);
  });
  test('rapid mixed input does not flicker the prompts', () => {
    const t = setup();
    for (let i = 0; i < 20; i++) {
      t.setPads([padSnap([0, 0], [i % 2 ? PAD.south : PAD.east])]); t.tick(40);
      t.key('KeyA'); t.keyUp('KeyA');
    }
    expect(t.detected.length).toBeLessThanOrEqual(2);
  });
});

describe('lifecycle', () => {
  test('stop() removes every listener and releases input', () => {
    const t = setup();
    t.key('KeyD'); t.tick();
    t.input.stop();
    expect(t.target.count()).toBe(0);
    expect(t.last()).toEqual({ dx: 0, dy: 0, fire: false });
  });
  test('start() twice does not double-register', () => {
    const t = setup();
    const before = t.target.count();
    t.input.start();
    expect(t.target.count()).toBe(before);
  });
  test('no game mounted: keyboard navigation still reaches the menus', () => {
    const t = setup();
    setGameSink(null);
    t.key('ArrowRight'); t.key('Escape');
    expect(t.menu).toEqual(['right', 'back']);
  });
});
