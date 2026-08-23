#!/usr/bin/env python3
"""Split a multi-character sheet into one keyable master per figure.

    python3 illustrated-src/cut-sheet.py art-src/alien-pals-2026-08/sheet-green.jpg green-a green-b green-c

A generated sheet puts three characters on one plate, close enough that
their glows overlap. Cropping to a bounding box therefore carries a slice
of the neighbour into the master, and fit-suit.py keys whatever it is
handed - so that slice becomes a green shard welded to the sprite, exactly
the class of defect the owner has caught before as specks of foreign
colour on an asset.

Two things have to be true at once and they pull against each other: the
figure's own GLOW must survive (it is painted light, not a halo artefact,
and clipping it flattens the character), while a neighbour 20 px away must
not. So the keep mask is this figure's component grown enough to carry its
glow, MINUS every other component's own ink. Growing alone does not work:
at these spacings a neighbour's tail tip sits inside the grown region and
rides along.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

GROW = 37   # px of glow carried with a figure
PAD = 46    # px of plate left around it


def figures(a):
    mx, mn = a.max(2), a.min(2)
    fg = ndimage.binary_fill_holes(
        ndimage.binary_closing((mx > 70) & ((mx - mn) > 18), np.ones((9, 9))))
    lab, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    return lab, sizes


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, names = sys.argv[1], sys.argv[2:]
    a = np.array(Image.open(src).convert("RGB")).astype(np.float32)
    lab, sizes = figures(a)
    keep = list(np.argsort(sizes)[::-1][:len(names)] + 1)
    keep.sort(key=lambda k: np.nonzero(lab == k)[1].min())
    plate = np.median(a[0:20, 0:20].reshape(-1, 3), axis=0)
    out = os.path.dirname(src)
    for k, name in zip(keep, names):
        own = lab == k
        foreign = (lab > 0) & ~own
        mask = ndimage.binary_dilation(own, np.ones((GROW, GROW))) & ~foreign
        ys, xs = np.nonzero(own)
        x0, x1 = max(0, xs.min() - PAD), min(a.shape[1], xs.max() + PAD + 1)
        y0, y1 = max(0, ys.min() - PAD), min(a.shape[0], ys.max() + PAD + 1)
        crop = a[y0:y1, x0:x1].copy()
        crop[~mask[y0:y1, x0:x1]] = plate
        dst = os.path.join(out, f"{name}-master.png")
        Image.fromarray(crop.astype(np.uint8)).save(dst)
        # a clean master holds exactly one figure
        c = np.array(Image.open(dst).convert("RGB")).astype(np.float32)
        _, s2 = figures(c)
        stray = sorted(s2)[::-1][1:]
        stray = [int(v) for v in stray if v > 40]
        print(f"{name:9s} {x1-x0}x{y1-y0}  figure {int(sizes[k-1])}px"
              + (f"  STRAY LEFT: {stray}" if stray else "  clean"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
