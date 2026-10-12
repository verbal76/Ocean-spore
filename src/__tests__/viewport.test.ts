import { desktopViewScale, REFERENCE_VIEW_EXTENT } from '../game/viewport';

describe('desktop landscape framing (Android is never scaled)', () => {
  test('a portrait phone-sized window is scale 1: identical framing to Android', () => {
    expect(desktopViewScale(412, 860)).toBe(1);
    expect(desktopViewScale(360, 780)).toBe(1);
  });
  test('the longer side never shows more world than the reference phone does', () => {
    for (const [w, h] of [[1280, 800], [1920, 1080], [2560, 1440], [1280, 720], [3440, 1440], [800, 1280]] as const) {
      const s = desktopViewScale(w, h);
      expect(Math.max(w, h) / s).toBeLessThanOrEqual(REFERENCE_VIEW_EXTENT + 1e-9);
      expect(s).toBeGreaterThanOrEqual(1);
    }
  });
  test('enemies spawn 480 units out; the desktop view never reaches that far from the player at base zoom', () => {
    for (const [w, h] of [[1280, 800], [1920, 1080], [3440, 1440]] as const) {
      const s = desktopViewScale(w, h);
      expect(Math.max(w, h) / s / 2).toBeLessThan(480);
    }
  });
  test('1280x800 (Steam Deck) value and monotonic growth with window size', () => {
    expect(desktopViewScale(1280, 800)).toBeCloseTo(1280 / 860, 10);
    expect(desktopViewScale(1920, 1080)).toBeGreaterThan(desktopViewScale(1280, 800));
  });
  test('garbage sizes fall back to 1', () => {
    expect(desktopViewScale(0, 0)).toBe(1);
    expect(desktopViewScale(NaN, 100)).toBe(1);
  });
});
