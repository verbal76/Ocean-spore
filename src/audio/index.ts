import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AudioManager, PlayerLike } from './AudioManager';
import { SOUND_ASSETS } from './soundAssets';

// The app's single AudioManager, backed by expo-audio. Lazy: nothing touches
// the native audio stack until the first sound is requested.

let manager: AudioManager | null = null;

export function getAudio(): AudioManager {
  if (manager) return manager;
  // Short effects only: mix with whatever the player is listening to, play
  // with the ringer off like most games, never record, never in the background.
  setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
    allowsRecording: false,
  }).catch(() => {});
  manager = new AudioManager((source) => createAudioPlayer(source) as unknown as PlayerLike, SOUND_ASSETS);
  return manager;
}

export function disposeAudio() {
  manager?.dispose();
  manager = null;
}
