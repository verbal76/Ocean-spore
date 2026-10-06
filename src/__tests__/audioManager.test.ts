import { AudioManager, PlayerLike } from '../audio/AudioManager';
import { ALL_SOUND_IDS, SOUND_CONFIG, SOUND_FILES, SoundId } from '../audio/sounds';
import { SOUND_ASSETS } from '../audio/soundAssets';

class FakePlayer implements PlayerLike {
  volume = 1; loop = false; plays = 0; pauses = 0; seeks: number[] = []; removed = false;
  constructor(public source: number) {}
  play() { this.plays++; }
  pause() { this.pauses++; }
  seekTo(s: number) { this.seeks.push(s); }
  remove() { this.removed = true; }
}

function setup(over: { throwOn?: SoundId; playThrows?: boolean } = {}) {
  const created: FakePlayer[] = [];
  let t = 1000;
  const assets = Object.fromEntries(ALL_SOUND_IDS.map((id, i) => [id, i + 1])) as Record<SoundId, number>;
  const bySource = (id: SoundId) => created.filter((p) => p.source === assets[id]);
  const m = new AudioManager((src) => {
    if (over.throwOn && src === assets[over.throwOn]) throw new Error('decode failed');
    const p = new FakePlayer(src);
    if (over.playThrows) p.play = () => { throw new Error('audio session lost'); };
    created.push(p);
    return p;
  }, assets, () => t);
  return { m, created, bySource, advance: (ms: number) => { t += ms; } };
}

beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('registry', () => {
  test('every sound has config and a real asset file name', () => {
    for (const id of ALL_SOUND_IDS) {
      expect(SOUND_CONFIG[id].voices).toBeGreaterThanOrEqual(1);
      expect(SOUND_CONFIG[id].volume).toBeGreaterThan(0);
      expect(SOUND_CONFIG[id].volume).toBeLessThanOrEqual(1);
      expect(SOUND_FILES[id]).toMatch(/^[a-z_]+$/);
      expect(SOUND_ASSETS[id]).toBeDefined();
    }
  });
});

describe('playing', () => {
  test('nothing touches the audio stack until a sound is requested (cheap startup)', () => {
    const { created } = setup();
    expect(created).toHaveLength(0);
  });

  test('plays from the start at the configured volume, creating the pool lazily', () => {
    const { m, bySource, advance } = setup();
    m.play('fire');
    const voices = bySource('fire');
    expect(voices).toHaveLength(SOUND_CONFIG.fire.voices);
    expect(voices[0].plays).toBe(1);
    expect(voices[0].seeks).toEqual([0]);
    expect(voices[0].volume).toBeCloseTo(SOUND_CONFIG.fire.volume);
    advance(500);
    m.play('fire');
    expect(bySource('fire')).toHaveLength(SOUND_CONFIG.fire.voices);   // pool reused, not regrown
  });

  test('throttles a sound requested faster than its minimum gap', () => {
    const { m, bySource, advance } = setup();
    m.play('hit'); advance(10); m.play('hit'); advance(10); m.play('hit');
    expect(bySource('hit').reduce((n, p) => n + p.plays, 0)).toBe(1);
    advance(SOUND_CONFIG.hit.minGapMs);
    m.play('hit');
    expect(bySource('hit').reduce((n, p) => n + p.plays, 0)).toBe(2);
  });

  test('overlapping plays rotate round-robin across the voices', () => {
    const { m, bySource, advance } = setup();
    for (let i = 0; i < 6; i++) { m.play('explode'); advance(SOUND_CONFIG.explode.minGapMs + 1); }
    const counts = bySource('explode').map((p) => p.plays);
    expect(counts).toEqual([2, 2, 2]);
  });

  test('playEvents maps sim events to sounds (incl. the boss explosion)', () => {
    const { m, bySource } = setup();
    m.playEvents(['fire', 'explodeBoss', 'dock']);
    expect(bySource('fire')[0].plays).toBe(1);
    expect(bySource('explodeBoss')[0].plays).toBe(1);
    expect(bySource('dock')[0].plays).toBe(1);
  });

  test('master volume scales every sound', () => {
    const { m, bySource } = setup();
    m.setMasterVolume(0.5);
    m.play('boss');
    expect(bySource('boss')[0].volume).toBeCloseTo(SOUND_CONFIG.boss.volume * 0.5);
  });
});

describe('mute, pause, background', () => {
  test('disabled (mute setting): nothing plays; re-enabling works', () => {
    const { m, bySource } = setup();
    m.setEnabled(false);
    m.play('fire');
    expect(bySource('fire')).toHaveLength(0);
    m.setEnabled(true);
    m.play('fire');
    expect(bySource('fire')[0].plays).toBe(1);
  });

  test('suspended (pause / harbor / background): requests are dropped until resumed', () => {
    const { m, bySource, advance } = setup();
    m.setSuspended(true);
    m.play('fire');
    expect(bySource('fire')).toHaveLength(0);
    m.setSuspended(false); advance(1000);
    m.play('fire');
    expect(bySource('fire')[0].plays).toBe(1);
  });

  test('ambient loops quietly, pauses on suspend, resumes after, stops on mute', () => {
    const { m, bySource } = setup();
    m.startAmbient();
    const amb = bySource('ambient')[0];
    expect(amb.loop).toBe(true);
    expect(amb.plays).toBe(1);
    expect(amb.volume).toBeCloseTo(SOUND_CONFIG.ambient.volume);
    m.setSuspended(true);
    expect(amb.pauses).toBe(1);
    m.setSuspended(false);
    expect(amb.plays).toBe(2);
    m.setEnabled(false);
    expect(amb.pauses).toBe(2);
    m.setEnabled(true);
    expect(amb.plays).toBe(3);                                     // wanted ambient comes back
    m.stopAmbient();
    expect(amb.pauses).toBe(3);
  });

  test('ambient requested while muted stays silent until unmuted', () => {
    const { m, bySource } = setup();
    m.setEnabled(false);
    m.startAmbient();
    expect(bySource('ambient')).toHaveLength(0);
    m.setEnabled(true);
    expect(bySource('ambient')[0].plays).toBe(1);
  });

  test('"ambient" cannot be fired as a one-shot', () => {
    const { m, bySource } = setup();
    m.play('ambient');
    expect(bySource('ambient')).toHaveLength(0);
  });
});

describe('audio can never break gameplay', () => {
  test('a sound that cannot be created is disabled; every other sound still plays', () => {
    const { m, bySource } = setup({ throwOn: 'boss' });
    expect(() => m.play('boss')).not.toThrow();
    m.play('fire');
    expect(bySource('fire')[0].plays).toBe(1);
    expect(m.failures).toBe(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    m.play('boss');                                                // not retried on every request
    expect(m.failures).toBe(1);
  });

  test('a player that throws on play() (audio session lost) is swallowed and disabled', () => {
    const { m } = setup({ playThrows: true });
    expect(() => { m.play('fire'); m.play('hit'); m.startAmbient(); }).not.toThrow();
    expect(m.failures).toBeGreaterThan(0);
  });

  test('dispose releases every native player and the manager can be reused', () => {
    const { m, created, advance } = setup();
    m.play('fire'); m.play('hit'); m.startAmbient();
    m.dispose();
    expect(created.every((p) => p.removed)).toBe(true);
    advance(1000);
    expect(() => m.play('fire')).not.toThrow();
  });
});
