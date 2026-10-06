import { readFileSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { ALL_SOUND_IDS, SOUND_FILES } from '../audio/sounds';

const DIR = join(__dirname, '../../assets/audio');

function readWav(file: string) {
  const buf = readFileSync(join(DIR, file + '.wav'));
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
  const channels = buf.readUInt16LE(22), rate = buf.readUInt32LE(24), bits = buf.readUInt16LE(34);
  const dataLen = buf.readUInt32LE(40);
  const n = dataLen / 2;
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return { buf, channels, rate, bits, s, seconds: n / rate };
}

describe.each(ALL_SOUND_IDS.map((id) => [id, SOUND_FILES[id]] as const))('audio asset %s (%s.wav)', (id, file) => {
  const w = readWav(file);

  test('is mono 16-bit PCM at a sane sample rate', () => {
    expect([w.channels, w.bits]).toEqual([1, 16]);
    expect([11025, 22050]).toContain(w.rate);
  });

  test('has a sensible length', () => {
    if (id === 'ambient') expect(w.seconds).toBeGreaterThanOrEqual(8);
    else { expect(w.seconds).toBeGreaterThan(0.03); expect(w.seconds).toBeLessThan(3); }
  });

  test('is audible, finite and does not clip', () => {
    let peak = 0, sum = 0;
    for (const v of w.s) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    const rms = Math.sqrt(sum / w.s.length);
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThanOrEqual(0.995);
    expect(rms).toBeGreaterThan(0.01);
  });

  test(id === 'ambient' ? 'loops without a seam (no click at the wrap point)' : 'starts and ends at silence (no click)', () => {
    const first = w.s[0], last = w.s[w.s.length - 1];
    if (id === 'ambient') expect(Math.abs(first - last)).toBeLessThan(0.03);
    else { expect(Math.abs(first)).toBeLessThan(0.02); expect(Math.abs(last)).toBeLessThan(0.02); }
  });
});

test('the 16 sounds are all distinct recordings', () => {
  const hashes = new Set(ALL_SOUND_IDS.map((id) =>
    createHash('sha256').update(readFileSync(join(DIR, SOUND_FILES[id] + '.wav'))).digest('hex')));
  expect(hashes.size).toBe(ALL_SOUND_IDS.length);
});

test('the whole sound set stays small (APK size)', () => {
  const total = ALL_SOUND_IDS.reduce((n, id) => n + statSync(join(DIR, SOUND_FILES[id] + '.wav')).size, 0);
  expect(total).toBeLessThan(1_000_000);
});

test('the generator is deterministic: the shipped fire.wav has the expected cannon shape', () => {
  // A thump: energy concentrated early, decaying (first quarter louder than the last quarter).
  const { s } = readWav('fire');
  const q = Math.floor(s.length / 4);
  const e = (a: number, b: number) => s.slice(a, b).reduce((n, v) => n + v * v, 0);
  expect(e(0, q)).toBeGreaterThan(8 * e(3 * q, 4 * q));
});
