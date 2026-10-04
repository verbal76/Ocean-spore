#!/usr/bin/env python3
"""CI gate: the studio logo is the canonical artwork and the shipped copy is a
faithful, transparent, undistorted derivative of it."""
import hashlib, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import brand
from PIL import Image, ImageChops

fail = []
sha = hashlib.sha256(open(brand.CANONICAL, "rb").read()).hexdigest()
if sha != brand.CANONICAL_SHA256:
    fail.append(f"canonical logo hash {sha} != {brand.CANONICAL_SHA256}")
shipped = Image.open(brand.DERIVED)
if shipped.mode != "RGBA":
    fail.append(f"shipped logo mode {shipped.mode}, expected RGBA (transparency lost)")
else:
    expected = brand.derive()
    if shipped.size != expected.size:
        fail.append(f"size {shipped.size} != {expected.size} (aspect ratio / crop changed)")
    else:
        # RGBA getbbox() only looks at alpha, so test every band explicitly.
        diff = ImageChops.difference(shipped, expected)
        if any(band.getbbox() is not None for band in diff.split()):
            fail.append("shipped logo pixels differ from a clean rescale of the canonical file")
    a = shipped.getchannel("A")
    w, h = shipped.size
    if a.getpixel((2, 2)) != 0 or a.getpixel((w - 3, 2)) != 0:
        fail.append("corners are not transparent")
    if a.getbbox() is None:
        fail.append("logo is fully transparent")
src = Image.open(brand.CANONICAL).convert("RGBA")
box = src.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
src_aspect = (box[2] - box[0]) / (box[3] - box[1])
if abs(shipped.width / shipped.height - src_aspect) > 0.005:
    fail.append("aspect ratio drifted from the canonical artwork")
if fail:
    print("BRAND CHECK FAILED"); [print(" -", f) for f in fail]; sys.exit(1)
print(f"brand check OK: canonical sha256 {sha[:12]}..., shipped {shipped.size} RGBA, pure rescale")
