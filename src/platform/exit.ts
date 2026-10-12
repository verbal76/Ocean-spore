import { BackHandler } from 'react-native';

/** Close the app (Android: same call the game always made). */
export function exitApp(): void {
  try { BackHandler.exitApp(); } catch { /* no-op where unsupported */ }
}
