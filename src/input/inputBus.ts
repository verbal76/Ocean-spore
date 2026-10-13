// Tiny registry connecting the mounted game and the app shell to the desktop input
// layer without the input code importing React. Pure state; no platform imports.
import type { GameAxes, TapKind } from './inputActions';

/** playing: gameplay input; paused: pause-menu navigation (+ resume); blocked: harbor / loading. */
export type GameMode = 'playing' | 'paused' | 'blocked';

export interface GameSink {
  mode(): GameMode;
  /** Replace the held movement/fire input (called every frame while playing). */
  setAxes(a: GameAxes): void;
  /** A one-shot gameplay action (auto / weapon / pause / dock). */
  tap(kind: TapKind): void;
}

let game: GameSink | null = null;
let back: (() => void) | null = null;

export function setGameSink(sink: GameSink | null): void { game = sink; }
export function getGameSink(): GameSink | null { return game; }
/** The current screen's "go back / cancel" action (null when the screen has none). */
export function setBackHandler(fn: (() => void) | null): void { back = fn; }
export function getBackHandler(): (() => void) | null { return back; }

/** While a text field is being typed into, letters are text, not menu navigation. */
let textEntry = false;
export function setTextEntry(on: boolean): void { textEntry = on; }
export function isTextEntry(): boolean { return textEntry; }

/** Read-only diagnostics used by the automated desktop smoke test. */
export interface DesktopStatus { screen: string; paused: boolean; simSeconds: number }
const status: DesktopStatus = { screen: 'boot', paused: false, simSeconds: 0 };
export function reportStatus(patch: Partial<DesktopStatus>): void { Object.assign(status, patch); }
export function readStatus(): DesktopStatus { return { ...status }; }
