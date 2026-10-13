import type { SoundId } from './sounds';

// Static require() table: Metro only bundles assets it can see statically.
export const SOUND_ASSETS: Record<SoundId, number> = {
  fire: require('../../assets/audio/fire.wav'),
  hit: require('../../assets/audio/hit.wav'),
  explode: require('../../assets/audio/explode.wav'),
  explodeBoss: require('../../assets/audio/explode_boss.wav'),
  ram: require('../../assets/audio/ram.wav'),
  damage: require('../../assets/audio/damage.wav'),
  boss: require('../../assets/audio/boss.wav'),
  pickup: require('../../assets/audio/pickup.wav'),
  crate: require('../../assets/audio/crate.wav'),
  unlock: require('../../assets/audio/unlock.wav'),
  storm: require('../../assets/audio/storm.wav'),
  dock: require('../../assets/audio/dock.wav'),
  undock: require('../../assets/audio/undock.wav'),
  tap: require('../../assets/audio/tap.wav'),
  gameover: require('../../assets/audio/gameover.wav'),
  ambient: require('../../assets/audio/ambient.wav'),
};
