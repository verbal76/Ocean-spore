// Spatial menu navigation for controller / keyboard use on desktop. Pure geometry:
// given the on-screen rectangles of the focusable controls, pick the neighbour in a
// direction. (The DOM side that collects rectangles and moves focus is in
// src/platform/desktopLayer.web.ts.) No React, no DOM.
import type { NavDir } from './inputActions';

export interface Rect { left: number; top: number; width: number; height: number }

const cx = (r: Rect) => r.left + r.width / 2;
const cy = (r: Rect) => r.top + r.height / 2;

/**
 * Index of the best control to move to from `from` in `dir`, or -1 when there is
 * none in that direction. Candidates must lie (at least partly) in the half-plane
 * of the direction; nearest along the axis wins, with cross-axis distance weighted
 * more heavily so a grid moves along rows/columns instead of jumping diagonally.
 */
export function pickNext(rects: readonly Rect[], from: number, dir: NavDir): number {
  const a = rects[from];
  if (!a) return -1;
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    if (i === from) continue;
    const b = rects[i];
    const along = horizontal ? (cx(b) - cx(a)) * sign : (cy(b) - cy(a)) * sign;
    if (along <= 1) continue;                                   // not in that direction
    const across = Math.abs(horizontal ? cy(b) - cy(a) : cx(b) - cx(a));
    // Overlap on the cross axis => same row/column: strongly preferred.
    const overlap = horizontal
      ? Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
      : Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
    const score = along + across * (overlap > 0 ? 1 : 4);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/** First control to focus when nothing is focused: top-most, then left-most. */
export function pickInitial(rects: readonly Rect[]): number {
  let best = -1;
  for (let i = 0; i < rects.length; i++) {
    if (best < 0) { best = i; continue; }
    const a = rects[i];
    const b = rects[best];
    if (a.top < b.top - 4 || (Math.abs(a.top - b.top) <= 4 && a.left < b.left)) best = i;
  }
  return best;
}
