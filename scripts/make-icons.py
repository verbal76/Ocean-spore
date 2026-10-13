#!/usr/bin/env python3
"""Regenerates the launcher icon set from code (no external art).
   python3 scripts/make-icons.py   ->  assets/icons/*.png

Adaptive icon layers are 1024x1024; all artwork stays inside the central 66%
safe zone so no launcher mask (circle, squircle, teardrop) can clip it.
"""
import math
from PIL import Image, ImageDraw, ImageFilter

S, SS = 1024, 4            # output size, supersample factor
N = S * SS
BG0, BG1 = (3, 16, 28), (10, 48, 80)
CYAN, CYAN_D = (34, 211, 238), (8, 145, 178)
GOLD, HULL, HULL_D = (251, 191, 36), (217, 184, 107), (143, 99, 52)
FOAM = (230, 241, 255)


def sc(v): return int(v * SS)


def background():
    im = Image.new("RGB", (N, N), BG0)
    px = ImageDraw.Draw(im)
    cx, cy, R = N * 0.5, N * 0.42, N * 0.75
    for i in range(60, 0, -1):          # radial glow, drawn big -> small
        t = i / 60
        col = tuple(int(BG0[k] + (BG1[k] - BG0[k]) * (1 - t) ** 1.6) for k in range(3))
        r = R * t
        px.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    return im


def spore(d, cx, cy, r, color):
    """A glowing pod shedding drifting spores (a spiral of shrinking orbs)."""
    for k in range(9):
        a = -2.95 + k * 0.36            # upper arc only: spores drift up, clear of the boat
        dist = r * (1.7 + k * 0.17)
        sr = r * (0.30 - k * 0.026)
        x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist * 0.9
        d.ellipse([x - sr, y - sr, x + sr, y + sr], fill=color)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def foreground(mono=False):
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    glow = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d, g = ImageDraw.Draw(im), ImageDraw.Draw(glow)
    spore_c = (255, 255, 255) if mono else CYAN
    cx, cy = sc(480), sc(430)
    # glow behind the spore
    if not mono:
        for r, a in ((250, 40), (200, 60), (150, 80)):
            g.ellipse([cx - sc(r), cy - sc(r), cx + sc(r), cy + sc(r)], fill=CYAN + (a,))
        glow = glow.filter(ImageFilter.GaussianBlur(sc(26)))
        im.alpha_composite(glow)
        d = ImageDraw.Draw(im)
    spore(d, cx, cy, sc(86), spore_c)
    if not mono:       # bright highlight
        d.ellipse([cx - sc(34), cy - sc(44), cx - sc(2), cy - sc(12)], fill=(190, 247, 255))
        # (highlight drawn before fitting)

    # boat: a chunky salvage skiff
    hull = (255, 255, 255) if mono else HULL
    hull_dark = (255, 255, 255) if mono else HULL_D
    by = sc(640)
    d.polygon([(sc(338), by - sc(34)), (sc(686), by - sc(34)), (sc(630), by + sc(46)), (sc(394), by + sc(46))],
              fill=hull)
    if not mono:
        d.polygon([(sc(352), by - sc(8)), (sc(672), by - sc(8)), (sc(660), by + sc(8)), (sc(364), by + sc(8))],
                  fill=hull_dark)
    d.rectangle([sc(478), by - sc(92), sc(546), by - sc(34)], fill=hull)         # cabin
    d.rectangle([sc(546), by - sc(76), sc(600), by - sc(60)], fill=hull)         # cannon
    if not mono:
        d.ellipse([sc(494), by - sc(76), sc(512), by - sc(58)], fill=(34, 60, 90))  # porthole

    # wave, cutting across the hull
    wave = (255, 255, 255) if mono else CYAN
    pts = []
    for x in range(sc(262), sc(762) + 1, SS * 4):
        t = (x - sc(262)) / sc(500)
        pts.append((x, sc(676) + math.sin(t * math.pi * 3.0) * sc(18)))
    poly = pts + [(sc(762), sc(760)), (sc(262), sc(760))]
    d.polygon(poly, fill=wave)
    if not mono:
        d.line(pts, fill=FOAM, width=sc(9))
    return fit_safe_zone(im)


def fit_safe_zone(im, target=sc(672)):
    # Scale the solid artwork (not the soft glow) to fill the 66% safe zone.
    solid = im.getchannel("A").point(lambda a: 255 if a > 200 else 0)
    box = solid.getbbox()
    k = target / max(box[2] - box[0], box[3] - box[1])
    nw, nh = int(im.width * k), int(im.height * k)
    scaled = im.resize((nw, nh), Image.LANCZOS)
    bx, by = (box[0] + box[2]) / 2 * k, (box[1] + box[3]) / 2 * k
    out = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    out.alpha_composite(scaled, (int(N / 2 - bx), int(N / 2 - by)))
    return out


def finish(im, size):
    return im.resize((size, size), Image.LANCZOS)


def main():
    bg = finish(background(), S)
    fg = finish(foreground(), S)
    mono = finish(foreground(mono=True), S)
    bg.save("assets/icons/adaptive-background.png", optimize=True)
    fg.save("assets/icons/adaptive-foreground.png", optimize=True)
    mono.save("assets/icons/adaptive-monochrome.png", optimize=True)
    # Full-bleed legacy/Play-store style icon: foreground enlarged on the background.
    full = bg.convert("RGBA")
    big = fg.resize((int(S * 1.25), int(S * 1.25)), Image.LANCZOS)
    full.alpha_composite(big, ((S - big.width) // 2, (S - big.height) // 2 - 10))
    full.convert("RGB").save("assets/icons/icon.png", optimize=True)
    # Preview of common launcher masks (not shipped)
    prev = Image.new("RGB", (3 * 260, 260), (30, 30, 30))
    for i, shape in enumerate(("circle", "squircle", "square")):
        comp = bg.convert("RGBA"); comp.alpha_composite(fg)
        comp = comp.resize((240, 240), Image.LANCZOS)
        m = Image.new("L", (240, 240), 0); md = ImageDraw.Draw(m)
        if shape == "circle": md.ellipse([0, 0, 239, 239], fill=255)
        elif shape == "squircle": md.rounded_rectangle([0, 0, 239, 239], radius=72, fill=255)
        else: md.rounded_rectangle([0, 0, 239, 239], radius=20, fill=255)
        prev.paste(comp, (i * 260 + 10, 10), m)
    prev.save("/home/user/recovery/shots/icon-preview.png")


if __name__ == "__main__":
    main()
