// Runtime for desktop keyboard + gamepad input. Everything environment-specific
// (event target, gamepad list, clock, frame scheduler) is injected, so the whole
// thing is unit-tested with fakes; src/platform/desktopLayer.web.ts wires it to the
// real window. No React, no DOM types.
import {
  EMPTY_AXES, GameAxes, InputDevice, keyboardAxes, keyboardFire, menuForKey, MenuKind, newPadState, PadSnapshot, PadState,
  PromptStyle, PromptTracker, stepGamepad, tapsForKey, TapKind,
} from './inputActions';
import { getBackHandler, getGameSink, isTextEntry } from './inputBus';

export interface KeyLike { code: string; repeat?: boolean; preventDefault?(): void; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }
export interface EventTargetLike {
  addEventListener(type: string, fn: (e: any) => void, opts?: any): void;
  removeEventListener(type: string, fn: (e: any) => void): void;
}
export interface DesktopInputEnv {
  target: EventTargetLike;
  getPads(): readonly (PadSnapshot | null)[];
  now(): number;
  raf(cb: () => void): number;
  caf(id: number): void;
}
export interface DesktopInputHooks {
  /** Menu navigation / confirm / back while no gameplay is being steered. */
  onMenu(kind: MenuKind): void;
  /** The detected prompt family changed (keyboard <-> pad, or pad family). */
  onDetected(style: PromptStyle): void;
  onPadConnection?(connected: boolean): void;
}

export class DesktopInput {
  private readonly down = new Set<string>();
  private readonly pads = new Map<number, PadState>();
  private readonly tracker = new PromptTracker();
  private raf = 0;
  private running = false;
  private lastAxes: GameAxes = { ...EMPTY_AXES };
  private wasPlaying = false;
  private padCount = 0;

  constructor(private readonly env: DesktopInputEnv, private readonly hooks: DesktopInputHooks) {}

  private readonly onKeyDown = (e: KeyLike) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;           // leave OS / window shortcuts alone
    const code = e.code;
    const sink = getGameSink();
    const mode = sink ? sink.mode() : null;
    this.noteDevice('keyboard', null);

