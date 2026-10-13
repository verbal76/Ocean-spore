// Desktop input actions: the pure, shared layer between keyboards / gamepads and
// the game. Touch input (src/game/controls.ts) is untouched; this file feeds the
// SAME sim input fields (dx, dy, fire) and the SAME tap actions, so movement,
// timing and gameplay are identical across platforms.
//
// Action inventory (from the Android touch controls):
//   joystick  -> move (dx, dy in [-1, 1], radius-clamped; screen axes: +x right, +y down)
//   FIRE      -> fire (held)
//   AUTO      -> toggle auto-fire        (tap)
//   WEAPON    -> cycle weapon            (tap)
//   PAUSE     -> pause / resume          (tap)
//   DOCK      -> dock when a harbor is in range (tap)
// plus, for menus: navigate (up/down/left/right), confirm, back.
//
// No React, no DOM: unit-tested without a device.

export type NavDir = 'up' | 'down' | 'left' | 'right';
export type TapKind = 'auto' | 'weapon' | 'pause' | 'dock';
export type MenuKind = 'confirm' | 'back' | NavDir;
/** Every named input action (used for prompts and rebinding tables). */
export type ActionName = 'move' | 'fire' | TapKind | MenuKind;

export interface GameAxes { dx: number; dy: number; fire: boolean }
export interface InputFrame {
  axes: GameAxes;
  taps: TapKind[];
  menu: MenuKind[];
}
export const EMPTY_AXES: GameAxes = { dx: 0, dy: 0, fire: false };

/** Radial dead zone for analog sticks; leaves the existing sim threshold (0.10) untouched. */
export const STICK_DEADZONE = 0.18;
/** Stick deflection that counts as a menu direction press, and its repeat timing. */
export const NAV_THRESHOLD = 0.6;
export const NAV_REPEAT_FIRST_MS = 380;
export const NAV_REPEAT_MS = 130;
/** Analog trigger value that counts as pressed. */
export const TRIGGER_THRESHOLD = 0.4;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Radial dead zone with rescaling: inside the zone -> 0, then linear up to 1 at
 * full deflection (so there is no jump at the zone edge). Non-finite input is 0.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const mag = Math.hypot(x, y);
  if (mag <= deadzone) return [0, 0];
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return [clamp1((x / mag) * scaled), clamp1((y / mag) * scaled)];
}

// --- Keyboard --------------------------------------------------------------

/** `KeyboardEvent.code` values (layout independent: WASD stays WASD on AZERTY). */
export const KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  fire: ['Space', 'KeyJ'],
  auto: ['KeyR'],
  weapon: ['KeyE', 'KeyQ'],
  dock: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'NumpadEnter'],
} as const;

const anyDown = (down: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => down.has(c));

/** Held movement keys -> a unit-clamped vector (diagonals are normalised, as a stick would be). */
export function keyboardAxes(down: ReadonlySet<string>): { dx: number; dy: number } {
  const dx = (anyDown(down, KEYS.right) ? 1 : 0) - (anyDown(down, KEYS.left) ? 1 : 0);
  const dy = (anyDown(down, KEYS.down) ? 1 : 0) - (anyDown(down, KEYS.up) ? 1 : 0);
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
  const m = Math.hypot(dx, dy);
  return { dx: dx / m, dy: dy / m };
}

export function keyboardFire(down: ReadonlySet<string>): boolean {
  return anyDown(down, KEYS.fire);
}

/** Edge-triggered gameplay taps for a key that was just pressed (not auto-repeat). */
export function tapsForKey(code: string): TapKind[] {
  const out: TapKind[] = [];
  if ((KEYS.auto as readonly string[]).includes(code)) out.push('auto');
  if ((KEYS.weapon as readonly string[]).includes(code)) out.push('weapon');
  if ((KEYS.dock as readonly string[]).includes(code)) out.push('dock');
  if ((KEYS.pause as readonly string[]).includes(code)) out.push('pause');
  return out;
}

/** Menu action for a key that was just pressed. Enter/Space activate; Escape/Backspace go back. */
export function menuForKey(code: string): MenuKind | null {
  if ((KEYS.confirm as readonly string[]).includes(code) || code === 'Space') return 'confirm';
  if (code === 'Escape' || code === 'Backspace') return 'back';
  if ((KEYS.up as readonly string[]).includes(code)) return 'up';
  if ((KEYS.down as readonly string[]).includes(code)) return 'down';
  if ((KEYS.left as readonly string[]).includes(code)) return 'left';
  if ((KEYS.right as readonly string[]).includes(code)) return 'right';
  return null;
}

