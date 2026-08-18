#!/usr/bin/env python3
"""DO NOT recut pals from the overlapping sprite sheet.

The 3x4 jpg/png sheet has multiple characters bleeding through every
cell. Hangar pals must be the single-character portraits in
public/art/solo/ (restored from the named 128px thumbs).
"""
raise SystemExit(
    "refusing to slice the overlapping pal sheet — use public/art/solo/*.png"
)