    if (mode === 'playing') {
      this.down.add(code);
      if (!e.repeat) for (const t of tapsForKey(code)) sink!.tap(t);
      if (isGameKey(code)) e.preventDefault?.();
      return;
    }
    this.down.delete(code);
    // Typing a name: letters (incl. W/A/S/D) belong to the text field, not the menu.
    if (isTextEntry() && (/^Key[A-Z]$/.test(code) || code === 'Space' || code === 'Backspace')) return;
    if (mode === 'paused' && !e.repeat && (code === 'Escape' || code === 'KeyP')) { sink!.tap('pause'); e.preventDefault?.(); return; }
    const m = menuForKey(code);
    // Enter / Space on a focused control is handled natively (Pressable); only
    // navigation and "back" are ours.
    if (m && m !== 'confirm') { this.hooks.onMenu(m); e.preventDefault?.(); }
  };

  private readonly onKeyUp = (e: KeyLike) => { this.down.delete(e.code); };

  /** Focus loss or a device change must never leave input latched, and pauses a running game. */
  private readonly onBlur = () => {
    this.down.clear();
    const sink = getGameSink();
    if (sink && sink.mode() === 'playing') sink.tap('pause');
    this.pushAxes({ ...EMPTY_AXES }, true);
  };

  private readonly onPadConnected = () => { this.hooks.onPadConnection?.(true); };
  private readonly onPadDisconnected = () => {
    // A pad vanishing mid-run (battery, cable, suspend): release and pause.
    this.pads.clear();
    const sink = getGameSink();
    if (sink && sink.mode() === 'playing') sink.tap('pause');
    this.pushAxes({ ...EMPTY_AXES }, true);
    this.hooks.onPadConnection?.(false);
  };

  /** A mouse CLICK is deliberate (keyboard/mouse prompts); movement is not. Touch never switches. */
  private readonly onPointerDown = (e: { pointerType?: string }) => {
    if (e.pointerType === 'mouse') this.noteDevice('keyboard', null);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    const t = this.env.target;
    t.addEventListener('keydown', this.onKeyDown);
    t.addEventListener('keyup', this.onKeyUp);
    t.addEventListener('blur', this.onBlur);
    t.addEventListener('gamepadconnected', this.onPadConnected);
    t.addEventListener('gamepaddisconnected', this.onPadDisconnected);
    t.addEventListener('pointerdown', this.onPointerDown);
    const loop = () => {
      if (!this.running) return;
      this.poll();
      this.raf = this.env.raf(loop);
    };
    this.raf = this.env.raf(loop);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.env.caf(this.raf);
    const t = this.env.target;
    t.removeEventListener('keydown', this.onKeyDown);
    t.removeEventListener('keyup', this.onKeyUp);
    t.removeEventListener('blur', this.onBlur);
    t.removeEventListener('gamepadconnected', this.onPadConnected);
    t.removeEventListener('gamepaddisconnected', this.onPadDisconnected);
    t.removeEventListener('pointerdown', this.onPointerDown);
    this.down.clear();
    this.pushAxes({ ...EMPTY_AXES }, true);
  }

  private noteDevice(device: InputDevice, padId: string | null): void {
    if (this.tracker.note(device, padId, this.env.now())) this.hooks.onDetected(this.tracker.detected());
  }

  private pushAxes(a: GameAxes, force = false): void {
    const sink = getGameSink();
    if (!sink) { this.lastAxes = a; return; }
    const l = this.lastAxes;
    if (!force && l.dx === a.dx && l.dy === a.dy && l.fire === a.fire) return;
    this.lastAxes = a;
    sink.setAxes(a);
  }

  /** One frame: poll pads, merge with the keyboard, route to the game or the menus. */
  poll(): void {
    const now = this.env.now();
    const sink = getGameSink();
    const mode = sink ? sink.mode() : null;
    const playing = mode === 'playing';

    let padAxes: GameAxes = { ...EMPTY_AXES };
    const pads = this.env.getPads();
    let count = 0;
    for (let i = 0; i < pads.length; i++) {
      const snap = pads[i];
      if (!snap) continue;
      count++;
      const prev = this.pads.get(i) ?? newPadState();
      const r = stepGamepad(prev, snap, now);
      this.pads.set(i, r.state);
      if (r.anyButton || r.menu.length > 0) this.noteDevice('gamepad', snap.id);
      // First connected pad steers; others still navigate menus and press buttons.
      if (padAxes.dx === 0 && padAxes.dy === 0 && !padAxes.fire) padAxes = r.axes;
      else padAxes = { dx: padAxes.dx, dy: padAxes.dy, fire: padAxes.fire || r.axes.fire };

      if (playing) {
        for (const tp of r.taps) sink!.tap(tp as TapKind);
      } else {
        if (mode === 'paused' && r.taps.includes('pause')) sink!.tap('pause');
        for (const m of r.menu) this.hooks.onMenu(m);
      }
    }
    if (count !== this.padCount) { this.padCount = count; }

    if (playing) {
      const k = keyboardAxes(this.down);
      const useKey = k.dx !== 0 || k.dy !== 0;
      this.pushAxes({
        dx: useKey ? k.dx : padAxes.dx,
        dy: useKey ? k.dy : padAxes.dy,
        fire: keyboardFire(this.down) || padAxes.fire,
      });
      this.wasPlaying = true;
    } else if (this.wasPlaying) {
      // Pause / harbor / loading: nothing may stay latched.
      this.pushAxes({ ...EMPTY_AXES }, true);
      this.down.clear();
      this.wasPlaying = false;
    }
  }

  /** Programmatic "back" (used by the Escape/B path in menus). */
  static triggerBack(): void { getBackHandler()?.(); }
}

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
function isGameKey(code: string): boolean { return GAME_KEYS.has(code); }
