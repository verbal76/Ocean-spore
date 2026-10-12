import type { DeviceState } from '../input/deviceStore';

// Android: there is no desktop device state; a constant keeps shared screens simple
// (touch controls shown, no prompts) without bundling any desktop input code.
const ANDROID: DeviceState = { detected: 'keyboard', pref: 'auto', style: 'keyboard', touchSeen: true, padConnected: false };

export function useDeviceState(): DeviceState {
  return ANDROID;
}
