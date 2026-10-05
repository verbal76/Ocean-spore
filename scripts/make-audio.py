#!/usr/bin/env python3
"""Generates Ocean Spore's sound effects from code: original, deterministic, no
third-party audio, no licences to track.   python3 scripts/make-audio.py

Output: assets/audio/*.wav  (mono, 16-bit PCM). Pure standard library.
Design-doc intent: cannon impacts, engine rumble, water splashes, escalating
energy. Music is intentionally NOT generated here (see docs/AUDIO.md).
"""
import math, os, random, struct, wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
TAU = 2 * math.pi


def n_samples(d, sr=SR): return int(d * sr)


def noise(n, seed):
    r = random.Random(seed)
    return [r.uniform(-1, 1) for _ in range(n)]


def lowpass(x, a):
    y, s = [], 0.0
    for v in x:
        s += a * (v - s); y.append(s)
    return y


def highpass(x, a):
    lp = lowpass(x, a)
    return [v - l for v, l in zip(x, lp)]


def sweep(f0, f1, d, wave_="sine", sr=SR):
    n = n_samples(d, sr); ph = 0.0; out = []
    for i in range(n):
        f = f0 * (f1 / f0) ** (i / max(1, n - 1))
        ph += TAU * f / sr
        if wave_ == "saw": v = 2 * ((ph / TAU) % 1.0) - 1
        elif wave_ == "tri": v = 2 * abs(2 * ((ph / TAU) % 1.0) - 1) - 1
        else: v = math.sin(ph)
        out.append(v)
    return out


def tone(f, d, wave_="sine", sr=SR):
    return sweep(f, f, d, wave_, sr)


def env_exp(n, k, sr=SR): return [math.exp(-k * i / sr) for i in range(n)]


def mul(a, b): return [x * y for x, y in zip(a, b)]


def mix(*layers):
    n = max(len(l) for l in layers)
    out = [0.0] * n
    for l in layers:
        for i, v in enumerate(l): out[i] += v
    return out


def scale(x, g): return [v * g for v in x]


def delay(x, d, sr=SR): return [0.0] * n_samples(d, sr) + x


def attack_release(n, a, r, sr=SR):
    na, nr = n_samples(a, sr), n_samples(r, sr)
    e = []
    for i in range(n):
        v = 1.0
        if i < na: v = i / max(1, na)
        if i > n - nr: v = min(v, (n - i) / max(1, nr))
        e.append(v)
    return e


def normalize(x, peak):
    m = max(abs(v) for v in x) or 1.0
    return [v * peak / m for v in x]


def declick(x, ms=3, sr=SR):
    n = n_samples(ms / 1000.0, sr)
    x = list(x)
    for i in range(min(n, len(x))):
        g = i / n; x[i] *= g; x[-1 - i] *= g
    return x


def write(name, x, sr=SR):
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v)) * 32767)) for v in x))


def tanh_drive(x, g): return [math.tanh(v * g) for v in x]


# ---------------------------------------------------------------- effects
def fire():
    n = n_samples(0.28)
    body = mul(sweep(170, 55, 0.28), env_exp(n, 13))
    crack = mul(highpass(noise(n, 1), 0.3), env_exp(n, 70))
    return mix(body, scale(crack, 0.45))


def hit():
    n = n_samples(0.09)
    return mix(mul(sweep(1500, 900, 0.09), env_exp(n, 45)), scale(mul(noise(n, 2), env_exp(n, 80)), 0.35))


def explode(d=0.7, depth=1.0, seed=3):
    n = n_samples(d)
    x = noise(n, seed); out = []; s = 0.0
    for i, v in enumerate(x):                       # lowpass whose cutoff falls as it decays
        a = 0.45 * math.exp(-5.0 * i / n) + 0.02
        s += a * (v - s); out.append(s)
    boom = mul(sweep(90 * depth, 28, d), env_exp(n, 5.5 / d * 0.7))
    return mix(mul(out, env_exp(n, 4.0 / d * 0.7)), scale(boom, 1.2))


def ram():
    n = n_samples(0.32)
    thud = mul(sweep(110, 38, 0.32), env_exp(n, 11))
    crunch = mul(lowpass(noise(n, 4), 0.1), env_exp(n, 16))
    return mix(thud, scale(crunch, 0.7))


def damage():
    n = n_samples(0.28)
    nz = highpass(lowpass(noise(n, 5), 0.35), 0.05)
    return tanh_drive(mix(mul(nz, env_exp(n, 14)), scale(mul(sweep(320, 110, 0.28), env_exp(n, 20)), 0.6)), 2.0)


