#!/usr/bin/env python3
"""Regenerates assets/branding/hot-attic-logo.png from the canonical logo."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import brand
im = brand.derive()
im.save(brand.DERIVED, optimize=True)
print("wrote", brand.DERIVED, im.size)
