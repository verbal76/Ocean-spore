import { useSyncExternalStore } from 'react';
import { DeviceState, deviceStore } from '../input/deviceStore';

/** Subscribe a component to the desktop device/prompt state. */
export function useDeviceState(): DeviceState {
  return useSyncExternalStore(deviceStore.subscribe, deviceStore.get, deviceStore.get);
}
