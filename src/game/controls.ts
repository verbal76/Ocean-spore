// Pure touch-control logic: layout geometry + a multi-touch controller.
//
// The controller is rebuilt from the AUTHORITATIVE list of fingers currently
// on the screen on every event (start, move, end, release, cancel). A finger
// that is no longer in that list is released immediately, so a control can
// never stay latched because an "end" event was missed (React Native reports a
// partial finger-lift as onResponderEnd, not onResponderRelease).
//
// No React / React Native imports: unit-tested without a device.

export const METRICS = {
  JOY_BOTTOM: 28,
  JOY_LEFT: 22,
  JOY_SIZE: 130,
  FIRE_BOTTOM: 28,
  FIRE_RIGHT: 22,
  FIRE_SIZE: 100,
  SMALLBTN_W: 70,
  SMALLBTN_H: 36,
  SMALLBTN_GAP: 8,
  SMALL_FIRE_GAP: 10,
  PAUSE_TOP: 180,
  PAUSE_RIGHT: 12,
  PAUSE_W: 110,
  PAUSE_H: 38,
  DOCK_W: 220,
  DOCK_H: 70,
  /** Extra touch slop around round controls / small buttons (dp). */
  SLOP_ROUND: 36,
  SLOP_SMALL: 28,
} as const;

export type ControlKind = 'joystick' | 'fire' | 'auto' | 'weapon' | 'pause' | 'dock';
export type TapAction = 'auto' | 'weapon' | 'pause' | 'dock';

export interface Circle { cx: number; cy: number; radius: number }
export interface Box { cx: number; cy: number; w: number; h: number }

export interface ControlLayout {
  joystick: Circle;
  fire: Circle;
  auto: Box;
  weapon: Box;
  pause: Box;
  /** Only hit-testable while a harbor is in range. */
  dock: Box;
}

export interface Insets { top: number; bottom: number }

/** Where every control sits for a given view size and system insets. */
export function buildLayout(width: number, height: number, insets: Insets): ControlLayout {
  const m = METRICS;
  const joyBottom = m.JOY_BOTTOM + insets.bottom;
  const fireBottom = m.FIRE_BOTTOM + insets.bottom;
  const pauseTop = m.PAUSE_TOP + insets.top;
  // The right-hand cluster is a column whose width is the wider of the two
  // rows (AUTO+WEAPON, or FIRE); FIRE and the small-button row are centred in
  // it. The drawn controls are positioned from THESE numbers, so what the
  // player sees is exactly what a touch hits.
  const clusterW = Math.max(2 * m.SMALLBTN_W + m.SMALLBTN_GAP, m.FIRE_SIZE);
  const fireCx = width - m.FIRE_RIGHT - clusterW / 2;
  const smallCy = height - fireBottom - m.FIRE_SIZE - m.SMALL_FIRE_GAP - m.SMALLBTN_H / 2;
  return {
    joystick: { cx: m.JOY_LEFT + m.JOY_SIZE / 2, cy: height - joyBottom - m.JOY_SIZE / 2, radius: m.JOY_SIZE / 2 },
    fire: { cx: fireCx, cy: height - fireBottom - m.FIRE_SIZE / 2, radius: m.FIRE_SIZE / 2 },
    auto: { cx: fireCx - (m.SMALLBTN_W + m.SMALLBTN_GAP) / 2, cy: smallCy, w: m.SMALLBTN_W, h: m.SMALLBTN_H },
    weapon: { cx: fireCx + (m.SMALLBTN_W + m.SMALLBTN_GAP) / 2, cy: smallCy, w: m.SMALLBTN_W, h: m.SMALLBTN_H },
    pause: { cx: width - m.PAUSE_RIGHT - m.PAUSE_W / 2, cy: pauseTop + m.PAUSE_H / 2, w: m.PAUSE_W, h: m.PAUSE_H },
    dock: { cx: width / 2, cy: height * 0.4 + 30, w: m.DOCK_W, h: m.DOCK_H },
  };
}

const inCircle = (x: number, y: number, c: Circle, slop: number) =>
  Math.hypot(x - c.cx, y - c.cy) <= c.radius + slop;
