#!/usr/bin/env python3
"""CI gate: the committed assets/audio matches what scripts/make-audio.py generates.

Compares decoded samples, not bytes: libm may differ by one unit in the last
place between Python/OS versions, which can move a 16-bit sample by 1 LSB.
Any difference larger than TOLERANCE LSB (or a different length/format) fails.
"""
import os, subprocess, sys, tempfile, wave

TOLERANCE = 4
here = os.path.dirname(os.path.abspath(__file__))
committed = os.path.join(here, "..", "assets", "audio")

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run([sys.executable, os.path.join(here, "make-audio.py"), "--out", tmp], check=True, stdout=subprocess.DEVNULL)
    bad = []
    names = sorted(f for f in os.listdir(tmp) if f.endswith(".wav"))
    shipped = sorted(f for f in os.listdir(committed) if f.endswith(".wav"))
    if names != shipped:
        bad.append(f"file set differs: generated {names} vs committed {shipped}")
    for f in names:
        if f not in shipped:
            continue
        with wave.open(os.path.join(tmp, f)) as a, wave.open(os.path.join(committed, f)) as b:
            if a.getparams()[:4] != b.getparams()[:4] or a.getnframes() != b.getnframes():
                bad.append(f"{f}: format or length differs"); continue
            da, db = a.readframes(a.getnframes()), b.readframes(b.getnframes())
        worst = max(abs(int.from_bytes(da[i:i+2], "little", signed=True) - int.from_bytes(db[i:i+2], "little", signed=True))
                    for i in range(0, len(da), 2))
        if worst > TOLERANCE:
            bad.append(f"{f}: max sample difference {worst} LSB > {TOLERANCE}")
    if bad:
        print("AUDIO DRIFT"); [print(" -", x) for x in bad]; sys.exit(1)
    print(f"audio check OK: {len(names)} files match the generator (tolerance {TOLERANCE} LSB)")
