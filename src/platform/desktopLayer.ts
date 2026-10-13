// Default (Android) build: the desktop input / focus / diagnostics layer does not
// exist. The matching desktopLayer.web.ts is bundled only for the desktop target.
import type { DesktopStatus, GameSink } from '../input/inputBus';

export function startDesktopLayer(): () => void { return () => undefined; }
/** Register the current screen's "back / cancel" action (no-op on Android, which has the system Back). */
export function useDesktopBack(_handler: (() => void) | null): void { /* no-op */ }
export function reportStatus(_patch: Partial<DesktopStatus>): void { /* no-op */ }
export interface TextEntryHandlers { onKey(ch: string): void; onBackspace(): void; onSpace(): void; onDone(): void }
/** Route physical-keyboard typing to a text field (desktop only; no-op on Android). */
export function useDesktopTextEntry(_handlers: TextEntryHandlers | null): void { /* no-op */ }
/** Hand the mounted game to the desktop input layer (no-op on Android). */
export function registerGameSink(_sink: GameSink | null): void { /* no-op */ }
/** Cycle the manual button-prompt style (no-op on Android). */
export function cyclePromptPref(): void { /* no-op */ }
export function toggleFullscreen(): void { /* no-op */ }