const inBox = (x: number, y: number, b: Box, slop: number) =>
  Math.abs(x - b.cx) <= b.w / 2 + slop && Math.abs(y - b.cy) <= b.h / 2 + slop;

/** Which control (if any) a new touch at (x, y) lands on. Order = priority. */
export function classify(
  x: number, y: number, layout: ControlLayout, harborInRange: boolean,
): ControlKind | null {
  const m = METRICS;
  if (inCircle(x, y, layout.joystick, m.SLOP_ROUND)) return 'joystick';
  if (inCircle(x, y, layout.fire, m.SLOP_ROUND)) return 'fire';
  if (harborInRange && inBox(x, y, layout.dock, m.SLOP_ROUND)) return 'dock';
  if (inBox(x, y, layout.pause, m.SLOP_ROUND)) return 'pause';
  if (inBox(x, y, layout.auto, m.SLOP_SMALL)) return 'auto';
  if (inBox(x, y, layout.weapon, m.SLOP_SMALL)) return 'weapon';
  return null;
}

export interface TouchPoint { id: number | string; x: number; y: number }

export interface ControlState {
  /** Joystick deflection, each axis in [-1, 1], radius-clamped. */
  dx: number;
  dy: number;
  /** Knob offset in dp from the joystick centre, for drawing. */
  knobX: number;
  knobY: number;
  fire: boolean;
}

export const NEUTRAL: ControlState = { dx: 0, dy: 0, knobX: 0, knobY: 0, fire: false };

type Claim = { kind: ControlKind } | { kind: 'ignored' };

export class TouchController {
  private layout: ControlLayout;
  private harborInRange = false;
  private readonly claims = new Map<number | string, Claim>();
  private taps: TapAction[] = [];

  constructor(layout: ControlLayout) {
    this.layout = layout;
  }

  /**
   * Taps (AUTO / WEAPON / PAUSE / DOCK) registered by the last sync(), cleared
   * on read. The host must apply the returned ControlState FIRST and run the
   * taps afterwards: a tap such as PAUSE calls releaseAll(), and running it
   * mid-sync would let the stale state computed in the same pass overwrite it.
   */
  takeTaps(): TapAction[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }

  setLayout(layout: ControlLayout) { this.layout = layout; }
  setHarborInRange(inRange: boolean) { this.harborInRange = inRange; }

  /** Drop every claim (pause, dock, background, unmount). */
  releaseAll(): ControlState {
    this.claims.clear();
    this.taps = [];
    return { ...NEUTRAL };
  }

  /**
   * Reconcile with the fingers currently down. Call on every touch event with
   * the full `touches` list (not `changedTouches`).
   */
  sync(points: readonly TouchPoint[]): ControlState {
    const present = new Set(points.map((p) => p.id));
    for (const id of Array.from(this.claims.keys())) {
      if (!present.has(id)) this.claims.delete(id);       // finger lifted / cancelled
    }

    let joystickPoint: TouchPoint | null = null;
    let fire = false;

    for (const p of points) {
      let claim = this.claims.get(p.id);
      if (!claim) {
        const kind = classify(p.x, p.y, this.layout, this.harborInRange);
        if (kind === 'joystick' && this.holds('joystick')) {
          claim = { kind: 'ignored' };                     // one finger per stick
        } else if (kind) {
          claim = { kind };
          if (kind !== 'joystick' && kind !== 'fire') this.taps.push(kind);   // tap on touch-down
        } else {
          claim = { kind: 'ignored' };                     // started outside any control
        }
        this.claims.set(p.id, claim);
      }
      // A finger keeps the control it started on even if it drags elsewhere.
      if (claim.kind === 'joystick') joystickPoint = p;
      else if (claim.kind === 'fire') fire = true;
    }

    if (!joystickPoint) return { ...NEUTRAL, fire };
    const j = this.layout.joystick;
    const dx = joystickPoint.x - j.cx;
    const dy = joystickPoint.y - j.cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, j.radius);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    return {
      dx: nx * (clamped / j.radius),
      dy: ny * (clamped / j.radius),
      knobX: nx * clamped,
      knobY: ny * clamped,
      fire,
    };
  }

  private holds(kind: ControlKind): boolean {
    for (const c of this.claims.values()) if (c.kind === kind) return true;
    return false;
  }
}
