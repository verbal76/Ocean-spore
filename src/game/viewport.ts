// Desktop landscape framing. Pure.
//
// The simulation was tuned against a portrait phone: enemies spawn 480 world units
// (400 for bosses) from the player, i.e. just outside a view that reaches at most
// ~430 units from the player (a 412x860 dp screen shows +/-430 vertically). A wide
// desktop window drawn at the same scale would show +/-640 units sideways, so spawns
// would pop in ON screen and the field would feel easier/different. Instead the
// desktop camera is zoomed so the LONGER side of the window never shows more than a
// portrait phone's longer side does: same spawn-off-screen guarantee, same sense of
// threat range, and ships/bullets simply render larger on big windows.
//
// Android keeps scale 1 (this is only used on the desktop/web target).

export const REFERENCE_VIEW_EXTENT = 860;   // world units across the portrait phone's longer side

export function desktopViewScale(width: number, height: number): number {
  const longSide = Math.max(width, height);
  if (!Number.isFinite(longSide) || longSide <= 0) return 1;
  return Math.max(1, longSide / REFERENCE_VIEW_EXTENT);
}