def boss():
    d = 1.6; n = n_samples(d)
    a = sweep(110, 147, d, "saw"); b = sweep(111.6, 148.5, d, "saw")
    trem = [0.75 + 0.25 * math.sin(TAU * 6 * i / SR) for i in range(n)]
    horn = lowpass(mul(mix(a, b), trem), 0.12)
    return mul(horn, attack_release(n, 0.3, 0.4))


def pickup():
    n = n_samples(0.16)
    return mul(sweep(600, 1300, 0.16), mul(env_exp(n, 9), attack_release(n, 0.004, 0.03)))


def crate():
    n = n_samples(0.16)
    t1 = mul(tone(880, 0.16, "tri"), env_exp(n, 14))
    t2 = mul(tone(1320, 0.2, "tri"), env_exp(n_samples(0.2), 14))
    return mix(t1, delay(t2, 0.09))


def two_tone(f1, f2):
    n = n_samples(0.22)
    a = mul(tone(f1, 0.22, "tri"), env_exp(n, 9))
    b = mul(tone(f2, 0.25, "tri"), env_exp(n_samples(0.25), 8))
    return mix(a, delay(b, 0.17))


def unlock():
    notes = [523.25, 659.25, 783.99, 1046.5]
    out = []
    for i, f in enumerate(notes):
        n = n_samples(0.34)
        voice = mix(tone(f, 0.34, "tri"), scale(tone(f * 2, 0.34), 0.25))
        out.append(delay(mul(voice, env_exp(n, 5)), 0.17 * i))
    return mix(*out)


def tap():
    n = n_samples(0.05)
    return mul(tone(1800, 0.05), mul(env_exp(n, 110), attack_release(n, 0.002, 0.01)))


def gameover():
    d = 1.3; n = n_samples(d)
    vib = [1 + 0.015 * math.sin(TAU * 5.5 * i / SR) for i in range(n)]
    s = lowpass(mul(sweep(440, 110, d, "saw"), vib), 0.18)
    return mul(s, mul(env_exp(n, 1.6), attack_release(n, 0.01, 0.3)))


def storm():
    d = 2.2; n = n_samples(d)
    rumble = lowpass(noise(n, 6), 0.03)
    swell = [math.sin(math.pi * i / n) ** 2 for i in range(n)]
    return mul(mix(scale(rumble, 6.0), scale(tone(46, d), 0.5)), swell)


def ambient():
    sr = 11025; d = 12.0; n = n_samples(d, sr); x_len = n_samples(1.5, sr)
    total = n + x_len
    water = lowpass(noise(total, 7), 0.05)
    waves = [0.55 + 0.45 * math.sin(TAU * i / (sr * 6.0)) for i in range(total)]     # 6 s swell
    engine = mix(tone(38, total / sr, "sine", sr), scale(tone(76, total / sr, "tri", sr), 0.35))
    eng_am = [0.85 + 0.15 * math.sin(TAU * 9 * i / sr) for i in range(total)]
    sig = mix(scale(mul(water, waves), 7.0), scale(mul(engine, eng_am), 0.25))
    loop = sig[:n]
    for i in range(x_len):                          # crossfade the tail into the head: seamless loop
        w = i / x_len
        loop[i] = sig[i] * w + sig[n + i] * (1 - w)
    return loop, sr


SOUNDS = {
    "fire": (fire, 0.80), "hit": (hit, 0.60), "explode": (explode, 0.95),
    "explode_boss": (lambda: explode(1.5, 1.4, 8), 0.98), "ram": (ram, 0.85),
    "damage": (damage, 0.80), "boss": (boss, 0.85), "pickup": (pickup, 0.60),
    "crate": (crate, 0.65), "dock": (lambda: two_tone(330, 494), 0.65),
    "undock": (lambda: two_tone(494, 330), 0.65), "unlock": (unlock, 0.75),
    "tap": (tap, 0.45), "gameover": (gameover, 0.80), "storm": (storm, 0.70),
}


def main():
    total = 0
    for name, (fn, peak) in SOUNDS.items():
        x = declick(normalize(fn(), peak))
        write(name, x)
        total += len(x) * 2
    x, sr = ambient()
    write("ambient", scale(normalize(x, 0.5), 1.0), sr)          # no declick: it must loop seamlessly
    total += len(x) * 2
    print(f"wrote {len(SOUNDS) + 1} files to assets/audio ({total / 1024:.0f} KiB)")


if __name__ == "__main__":
    main()
