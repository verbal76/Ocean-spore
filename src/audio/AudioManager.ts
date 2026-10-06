import type { GameEventKind } from '../game/world';
import { SOUND_CONFIG, SoundConfig, SoundId } from './sounds';

// Audio policy, with no native imports so it is unit-tested without a device:
// voice pooling, per-sound throttling, an ambient loop, suspend/resume for
// pause / harbor / background, a mute switch, and one hard rule: audio problems
// must NEVER break gameplay (every player call is guarded; a sound that fails
// is disabled, the rest keep working).

export interface PlayerLike {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void | Promise<void>;
  remove(): void;
  volume: number;
  loop: boolean;
}

export type PlayerFactory = (source: number) => PlayerLike;

interface Voice { player: PlayerLike }
interface Pool { voices: Voice[]; next: number; lastPlayed: number }

export class AudioManager {
  private readonly pools = new Map<SoundId, Pool>();
  private readonly broken = new Set<SoundId>();
  private enabled = true;
  private suspended = false;
  private ambientWanted = false;
  private ambientPlaying = false;
  private master = 1;
  private warned = false;
  /** Count of swallowed audio errors, for diagnostics and tests. */
  failures = 0;

  constructor(
    private readonly factory: PlayerFactory,
    private readonly assets: Record<SoundId, number>,
    private readonly now: () => number = () => Date.now(),
    private readonly config: Record<SoundId, SoundConfig> = SOUND_CONFIG,
  ) {}

  isEnabled() { return this.enabled; }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.syncAmbient();
  }

  setMasterVolume(v: number) {
    this.master = Math.max(0, Math.min(1, v));
    const amb = this.pools.get('ambient')?.voices[0]?.player;
    if (amb) this.guard('ambient', () => { amb.volume = this.config.ambient.volume * this.master; });
  }

  /** Pause / harbor / background: silence everything and drop requests until resumed. */
  setSuspended(on: boolean) {
    this.suspended = on;
    this.syncAmbient();
  }

  startAmbient() { this.ambientWanted = true; this.syncAmbient(); }
  stopAmbient() { this.ambientWanted = false; this.syncAmbient(); }

  play(id: SoundId) {
    if (!this.enabled || this.suspended || this.broken.has(id) || id === 'ambient') return;
    const cfg = this.config[id];
    const pool = this.pool(id);
    if (!pool) return;
    const t = this.now();
    if (t - pool.lastPlayed < cfg.minGapMs) return;                 // throttle
    pool.lastPlayed = t;
    const voice = pool.voices[pool.next++ % pool.voices.length];    // round-robin
    this.guard(id, () => {
      voice.player.volume = cfg.volume * this.master;
      void voice.player.seekTo(0);
      voice.player.play();
    });
  }

  /** Map the sim's events to sounds. */
  playEvents(events: readonly GameEventKind[]) {
    for (const e of events) this.play(e);
  }

  /** Release every native player (unmount / app teardown). */
  dispose() {
    for (const [id, pool] of this.pools) {
      for (const v of pool.voices) this.guard(id, () => { v.player.pause(); v.player.remove(); });
    }
    this.pools.clear();
    this.ambientPlaying = false;
    this.ambientWanted = false;
  }

  // -------------------------------------------------------------------------

  private syncAmbient() {
    const shouldPlay = this.ambientWanted && this.enabled && !this.suspended;
    const pool = shouldPlay || this.ambientPlaying ? this.pool('ambient') : undefined;
    const p = pool?.voices[0]?.player;
    if (!p) return;
    if (shouldPlay && !this.ambientPlaying) {
      this.guard('ambient', () => { p.loop = true; p.volume = this.config.ambient.volume * this.master; p.play(); });
      this.ambientPlaying = !this.broken.has('ambient');
    } else if (!shouldPlay && this.ambientPlaying) {
      this.guard('ambient', () => p.pause());
      this.ambientPlaying = false;
    }
  }

  private pool(id: SoundId): Pool | undefined {
    let pool = this.pools.get(id);
    if (pool) return pool;
    try {
      const n = Math.max(1, this.config[id].voices);
      const voices: Voice[] = [];
      for (let i = 0; i < n; i++) voices.push({ player: this.factory(this.assets[id]) });
      pool = { voices, next: 0, lastPlayed: -Infinity };
      this.pools.set(id, pool);
      return pool;
    } catch (err) {
      this.fail(id, err);
      return undefined;
    }
  }

  private guard(id: SoundId, fn: () => void) {
    try { fn(); } catch (err) { this.fail(id, err); }
  }

  private fail(id: SoundId, err: unknown) {
    this.failures++;
    this.broken.add(id);
    if (!this.warned) {
      this.warned = true;
      console.warn('[audio] disabled a sound after an error:', id, err);
    }
  }
}
