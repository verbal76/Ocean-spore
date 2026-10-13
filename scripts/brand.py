"""Hot Attic Games studio-logo handling. The canonical artwork is never edited:
the shipped copy is a scale-only derivative (Lanczos) with the fully transparent
margin trimmed. scripts/check-brand.py verifies this in CI."""
from PIL import Image

CANONICAL = "Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png"
CANONICAL_SHA256 = "e3d9bb5653eafb783eede827606e7ac73a4e45564a1c25b1ed13ad1429f48c4e"
DERIVED = "assets/branding/hot-attic-logo.png"
DERIVED_WIDTH = 1024


def derive(src=CANONICAL):
    im = Image.open(src).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(box)
    h = round(im.height * DERIVED_WIDTH / im.width)
    return im.resize((DERIVED_WIDTH, h), Image.LANCZOS)
