// Typed view of the desktop shell's preload bridge (desktop/preload.js). Only the
// .web modules use it; the default (Android) build never touches it.
export interface HotAtticBridge {
  isDesktop: true;
  platform: string;
  loadSaveCandidates(): Promise<(string | null)[]>;
  quarantineSave(): Promise<void>;
  writeSave(text: string): Promise<void>;
  clearSave(): Promise<void>;
  readPrefs(): Promise<Record<string, unknown>>;
  updatePrefs(patch: Record<string, unknown>): Promise<Record<string, unknown>>;
  setFullscreen(on: boolean): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  quit(): Promise<void>;
  info(): Promise<{ platform: string; arch: string; electron: string; chrome: string; packaged: boolean }>;
}

export function getBridge(): HotAtticBridge | null {
  const g = globalThis as unknown as { hotAttic?: HotAtticBridge };
  return g.hotAttic && g.hotAttic.isDesktop ? g.hotAttic : null;
}