// --- Text entry (captain name) ------------------------------------------------

export type TextKey = { kind: 'char'; ch: string } | { kind: 'backspace' } | { kind: 'space' } | { kind: 'done' };

/** Physical-keyboard typing for the captain-name screen (letters only, like the on-screen keyboard). */
export function textForKey(code: string): TextKey | null {
  const m = /^Key([A-Z])$/.exec(code);
  if (m) return { kind: 'char', ch: m[1] };
  if (code === 'Backspace') return { kind: 'backspace' };
  if (code === 'Space') return { kind: 'space' };
  if (code === 'Enter' || code === 'NumpadEnter') return { kind: 'done' };
  return null;
}

// --- Gamepad (W3C "standard" mapping) --------------------------------------

export interface PadSnapshot {
  id: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export const PAD = {
  south: 0, east: 1, west: 2, north: 3,        // A/B/X/Y, Cross/Circle/Square/Triangle, B/A/Y/X (Switch)
  lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9, l3: 10, r3: 11,
  up: 12, down: 13, left: 14, right: 15,
} as const;

export interface PadState {
  /** Buttons held on the previous poll (for edge detection). */
  down: boolean[];
  /** Menu direction currently held + when it next repeats. */
  navDir: NavDir | null;
  navNextAt: number;
}
export const newPadState = (): PadState => ({ down: [], navDir: null, navNextAt: 0 });

const btn = (s: PadSnapshot, i: number): boolean => {
  const b = s.buttons[i];
  if (!b) return false;
  return b.pressed || b.value > (i === PAD.lt || i === PAD.rt ? TRIGGER_THRESHOLD : 0.5);
};

function navFromPad(s: PadSnapshot, lx: number, ly: number): NavDir | null {
  if (btn(s, PAD.up)) return 'up';
  if (btn(s, PAD.down)) return 'down';
  if (btn(s, PAD.left)) return 'left';
  if (btn(s, PAD.right)) return 'right';
  const ax = Math.abs(lx);
  const ay = Math.abs(ly);
  if (Math.max(ax, ay) < NAV_THRESHOLD) return null;
  if (ax > ay) return lx > 0 ? 'right' : 'left';
  return ly > 0 ? 'down' : 'up';
}

/**
 * One poll of one pad. Pure: returns the next state and this poll's input.
 *  - axes: left stick (dead-zoned) or D-pad, plus held fire (A / RT)
 *  - taps: edge-triggered (X or RB = weapon, Y or LB = auto, B = dock, Start/Back = pause)
 *  - menu: A = confirm, B = back, direction presses with key-repeat (stick or D-pad)
 */
export function stepGamepad(
  prev: PadState, s: PadSnapshot, now: number,
): { state: PadState; axes: GameAxes; taps: TapKind[]; menu: MenuKind[]; anyButton: boolean } {
  const lx = s.axes[0] ?? 0;
  const ly = s.axes[1] ?? 0;
  let [dx, dy] = applyRadialDeadzone(lx, ly);
  if (dx === 0 && dy === 0) {
    const px = (btn(s, PAD.right) ? 1 : 0) - (btn(s, PAD.left) ? 1 : 0);
    const py = (btn(s, PAD.down) ? 1 : 0) - (btn(s, PAD.up) ? 1 : 0);
    if (px !== 0 || py !== 0) { const m = Math.hypot(px, py); dx = px / m; dy = py / m; }
  }
  const fire = btn(s, PAD.south) || btn(s, PAD.rt);

  const down = s.buttons.map((_, i) => btn(s, i));
  const pressed = (i: number) => !!down[i] && !prev.down[i];
  const taps: TapKind[] = [];
  if (pressed(PAD.west) || pressed(PAD.rb)) taps.push('weapon');
  if (pressed(PAD.north) || pressed(PAD.lb)) taps.push('auto');
  if (pressed(PAD.east)) taps.push('dock');
  if (pressed(PAD.start) || pressed(PAD.back)) taps.push('pause');

  const menu: MenuKind[] = [];
  if (pressed(PAD.south)) menu.push('confirm');
  if (pressed(PAD.east)) menu.push('back');
  const dir = navFromPad(s, lx, ly);
  let navDir = prev.navDir;
  let navNextAt = prev.navNextAt;
  if (dir === null) { navDir = null; navNextAt = 0; }
  else if (dir !== prev.navDir) { menu.push(dir); navDir = dir; navNextAt = now + NAV_REPEAT_FIRST_MS; }
  else if (now >= prev.navNextAt) { menu.push(dir); navNextAt = now + NAV_REPEAT_MS; }

  return {
    state: { down, navDir, navNextAt },
    axes: { dx, dy, fire },
    taps, menu,
    // "deliberate" activity for prompt switching: a button press, not stick noise
    anyButton: down.some((d, i) => d && !prev.down[i]),
  };
}

// --- Device family and prompt style ----------------------------------------

export type PromptStyle = 'xbox' | 'playstation' | 'ps4' | 'switch' | 'keyboard';
export type PromptPref = 'auto' | PromptStyle;
export const PROMPT_PREFS: readonly PromptPref[] = ['auto', 'xbox', 'playstation', 'switch', 'keyboard'];

/**
 * Gamepad.id -> glyph family. Steam Deck / Steam Controller / unknown pads use ABXY
 * (Xbox-style) prompts; they present as an Xbox-layout pad through Steam Input.
 */
export function detectPadStyle(id: string): PromptStyle {
  const s = (id || '').toLowerCase();
  if (/054c|dualsense|dualshock|playstation|ps5|ps4/.test(s)) {
    return /05c4|09cc|dualshock/.test(s) ? 'ps4' : 'playstation';
  }
  if (/057e|nintendo|switch|joy-?con|pro controller/.test(s)) return 'switch';
  return 'xbox';
}

export function resolvePromptStyle(pref: PromptPref, detected: PromptStyle): PromptStyle {
  if (pref === 'auto') return detected;
  return pref === 'playstation' && detected === 'ps4' ? 'ps4' : pref;
}

export type InputDevice = 'keyboard' | 'gamepad';

/**
 * Chooses which prompt family is displayed without flicker. Only DELIBERATE input
 * counts (a key press, a gamepad button press, a mouse CLICK is treated as keyboard/
 * mouse); mouse movement, stick noise and trackpad/gyro-generated pointer motion never
 * switch it. After a switch, further switches are ignored for `holdMs`.
 */
export class PromptTracker {
  private device: InputDevice = 'keyboard';
  private padStyle: PromptStyle = 'xbox';
  private lastSwitchAt = -Infinity;

