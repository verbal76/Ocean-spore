// Observable device/prompt state (which prompt family to show, whether a touch
// screen has been used). Pure; React subscribes through useSyncExternalStore.
import { PromptPref, PromptStyle, resolvePromptStyle } from './inputActions';

export interface DeviceState {
  /** What the input layer currently detects (keyboard or the active pad's family). */
  detected: PromptStyle;
  /** The player's manual choice ('auto' = follow detection). */
  pref: PromptPref;
  /** The style actually shown. */
  style: PromptStyle;
  /** A real touch screen has been used (show on-screen touch controls). */
  touchSeen: boolean;
  padConnected: boolean;
}

let state: DeviceState = { detected: 'keyboard', pref: 'auto', style: 'keyboard', touchSeen: false, padConnected: false };
const listeners = new Set<() => void>();

function set(patch: Partial<DeviceState>): void {
  const next = { ...state, ...patch };
  next.style = resolvePromptStyle(next.pref, next.detected);
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  listeners.forEach((l) => l());
}

export const deviceStore = {
  get: (): DeviceState => state,
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  setDetected: (detected: PromptStyle) => set({ detected }),
  setPref: (pref: PromptPref) => set({ pref }),
  setTouchSeen: (touchSeen: boolean) => set({ touchSeen }),
  setPadConnected: (padConnected: boolean) => set({ padConnected }),
  /** tests */
  reset(): void { state = { detected: 'keyboard', pref: 'auto', style: 'keyboard', touchSeen: false, padConnected: false }; listeners.clear(); },
};
