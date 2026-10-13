import { Platform } from 'react-native';

/**
 * True on the desktop target (the Expo web export hosted by the Electron shell).
 * Android is false, so every desktop-only branch is inert there.
 */
export const DESKTOP = Platform.OS === 'web';