  constructor(private readonly holdMs = 1500) {}

  /** Report deliberate input. Returns true if the displayed style changed. */
  note(device: InputDevice, padId: string | null, now: number): boolean {
    const style = padId ? detectPadStyle(padId) : this.padStyle;
    const deviceChanged = device !== this.device;
    const styleChanged = device === 'gamepad' && style !== this.padStyle;
    if (!deviceChanged && !styleChanged) return false;
    if (now - this.lastSwitchAt < this.holdMs) return false;
    this.device = device;
    if (device === 'gamepad') this.padStyle = style;
    this.lastSwitchAt = now;
    return true;
  }

  detected(): PromptStyle {
    return this.device === 'keyboard' ? 'keyboard' : this.padStyle;
  }
}

// --- Prompts (action -> what to show) --------------------------------------

export interface PromptSpec {
  /** Glyph file key (see assets/glyphs/manifest.json), or null to show `text` instead. */
  glyph: string | null;
  /** Always present: accessible label and the fallback when a glyph is missing from the pack. */
  text: string;
}

type Table = Partial<Record<ActionName, PromptSpec>>;

// Position-based: the browser's standard mapping reports the BOTTOM face button as
// index 0, which is "A" on Xbox, Cross on PlayStation and "B" on Nintendo hardware.
const XBOX: Table = {
  move: { glyph: 'xbox/T_X_L_2D', text: 'LEFT STICK' },
  fire: { glyph: 'xbox/T_X_A_Color', text: 'A' },
  weapon: { glyph: 'xbox/T_X_X_Color', text: 'X' },
  auto: { glyph: 'xbox/T_X_Y_Color', text: 'Y' },
  dock: { glyph: 'xbox/T_X_B_Color', text: 'B' },
  pause: { glyph: null, text: 'MENU' },            // the pack has no Xbox Start/Menu glyph
  confirm: { glyph: 'xbox/T_X_A_Color', text: 'A' },
  back: { glyph: 'xbox/T_X_B_Color', text: 'B' },
  up: { glyph: 'xbox/T_X_Dpad_Up', text: 'UP' },
  down: { glyph: 'xbox/T_X_Dpad_Down', text: 'DOWN' },
  left: { glyph: 'xbox/T_X_Dpad_Left', text: 'LEFT' },
  right: { glyph: 'xbox/T_X_Dpad_Right', text: 'RIGHT' },
};
const PS = (p: 'ps5' | 'ps4', k: string): Table => ({
  move: { glyph: `${p}/T_${k}_L_2D`, text: 'LEFT STICK' },
  fire: { glyph: `${p}/T_${k}_Cross_Color`, text: 'CROSS' },
  weapon: { glyph: `${p}/T_${k}_Square_Color`, text: 'SQUARE' },
  auto: { glyph: `${p}/T_${k}_Triangle_Color`, text: 'TRIANGLE' },
  dock: { glyph: `${p}/T_${k}_Circle_Color`, text: 'CIRCLE' },
  pause: { glyph: `${p}/T_${k}_Options`, text: 'OPTIONS' },
  confirm: { glyph: `${p}/T_${k}_Cross_Color`, text: 'CROSS' },
  back: { glyph: `${p}/T_${k}_Circle_Color`, text: 'CIRCLE' },
  up: { glyph: `${p}/T_${k}_Dpad_UP`, text: 'UP' },
  down: { glyph: `${p}/T_${k}_Dpad_Down`, text: 'DOWN' },
  left: { glyph: `${p}/T_${k}_Dpad_Left`, text: 'LEFT' },
  right: { glyph: `${p}/T_${k}_Dpad_Right`, text: 'RIGHT' },
});
const SWITCH: Table = {
  move: { glyph: 'switch/T_S_L_2D', text: 'LEFT STICK' },
  fire: { glyph: 'switch/T_S_B', text: 'B' },        // bottom button is labelled B on Nintendo pads
  weapon: { glyph: 'switch/T_S_Y', text: 'Y' },
  auto: { glyph: 'switch/T_S_X', text: 'X' },
  dock: { glyph: 'switch/T_S_A', text: 'A' },
  pause: { glyph: 'switch/T_S_Plus', text: '+' },
  confirm: { glyph: 'switch/T_S_B', text: 'B' },
  back: { glyph: 'switch/T_S_A', text: 'A' },
  up: { glyph: 'switch/T_S_Dpad_Up', text: 'UP' },
  down: { glyph: 'switch/T_S_Dpad_Down', text: 'DOWN' },
  left: { glyph: 'switch/T_S_Dpad_Left', text: 'LEFT' },
  right: { glyph: 'switch/T_S_Dpad_Right', text: 'RIGHT' },
};
const KB: Table = {
  move: { glyph: null, text: 'WASD' },               // no combined WASD glyph exists; shown as keycaps by the UI
  fire: { glyph: 'keyboard/T_Space_Key_White', text: 'SPACE' },
  weapon: { glyph: 'keyboard/T_E_Key_White', text: 'E' },
  auto: { glyph: 'keyboard/T_R_Key_White', text: 'R' },
  dock: { glyph: 'keyboard/T_F_Key_White', text: 'F' },
  pause: { glyph: 'keyboard/T_Esc_Key_White', text: 'ESC' },
  confirm: { glyph: 'keyboard/T_Enter_Key_White', text: 'ENTER' },
  back: { glyph: 'keyboard/T_Esc_Key_White', text: 'ESC' },
  up: { glyph: 'keyboard/T_Up_Key_White', text: 'UP' },
  down: { glyph: 'keyboard/T_Down_Key_White', text: 'DOWN' },
  left: { glyph: 'keyboard/T_Left_Key_White', text: 'LEFT' },
  right: { glyph: 'keyboard/T_Right_Key_White', text: 'RIGHT' },
};

export const PROMPTS: Record<PromptStyle, Table> = {
  xbox: XBOX, playstation: PS('ps5', 'P5'), ps4: PS('ps4', 'P4'), switch: SWITCH, keyboard: KB,
};

export function promptFor(style: PromptStyle, action: ActionName): PromptSpec {
  return PROMPTS[style][action] ?? { glyph: null, text: String(action).toUpperCase() };
}

/** Every glyph key a table can ask for (used to prove the asset pack covers them). */
export function allGlyphKeys(): string[] {
  const keys = new Set<string>();
  for (const t of Object.values(PROMPTS)) for (const p of Object.values(t)) if (p && p.glyph) keys.add(p.glyph);
  return [...keys].sort();
}

/** The gamepad key-hint list for the pause screen / title footer, per style. */
export const GAMEPLAY_HINTS: readonly { action: ActionName; label: string }[] = [
  { action: 'move', label: 'MOVE' },
  { action: 'fire', label: 'FIRE' },
  { action: 'weapon', label: 'WEAPON' },
  { action: 'auto', label: 'AUTO' },
  { action: 'dock', label: 'DOCK' },
  { action: 'pause', label: 'PAUSE' },
];
