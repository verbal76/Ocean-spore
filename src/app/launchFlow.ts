import type { GameScreen } from '../game/types';

// Launch sequence: native dark background -> Hot Attic Games card -> Ocean
// Spore title -> game. The studio card belongs to a COLD launch only: it is
// never replayed after the app returns from the background (state survives in
// memory) nor after a recovered crash.

export const FIRST_SCREEN: GameScreen = 'brand';
export const SCREEN_AFTER_BRAND: GameScreen = 'splash';

/** Which screen the app mounts on: the studio card only before any recovery. */
export function initialScreen(recoveries: number): GameScreen {
  return recoveries === 0 ? FIRST_SCREEN : SCREEN_AFTER_BRAND;
}

export const BRAND_SPLASH_TIMING = { fadeInMs: 450, holdMs: 1100, fadeOutMs: 350 } as const;
export const BRAND_SPLASH_TOTAL_MS =
  BRAND_SPLASH_TIMING.fadeInMs + BRAND_SPLASH_TIMING.holdMs + BRAND_SPLASH_TIMING.fadeOutMs;
